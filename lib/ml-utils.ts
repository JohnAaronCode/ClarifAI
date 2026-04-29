interface EnsembleResult {
  primary_verdict: "REAL" | "FAKE" | "UNVERIFIED"
  confidence_score: number
  reasoning: string
  ml_signals: {
    verdict_explanation: string
    credibility_indicators: string[]
    red_flags: string[]
    sentiment: string
    writing_quality: string
  } | null
  // Summary from the dedicated summary call (null = use heuristic upstream)
  ai_summary?: {
    summary: string
    key_claims: Array<{ claim: string; status: "verified" | "unverified" | "disputed" }>
  } | null
}

// ── Gemini Flash ──────────────────────────────────────────────────────────
async function callGemini(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  maxTokens = 800,
): Promise<string | null> {
  const models = ["gemini-2.0-flash", "gemini-1.5-flash"]

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: maxTokens,
              responseMimeType: "application/json",
            },
          }),
          signal: AbortSignal.timeout(15000),
        }
      )

      if (res.status === 429) {
        console.warn(`[Gemini] 429 on ${model}, trying next...`)
        await new Promise(r => setTimeout(r, 1000))
        continue
      }
      if (!res.ok) { console.warn(`[Gemini] HTTP ${res.status} on ${model}`); continue }

      const data = await res.json()
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null
    } catch (err) {
      console.warn(`[Gemini] Error on ${model}:`, err)
    }
  }
  return null
}

// ── Groq Fallback ─────────────────────────────────────────────────────────
async function callGroq(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  maxTokens = 800,
): Promise<string | null> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: maxTokens,
        temperature: 0.1,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) { console.warn(`[Groq] HTTP ${res.status}`); return null }
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? null
  } catch (err) {
    console.warn("[Groq] Error:", err)
    return null
  }
}

// ── Credibility Analysis Prompt ───────────────────────────────────────────
function buildAnalysisPrompt(content: string, evidence?: string): { system: string; user: string } {
  const system = `You are an expert news credibility analyst. Analyze the article and return ONLY a valid JSON object — no markdown, no extra text.`

  const evidenceSection = evidence
    ? `\n\nPre-gathered evidence:\n"""\n${evidence}\n"""\n`
    : ""

  const user = `Analyze this news article for credibility.${evidenceSection}

Return ONLY this JSON (no markdown fences):
{
  "verdict": "REAL" | "FAKE" | "UNVERIFIED",
  "confidence": <number 30-97>,
  "verdict_explanation": "<2-3 sentence explanation>",
  "credibility_indicators": ["<up to 3 positive signals>"],
  "red_flags": ["<up to 3 concerns, empty array if none>"],
  "sentiment": "neutral" | "slightly emotional" | "moderately emotional" | "highly emotional",
  "writing_quality": "professional" | "average" | "poor"
}

Verdict rules:
- REAL: credible source, factual language, verifiable claims, no sensationalism
- FAKE: sensationalist headlines, unverified claims, clickbait, no sources, logical fallacies
- UNVERIFIED: mixed signals, plausible but insufficient evidence

Article (first 3000 chars):
"""
${content.substring(0, 3000)}
"""`

  return { system, user }
}

// ── Dedicated Summary Prompt ──────────────────────────────────────────────
// Separate call — the LLM focuses ONLY on summarization.
// Gets up to 4000 chars vs 3000 for analysis, and returns richer claim data.
function buildSummaryPrompt(content: string): { system: string; user: string } {
  const system = `You are a professional news editor. Produce accurate, neutral article summaries and identify key verifiable claims. Return ONLY valid JSON — no markdown, no extra text.`

  const user = `Read this news article and produce:
1. A clear, factual 3-4 sentence summary in your own words
2. Up to 4 specific, verifiable claims extracted from the article

Return ONLY this JSON (no markdown fences):
{
  "summary": "<3-4 sentence factual summary — what happened, who is involved, when, and why it matters>",
  "key_claims": [
    {
      "claim": "<one specific, verifiable claim — max 160 chars>",
      "status": "verified" | "unverified" | "disputed"
    }
  ]
}

Status rules:
- "verified"   = explicit official attribution, named source, or matches established facts
- "disputed"   = denied, contested, under investigation, or described as alleged/claimed
- "unverified" = no clear attribution or supporting evidence — USE THIS as the safe default

Rules:
- Summary must be neutral — no editorializing or opinion
- Do NOT copy sentences verbatim — paraphrase in your own words  
- Claims must be specific and concrete, not vague generalizations
- Be conservative with "verified" — only use when attribution is explicit in the text

Article:
"""
${content.substring(0, 4000)}
"""`

  return { system, user }
}

// ── Parse Analysis Response ───────────────────────────────────────────────
function parseAnalysisResponse(raw: string, source: string): Omit<EnsembleResult, "ai_summary"> | null {
  try {
    const clean  = raw.replace(/```json\n?|\n?```/g, "").trim()
    const parsed = JSON.parse(clean)

    if (!parsed.verdict || !["REAL", "FAKE", "UNVERIFIED"].includes(parsed.verdict)) return null

    // Normalize confidence — avoid extreme values from different models
    const confidence = Math.min(Math.max(Math.round(Number(parsed.confidence ?? 50)), 35), 95)

    return {
      primary_verdict:  parsed.verdict,
      confidence_score: confidence,
      reasoning: `${source}: ${parsed.verdict_explanation ?? ""}`,
      ml_signals: {
        verdict_explanation:    parsed.verdict_explanation ?? "",
        credibility_indicators: Array.isArray(parsed.credibility_indicators)
          ? parsed.credibility_indicators.slice(0, 3)
          : [],
        red_flags: Array.isArray(parsed.red_flags)
          ? parsed.red_flags.slice(0, 3)
          : [],
        sentiment:       parsed.sentiment       ?? "neutral",
        writing_quality: parsed.writing_quality ?? "average",
      },
    }
  } catch {
    console.warn(`[${source}] Analysis JSON parse failed`)
    return null
  }
}

// ── Parse Summary Response ────────────────────────────────────────────────
function parseSummaryResponse(raw: string, source: string): EnsembleResult["ai_summary"] {
  try {
    const clean  = raw.replace(/```json\n?|\n?```/g, "").trim()
    const parsed = JSON.parse(clean)

    if (!parsed.summary || typeof parsed.summary !== "string" || parsed.summary.length < 20) {
      return null
    }

    const rawClaims  = Array.isArray(parsed.key_claims) ? parsed.key_claims : []
    const key_claims = rawClaims
      .filter((c: any) => c?.claim && typeof c.claim === "string" && c.claim.length > 10)
      .slice(0, 4)
      .map((c: any) => ({
        claim:  String(c.claim).substring(0, 160),
        status: (["verified", "unverified", "disputed"].includes(c.status)
          ? c.status
          : "unverified") as "verified" | "unverified" | "disputed",
      }))

    console.log(`[ClarifAI] ✓ Summary (${source}): ${parsed.summary.length} chars, ${key_claims.length} claims`)

    return {
      summary: parsed.summary.substring(0, 700),
      key_claims,
    }
  } catch {
    console.warn(`[${source}] Summary JSON parse failed`)
    return null
  }
}

// ── Summary call — tries Gemini then Groq ─────────────────────────────────
async function runSummaryCall(
  content: string,
  geminiKey: string | undefined,
  groqKey: string | undefined,
): Promise<EnsembleResult["ai_summary"]> {
  const { system, user } = buildSummaryPrompt(content)

  if (geminiKey) {
    const raw = await callGemini(user, system, geminiKey, 600)
    if (raw) {
      const result = parseSummaryResponse(raw, "Gemini Flash")
      if (result) return result
    }
    console.warn("[ClarifAI] Gemini summary failed, trying Groq...")
  }

  if (groqKey) {
    const raw = await callGroq(user, system, groqKey, 600)
    if (raw) {
      const result = parseSummaryResponse(raw, "Groq Llama")
      if (result) return result
    }
    console.warn("[ClarifAI] Groq summary failed — heuristic summary will be used")
  }

  return null  // upstream generateArticleSummary() takes over
}

// ── Analysis call — tries Gemini then Groq then heuristic ────────────────
async function runAnalysisCall(
  content: string,
  evidence: string,
  geminiKey: string | undefined,
  groqKey: string | undefined,
): Promise<Omit<EnsembleResult, "ai_summary">> {
  const { system, user } = buildAnalysisPrompt(content, evidence)

  if (geminiKey) {
    const raw = await callGemini(user, system, geminiKey, 700)
    if (raw) {
      const result = parseAnalysisResponse(raw, "Gemini Flash")
      if (result) {
        console.log(`[ClarifAI] ✓ Analysis (Gemini): ${result.primary_verdict} (${result.confidence_score}%)`)
        return result
      }
    }
    console.warn("[ClarifAI] Gemini analysis failed, trying Groq...")
  }

  if (groqKey) {
    const raw = await callGroq(user, system, groqKey, 700)
    if (raw) {
      const result = parseAnalysisResponse(raw, "Groq Llama")
      if (result) {
        console.log(`[ClarifAI] ✓ Analysis (Groq): ${result.primary_verdict} (${result.confidence_score}%)`)
        return result
      }
    }
    console.warn("[ClarifAI] Groq analysis failed, using heuristic...")
  }

  console.warn("[ClarifAI] All LLMs unavailable — heuristic fallback")
  return heuristicFallback(content)
}

// ── Main Ensemble Analysis ────────────────────────────────────────────────
// Both calls run in parallel — no extra latency vs. the old single-call approach.
export async function ensembleAnalysis(
  content: string,
  evidence: string,
  _openaiKey: string,   // kept for backward compat
  groqApiKey?: string,
): Promise<EnsembleResult> {
  const geminiKey = process.env.GEMINI_API_KEY
  const groqKey   = groqApiKey ?? process.env.GROQ_API_KEY

  // Parallel execution — analysis + summary fire at the same time
  const [analysisResult, summaryResult] = await Promise.all([
    runAnalysisCall(content, evidence, geminiKey, groqKey),
    runSummaryCall(content, geminiKey, groqKey),
  ])

  return {
    ...analysisResult,
    ai_summary: summaryResult,
  }
}

// ── Heuristic Fallback ────────────────────────────────────────────────────
function heuristicFallback(content: string): Omit<EnsembleResult, "ai_summary"> {
  const emotional   = analyzeEmotional(content)
  const credibility = analyzeCredibility(content)

  let verdict: "REAL" | "FAKE" | "UNVERIFIED" = "UNVERIFIED"
  let confidence = 50

  if (credibility > 0.68 && emotional < 0.35) {
    verdict    = "REAL"
    confidence = Math.min(Math.round(52 + credibility * 20), 72)
  } else if (credibility < 0.32 && emotional > 0.55) {
    verdict    = "FAKE"
    confidence = Math.min(Math.round(52 + (1 - credibility) * 18), 72)
  } else {
    confidence = Math.round(40 + credibility * 15)
  }

  return {
    primary_verdict:  verdict,
    confidence_score: Math.max(35, Math.min(confidence, 72)),
    reasoning: `Heuristic (LLMs unavailable). Credibility: ${(credibility * 100).toFixed(0)}%`,
    ml_signals: {
      verdict_explanation: `Analyzed using built-in heuristics. Credibility: ${(credibility * 100).toFixed(0)}%, Emotional tone: ${(emotional * 100).toFixed(0)}%.`,
      credibility_indicators: credibility > 0.5 ? ["Content contains credible writing patterns"] : [],
      red_flags:              emotional > 0.5   ? ["High emotional language detected"] : [],
      sentiment:       emotional > 0.6  ? "highly emotional" : emotional > 0.35 ? "moderately emotional" : "neutral",
      writing_quality: credibility > 0.65 ? "professional" : credibility > 0.4 ? "average" : "poor",
    },
  }
}

function analyzeEmotional(text: string): number {
  const extreme = ["shocking","outrageous","unbelievable","evil","scandal","bombshell","exposed","conspiracy"]
  const high    = ["amazing","terrible","urgent","horrific","disaster","tragic","devastating","stunning"]
  const lower   = text.toLowerCase()
  let score = 0
  for (const w of extreme) score += (lower.match(new RegExp(`\\b${w}\\b`, "g")) || []).length * 0.15
  for (const w of high)    score += (lower.match(new RegExp(`\\b${w}\\b`, "g")) || []).length * 0.08
  return Math.min(score, 1)
}

function analyzeCredibility(text: string): number {
  let score = 0.5
  const citations = [/according to/i, /research (shows|indicates)/i, /study found/i, /experts? (say|warn)/i, /reported by/i, /\[\d+\]/]
  score += citations.filter(p => p.test(text)).length * 0.07
  score += Math.min((text.match(/\b\d+(\.\d+)?%?\b/g) || []).length / 10, 0.1)
  const vague    = [/they say/i, /sources claim/i, /people are saying/i]
  score -= vague.filter(p => p.test(text)).length * 0.08
  const clickbait = [/you won't believe/i, /shocking truth/i, /they don't want you to know/i]
  score -= clickbait.filter(p => p.test(text)).length * 0.1
  return Math.max(0, Math.min(score, 1))
}

// ── Legacy exports ────────────────────────────────────────────────────────
export async function analyzeSentimentWithTransformers() { return null }
export async function extractEntitiesWithNER() { return [] }
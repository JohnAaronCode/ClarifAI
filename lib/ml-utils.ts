// lib/ml-utils.ts
// Primary ML engine: Flask ML model (your trained model.pkl)
// AI analysis: Groq (free, fast) → OpenAI GPT-4o mini fallback
// Last resort: Heuristic

// ── Types ──────────────────────────────────────────────────────────────────
interface SentimentResult {
  label: "POSITIVE" | "NEGATIVE" | "NEUTRAL"
  detailed_scores: { positive: number; negative: number }
}

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
}

// ── Flask ML Server URL ────────────────────────────────────────────────────
const ML_API_URL = process.env.ML_API_URL || "http://localhost:5000"

// ── Get prediction from your trained model.pkl via Flask ──────────────────
async function getMLPrediction(text: string): Promise<{
  verdict: "REAL" | "FAKE" | null
  confidence: number | null
}> {
  try {
    const res = await fetch(`${ML_API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.substring(0, 5000) }),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      console.warn(`[ML API] HTTP ${res.status} — skipping ML signal`)
      return { verdict: null, confidence: null }
    }

    const data = await res.json()

    if (!data.verdict || !["REAL", "FAKE"].includes(data.verdict)) {
      console.warn("[ML API] Invalid response format:", data)
      return { verdict: null, confidence: null }
    }

    console.log(`[ML API] Prediction: ${data.verdict} (${data.confidence ?? "n/a"}%)`)
    return {
      verdict: data.verdict as "REAL" | "FAKE",
      confidence: data.confidence ?? null,
    }
  } catch (err) {
    console.warn("[ML API] Server unreachable — skipping ML signal:", err)
    return { verdict: null, confidence: null }
  }
}

// ── Chat completion helper — works for both Groq and OpenAI ───────────────
async function callChatAPI(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  baseUrl: string,
  model: string,
  maxTokens = 600,
): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.1,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[${baseUrl.includes("groq") ? "Groq" : "OpenAI"}] HTTP ${res.status}:`, err.substring(0, 200))
      return null
    }

    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? null
  } catch (err) {
    console.error(`[Chat API] Error:`, err)
    return null
  }
}

// ── Shared analysis prompt builder ────────────────────────────────────────
function buildAnalysisPrompt(content: string, evidence?: string): { system: string; user: string } {
  const system = `You are an expert news credibility analyst. You will be given a news article and pre-gathered evidence from multiple sources. Use ALL the evidence provided to make your assessment — do not guess. Respond ONLY with a valid JSON object, no markdown, no extra text.`

  const evidenceSection = evidence
    ? `\n\nPre-gathered evidence:\n"""\n${evidence}\n"""\n\nUse this evidence to inform your verdict. If fact-check results are present, weigh them heavily.`
    : ""

  const user = `Analyze this news article for credibility.${evidenceSection}

Return ONLY a JSON object:
{
  "verdict": "REAL" | "FAKE" | "UNVERIFIED",
  "confidence": <number 30-97>,
  "verdict_explanation": "<2-3 sentence explanation citing specific evidence>",
  "credibility_indicators": ["<positive signal>", ...],
  "red_flags": ["<concern>", ...],
  "sentiment": "neutral" | "slightly emotional" | "moderately emotional" | "highly emotional",
  "writing_quality": "professional" | "average" | "poor"
}

Verdict rules:
- REAL: credible source, factual language, verifiable claims, no major red flags
- FAKE: sensationalist, unverified claims, no sources, clickbait, contradicts fact-checks
- UNVERIFIED: mixed signals, plausible but insufficient evidence to confirm

Confidence rules:
- 85-97: strong clear evidence pointing one way
- 70-84: good evidence, minor ambiguity
- 50-69: mixed or limited evidence
- 30-49: very little evidence to work with

Article:
"""
${content.substring(0, 3000)}
"""`

  return { system, user }
}

// ── Parse OpenAI/Groq JSON response into EnsembleResult ───────────────────
function parseAnalysisResponse(response: string, source: string): EnsembleResult | null {
  try {
    const clean = response.replace(/```json\n?|\n?```/g, "").trim()
    const parsed = JSON.parse(clean)

    if (!parsed.verdict || !parsed.confidence) return null
    if (!["REAL", "FAKE", "UNVERIFIED"].includes(parsed.verdict)) return null

    return {
      primary_verdict: parsed.verdict,
      confidence_score: Math.min(Math.max(Math.round(parsed.confidence), 30), 97),
      reasoning: `${source}: ${parsed.verdict_explanation ?? "Analysis complete."}`,
      ml_signals: {
        verdict_explanation: parsed.verdict_explanation ?? "",
        credibility_indicators: parsed.credibility_indicators ?? [],
        red_flags: parsed.red_flags ?? [],
        sentiment: parsed.sentiment ?? "neutral",
        writing_quality: parsed.writing_quality ?? "average",
      },
    }
  } catch (err) {
    console.error(`[${source}] JSON parse error:`, err)
    return null
  }
}

// ── 1. Sentiment (heuristic — no external API needed) ─────────────────────
export async function analyzeSentimentWithTransformers(
  content: string,
  apiKey: string,
): Promise<SentimentResult | null> {
  return heuristicSentiment(content)
}

// ── 2. NER (heuristic) ─────────────────────────────────────────────────────
export async function extractEntitiesWithNER(
  content: string,
  apiKey: string,
): Promise<Array<{ word: string; entity_group: string; score: number }>> {
  return heuristicNER(content)
}

// ── 3. Ensemble Analysis ───────────────────────────────────────────────────
// Flow: Flask ML model (parallel) + Groq/OpenAI AI analysis
// Merge: ML = 40%, AI = 60%
// Graceful fallback at every level — app never breaks
export async function ensembleAnalysis(
  content: string,
  evidenceOrHfKey: string,
  openaiApiKey: string,
  groqApiKey?: string,
): Promise<EnsembleResult> {
  const isEvidence = evidenceOrHfKey.includes("\n") || evidenceOrHfKey.includes(":")
  const evidence   = isEvidence ? evidenceOrHfKey : undefined
  const groqKey    = groqApiKey

  // ── Fire ML prediction in background immediately ─────────────────────────
  const mlPromise = getMLPrediction(content)

  // ── Try Groq first (free, fast) ───────────────────────────────────────────
  let aiResult: EnsembleResult | null = null

  if (groqKey) {
    const { system, user } = buildAnalysisPrompt(content, evidence)
    const response = await callChatAPI(
      user, system, groqKey,
      "https://api.groq.com/openai/v1",
      "llama-3.3-70b-versatile",
      600,
    )
    if (response) {
      aiResult = parseAnalysisResponse(response, "Groq llama-3.3-70b")
      if (aiResult) console.log("[ClarifAI] AI analysis via Groq: OK")
    }
    if (!aiResult) console.warn("[Groq] Failed or invalid response, trying OpenAI...")
  }

  // ── Fallback to OpenAI ────────────────────────────────────────────────────
  if (!aiResult && openaiApiKey) {
    const { system, user } = buildAnalysisPrompt(content, evidence)
    const response = await callChatAPI(
      user, system, openaiApiKey,
      "https://api.openai.com/v1",
      "gpt-4o-mini",
      600,
    )
    if (response) {
      aiResult = parseAnalysisResponse(response, "OpenAI GPT-4o mini")
      if (aiResult) console.log("[ClarifAI] AI analysis via OpenAI: OK")
    }
    if (!aiResult) console.warn("[OpenAI] Failed or invalid response...")
  }

  // ── Await ML result (was running in parallel) ─────────────────────────────
  const mlResult    = await mlPromise
  const mlAvailable = mlResult.verdict !== null

  // ── Case 1: Both ML + AI available → merge ────────────────────────────────
  if (mlAvailable && aiResult) {
    const mlScore = mlResult.verdict === "REAL" ? 1 : 0
    const aiScore = aiResult.primary_verdict === "REAL" ? 1
                  : aiResult.primary_verdict === "FAKE" ? 0
                  : 0.5

    // ML = 40% weight, AI = 60% weight
    const combined = mlScore * 0.4 + aiScore * 0.6

    const mergedVerdict: "REAL" | "FAKE" | "UNVERIFIED" =
      combined >= 0.65 ? "REAL"
      : combined <= 0.35 ? "FAKE"
      : "UNVERIFIED"

    const mlConf     = mlResult.confidence ?? 50
    const mergedConf = Math.round(mlConf * 0.4 + aiResult.confidence_score * 0.6)

    console.log(
      `[Ensemble] ML: ${mlResult.verdict} (${mlConf}%) + ` +
      `AI: ${aiResult.primary_verdict} (${aiResult.confidence_score}%) → ` +
      `${mergedVerdict} (${mergedConf}%)`
    )

    return {
      ...aiResult,
      primary_verdict: mergedVerdict,
      confidence_score: mergedConf,
      reasoning: `ML+AI Ensemble: ${aiResult.ml_signals?.verdict_explanation ?? aiResult.reasoning}`,
      ml_signals: {
        ...(aiResult.ml_signals ?? {
          verdict_explanation: "",
          credibility_indicators: [],
          red_flags: [],
          sentiment: "neutral",
          writing_quality: "average",
        }),
        verdict_explanation:
          `ML model: ${mlResult.verdict} (${mlConf}% confidence). ` +
          (aiResult.ml_signals?.verdict_explanation ?? ""),
      },
    }
  }

  // ── Case 2: ML only (AI providers unavailable) ────────────────────────────
  if (mlAvailable) {
    console.log("[ClarifAI] ML only — AI providers unavailable")
    return {
      primary_verdict: mlResult.verdict as "REAL" | "FAKE",
      confidence_score: mlResult.confidence ?? 65,
      reasoning: `ML model prediction: ${mlResult.verdict}`,
      ml_signals: {
        verdict_explanation: `Your trained ML model classified this as ${mlResult.verdict} with ${mlResult.confidence ?? "unknown"}% confidence.`,
        credibility_indicators: mlResult.verdict === "REAL" ? ["ML model classified as real news"] : [],
        red_flags: mlResult.verdict === "FAKE" ? ["ML model detected fake news patterns"] : [],
        sentiment: "neutral",
        writing_quality: "average",
      },
    }
  }

  // ── Case 3: AI only (ML server down) ─────────────────────────────────────
  if (aiResult) {
    console.log("[ClarifAI] AI only — ML server unavailable")
    return aiResult
  }

  // ── Case 4: All providers failed → heuristic ─────────────────────────────
  console.warn("[ClarifAI] All providers unavailable — using heuristic fallback")
  return heuristicEnsemble(content)
}

// ── Heuristic fallback ─────────────────────────────────────────────────────
function heuristicEnsemble(content: string): EnsembleResult {
  const emotional   = analyzeEmotionalContent(content)
  const credibility = analyzeCredibilitySignals(content)

  let verdict: "REAL" | "FAKE" | "UNVERIFIED" = "UNVERIFIED"
  let confidence = 50

  if (credibility > 0.68 && emotional < 0.35) {
    verdict    = "REAL"
    confidence = Math.round(55 + credibility * 28)
  } else if (credibility < 0.32 && emotional > 0.55) {
    verdict    = "FAKE"
    confidence = Math.round(55 + (1 - credibility) * 22)
  } else {
    verdict    = "UNVERIFIED"
    confidence = Math.round(40 + credibility * 20)
  }

  return {
    primary_verdict: verdict,
    confidence_score: Math.min(confidence, 75),
    reasoning: `Heuristic analysis (AI providers unavailable). Credibility: ${(credibility * 100).toFixed(0)}%, Emotion: ${(emotional * 100).toFixed(0)}%`,
    ml_signals: null,
  }
}

function heuristicSentiment(content: string): SentimentResult {
  const lower    = content.toLowerCase()
  const negWords = ["shocking","outrageous","unbelievable","scandal","exposed","evil","corrupt","fraud","disaster","terrible","horrific","devastating"]
  const posWords = ["success","achievement","breakthrough","improvement","progress","relief","victory","hope"]
  let neg = 0, pos = 0
  for (const w of negWords) neg += (lower.match(new RegExp(`\\b${w}\\b`, "g")) || []).length * 0.12
  for (const w of posWords) pos += (lower.match(new RegExp(`\\b${w}\\b`, "g")) || []).length * 0.08
  neg = Math.min(neg, 1)
  pos = Math.min(pos, 1)
  return {
    label: neg > pos ? "NEGATIVE" : pos > neg ? "POSITIVE" : "NEUTRAL",
    detailed_scores: { positive: pos, negative: neg },
  }
}

function heuristicNER(content: string): Array<{ word: string; entity_group: string; score: number }> {
  const words    = content.split(/\s+/)
  const entities: Array<{ word: string; entity_group: string; score: number }> = []
  const seen     = new Set<string>()
  for (let i = 0; i < words.length - 1; i++) {
    const pair = `${words[i]} ${words[i + 1]}`
    if (/^[A-Z][a-z]{1,}\s+[A-Z][a-z]{1,}/.test(pair) && !seen.has(pair)) {
      seen.add(pair)
      entities.push({ word: pair, entity_group: "PER", score: 0.85 })
    }
  }
  return entities.slice(0, 8)
}

function analyzeEmotionalContent(text: string): number {
  const extreme = ["shocking","outrageous","unbelievable","evil","scandal","bombshell","exposed","conspiracy","hoax"]
  const high    = ["amazing","terrible","urgent","horrific","disaster","tragic","devastating","stunning","alarming"]
  const lower   = text.toLowerCase()
  let score     = 0
  for (const w of extreme) score += (lower.match(new RegExp(`\\b${w}\\b`, "g")) || []).length * 0.15
  for (const w of high)    score += (lower.match(new RegExp(`\\b${w}\\b`, "g")) || []).length * 0.08
  return Math.min(score, 1)
}

function analyzeCredibilitySignals(text: string): number {
  let score           = 0.5
  const citations     = [/according to/i, /research (shows|indicates)/i, /study found/i, /experts? (say|warn)/i, /reported by/i, /\[\d+\]/]
  score              += citations.filter((p) => p.test(text)).length * 0.07
  const numbers       = (text.match(/\b\d+(\.\d+)?%?\b/g) || []).length
  score              += Math.min(numbers / 10, 0.1)
  const namedEntities = (text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) || []).length
  score              += Math.min(namedEntities / 20, 0.08)
  const vague         = [/they say/i, /sources claim/i, /people are saying/i, /everyone knows/i]
  score              -= vague.filter((p) => p.test(text)).length * 0.08
  const clickbait     = [/you won't believe/i, /shocking truth/i, /they don't want you to know/i]
  score              -= clickbait.filter((p) => p.test(text)).length * 0.1
  return Math.max(0, Math.min(score, 1))
}
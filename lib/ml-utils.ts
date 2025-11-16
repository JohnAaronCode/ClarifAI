export interface MLClassificationResult {
  label: string
  score: number
}

export interface MLSentimentResult {
  label: string
  score: number
  detailed_scores: {
    positive: number
    negative: number
    neutral: number
  }
}

export interface MLEntityResult {
  text: string
  entity_group: string
  score: number
  start: number
  end: number
}

// Hugging Face Inference API wrapper for zero-shot classification
export async function classifyWithZeroShot(
  text: string,
  candidates: string[],
  apiKey: string
): Promise<MLClassificationResult[]> {
  if (!apiKey) throw new Error("HF_API_KEY not configured")

  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: text.substring(0, 512),
          parameters: {
            candidate_labels: candidates,
            multi_class: false,
          },
        }),
        signal: AbortSignal.timeout(10000),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error("[ML] Zero-shot classification error:", error)
      return []
    }

    const data = await response.json()
    return data.scores?.map((score: number, idx: number) => ({
      label: data.labels[idx],
      score: score,
    })) || []
  } catch (error) {
    console.error("[ML] Classification error:", error)
    return []
  }
}

// Transformer-based sentiment analysis
export async function analyzeSentimentWithTransformers(
  text: string,
  apiKey: string
): Promise<MLSentimentResult | null> {
  if (!apiKey) return null

  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: text.substring(0, 512),
        }),
        signal: AbortSignal.timeout(10000),
      }
    )

    if (!response.ok) return null

    const data = await response.json()
    const result = Array.isArray(data) ? data[0] : data

    // Map sentiment labels to scores
    const scores = result.reduce(
      (acc: any, item: any) => {
        if (item.label.toLowerCase().includes("positive")) acc.positive = item.score
        else if (item.label.toLowerCase().includes("negative")) acc.negative = item.score
        else acc.neutral = item.score
        return acc
      },
      { positive: 0, negative: 0, neutral: 0 }
    )

    const primaryLabel =
      result.length > 0 ? result[0].label : "neutral"
    const primaryScore = result.length > 0 ? result[0].score : 0

    return {
      label: primaryLabel,
      score: primaryScore,
      detailed_scores: {
        positive: scores.positive || 0,
        negative: scores.negative || 0,
        neutral: scores.neutral || 1 - (scores.positive + scores.negative),
      },
    }
  } catch (error) {
    console.error("[ML] Sentiment analysis error:", error)
    return null
  }
}

// Named Entity Recognition
export async function extractEntitiesWithNER(
  text: string,
  apiKey: string
): Promise<MLEntityResult[]> {
  if (!apiKey) return []

  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/dslim/bert-base-NER",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: text.substring(0, 512),
        }),
        signal: AbortSignal.timeout(10000),
      }
    )

    if (!response.ok) return []

    const data = await response.json()
    return Array.isArray(data) ? data.slice(0, 10) : []
  } catch (error) {
    console.error("[ML] NER error:", error)
    return []
  }
}

// Semantic similarity for fact-checking
export async function computeSemanticSimilarity(
  claim: string,
  references: string[],
  apiKey: string
): Promise<number[]> {
  if (!apiKey || references.length === 0) return new Array(references.length).fill(0)

  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: {
            source_sentence: claim.substring(0, 256),
            sentences: references.map((r) => r.substring(0, 256)),
          },
        }),
        signal: AbortSignal.timeout(15000),
      }
    )

    if (!response.ok) return new Array(references.length).fill(0)

    const data = await response.json()
    return data || new Array(references.length).fill(0)
  } catch (error) {
    console.error("[ML] Semantic similarity error:", error)
    return new Array(references.length).fill(0)
  }
}

// OpenAI integration for dual-engine analysis
export async function analyzeWithOpenAI(
  text: string,
  apiKey: string
): Promise<{
  verdict: string
  confidence: number
  reasoning: string
}> {
  if (!apiKey) return { verdict: "UNKNOWN", confidence: 0, reasoning: "" }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert fact-checker and misinformation detector. Analyze the following text and determine if it's likely to be real news, fake news, or misleading.

Respond in JSON format with:
{
  "verdict": "REAL" | "FAKE" | "MISLEADING",
  "confidence": 0-100,
  "reasoning": "Brief explanation"
}`,
          },
          {
            role: "user",
            content: `Analyze this content for credibility:\n\n${text.substring(0, 1500)}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      console.error("[OpenAI] Error:", response.status)
      return { verdict: "UNKNOWN", confidence: 0, reasoning: "" }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) return { verdict: "UNKNOWN", confidence: 0, reasoning: "" }

    try {
      const parsed = JSON.parse(content)
      return {
        verdict: parsed.verdict || "UNKNOWN",
        confidence: parsed.confidence || 0,
        reasoning: parsed.reasoning || "",
      }
    } catch {
      return { verdict: "UNKNOWN", confidence: 0, reasoning: "" }
    }
  } catch (error) {
    console.error("[OpenAI] Analysis error:", error)
    return { verdict: "UNKNOWN", confidence: 0, reasoning: "" }
  }
}

export async function ensembleAnalysis(
  text: string,
  hfKey: string,
  openaiKey: string
): Promise<{
  primary_verdict: string
  confidence_score: number
  hf_result: MLClassificationResult | null
  openai_result: { verdict: string; confidence: number; reasoning: string } | null
  ensemble_reasoning: string
}> {
  const results: {
    primary_verdict: string
    confidence_score: number
    hf_result: MLClassificationResult | null
    openai_result: { verdict: string; confidence: number; reasoning: string } | null
    ensemble_reasoning: string
  } = {
    primary_verdict: "UNVERIFIED",
    confidence_score: 50,
    hf_result: null,
    openai_result: null,
    ensemble_reasoning: "",
  }

  // Run both in parallel
  const [hfResult, openaiResult] = await Promise.all([
    hfKey
      ? classifyWithZeroShot(text, ["fake news", "real news", "misleading"], hfKey)
      : Promise.resolve([]),
    openaiKey ? analyzeWithOpenAI(text, openaiKey) : Promise.resolve(null),
  ])

  // Assign first HF result or null
  results.hf_result = hfResult?.[0] ?? null
  results.openai_result = openaiResult

  const hfLabel = results.hf_result?.label?.toLowerCase() ?? ""
  const hfScore = results.hf_result?.score ?? 0
  const openaiVerdict = results.openai_result?.verdict ?? ""
  const openaiConfidence = results.openai_result?.confidence ?? 0

  // Voting system
  let fakeVotes = 0
  let realVotes = 0

  if (hfLabel.includes("fake")) fakeVotes++
  else if (hfLabel.includes("real")) realVotes++

  if (openaiVerdict === "FAKE") fakeVotes++
  else if (openaiVerdict === "REAL") realVotes++

  // Determine final verdict
  if (fakeVotes > realVotes) results.primary_verdict = "FAKE"
  else if (realVotes > fakeVotes) results.primary_verdict = "REAL"
  else results.primary_verdict = "UNVERIFIED"

  results.confidence_score = Math.round((hfScore * 100 + openaiConfidence) / 2)

  const hfReasoning = results.hf_result
    ? `HF: ${results.hf_result.label} (${(results.hf_result.score * 100).toFixed(0)}%)`
    : ""
  const openaiReasoning = results.openai_result
    ? `OpenAI: ${results.openai_result.verdict} (${results.openai_result.confidence}%)`
    : ""
  results.ensemble_reasoning = `Dual-engine: ${[hfReasoning, openaiReasoning].filter(Boolean).join(" | ")}`

  return results
}
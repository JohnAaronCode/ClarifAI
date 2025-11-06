import { type NextRequest, NextResponse } from "next/server"

// --- MAIN ENTRYPOINT ---
export async function POST(request: NextRequest) {
  try {
    const { content, type } = await request.json()
    if (!content) {
      return NextResponse.json({ error: "No content provided" }, { status: 400 })
    }

    const validationResult = validateContent(content, type)
    if (!validationResult.isValid) {
      return NextResponse.json({
        verdict: "ERROR",
        confidence_score: 0,
        explanation: validationResult.message,
      })
    }

    const analysis = await analyzeContent(content, type)
    return NextResponse.json(analysis)
  } catch (error) {
    console.error("Analysis error:", error)
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 })
  }
}

// --- VALIDATION ---
function validateContent(content: string, type: string): { isValid: boolean; message: string } {
  const trimmed = content.trim()
  const isURL = trimmed.startsWith("http://") || trimmed.startsWith("https://")
  const hasLetters = /[a-zA-Z]/.test(trimmed)

  if (type === "text" && isURL) {
    return { isValid: false, message: "Please enter a valid news article or statement." }
  }

  if (type === "url" && !isURL) {
    return { isValid: false, message: "Please enter a valid URL." }
  }

  if (trimmed.length < 50 || !hasLetters) {
    return { isValid: false, message: "The input does not contain meaningful news content." }
  }

  const wordCount = trimmed.split(/\s+/).length
  const mostlySymbols = trimmed.replace(/[a-zA-Z0-9\s]/g, "").length / trimmed.length > 0.3
  const hasSentenceStructure = /[A-Z][a-z]+\s+[A-Z][a-z]+/.test(trimmed)
  if (wordCount < 5 || mostlySymbols || !hasSentenceStructure) {
    return { isValid: false, message: "Please enter structured and meaningful news content." }
  }

  return { isValid: true, message: "" }
}

// --- CORE ANALYSIS ---
async function analyzeContent(content: string, type: string) {
  const entities = extractEntities(content)
  const sentimentAnalysis = analyzeSentiment(content)
  const sourceAnalysis = analyzeSource(content, type)
  const factChecks = await generateFactChecksWithRealAPIs(content)

  const emotionalScore = sentimentAnalysis.emotionalScore
  const credibilityScore = sourceAnalysis.credibility
  const hasFactCheck = factChecks.length > 0 && factChecks[0].source !== "Source not identified"

  let verdict: "REAL" | "FAKE" | "UNVERIFIED" = "UNVERIFIED"
  let confidence = 50
  let explanation = ""
  let reference = sourceAnalysis.source || ""

  // --- Enhanced Decision Logic ---
  if (hasFactCheck) {
    const bestFact = factChecks[0]
    reference = bestFact.source
    const conclusion = bestFact.conclusion.toLowerCase()

    if (conclusion.includes("true") || conclusion.includes("accurate")) {
      verdict = "REAL"
      confidence = 90
      explanation = "Verified and supported by trusted fact-check sources."
    } else if (conclusion.includes("false") || conclusion.includes("fake")) {
      verdict = "FAKE"
      confidence = 85
      explanation = "Disproved or flagged by verified fact-check sources."
    } else {
      verdict = "UNVERIFIED"
      confidence = 55
      explanation = "Mentioned in sources but without clear verification outcome."
    }
  } else if (credibilityScore >= 0.85 && content.length > 400 && emotionalScore < 0.5) {
    verdict = "REAL"
    confidence = 82
    explanation = "Reported by credible and balanced source with detailed content."
  } else if (credibilityScore < 0.4 && emotionalScore > 0.6) {
    verdict = "FAKE"
    confidence = 80
    explanation = "Low-credibility source with strong emotional tone."
  } else if (credibilityScore < 0.3 || entities.persons.length === 0) {
    verdict = "UNVERIFIED"
    confidence = 45
    explanation = "Lacks credible attribution or clear factual basis."
  } else {
    verdict = "UNVERIFIED"
    confidence = 50
    explanation = "Insufficient data to confirm or refute this claim."
  }

  return {
    verdict,
    confidence_score: confidence,
    explanation,
    reference,
    key_entities: entities,
    sentiment_score: sentimentAnalysis.score,
    sentiment_label: sentimentAnalysis.label,
    source_credibility: credibilityScore,
    source_label: sourceAnalysis.label,
    fact_check_results: factChecks, // ✅ always returned now
  }
}

// --- SENTIMENT ANALYSIS ---
function analyzeSentiment(text: string) {
  const emotionalWords = {
    extreme: ["shocking", "outrageous", "unbelievable", "evil", "exclusive", "breaking"],
    high: ["amazing", "terrible", "urgent", "alarming", "horrific", "disaster"],
    moderate: ["important", "significant", "notable", "remarkable", "developing"],
  }

  const lowerText = text.toLowerCase()
  let emotionalScore = 0

  for (const [level, words] of Object.entries(emotionalWords)) {
    for (const word of words) {
      const occurrences = (lowerText.match(new RegExp(`\\b${word}\\b`, "gi")) || []).length
      emotionalScore +=
        level === "extreme" ? occurrences * 0.2 : level === "high" ? occurrences * 0.1 : occurrences * 0.05
    }
  }

  emotionalScore = Math.min(emotionalScore, 1)
  let label = "Neutral"
  if (emotionalScore > 0.7) label = "Highly emotional"
  else if (emotionalScore > 0.5) label = "Moderately emotional"
  else if (emotionalScore > 0.3) label = "Slightly emotional"

  return { score: emotionalScore, emotionalScore, label }
}

// --- SOURCE DETECTION ---
function analyzeSource(content: string, type: string) {
  const localSources = [
    "rappler.com", "gmanetwork.com", "gma.com", "abs-cbn.com",
    "inquirer.net", "philstar.com", "manilatimes.net", "manilabulletin.net"
  ]
  const internationalSources = [
    "bbc.com", "cnn.com", "reuters.com", "apnews.com", "theguardian.com",
    "nytimes.com", "washingtonpost.com", "bloomberg.com",
    "aljazeera.com", "npr.org", "time.com", "cnbc.com", "foxnews.com"
  ]

  const allTrusted = [...localSources, ...internationalSources]
  const text = content.toLowerCase()
  let detectedSource = ""
  let credibility = 0.5
  let label = "Unable to verify source"

  if (type === "url" || text.startsWith("http")) {
    try {
      const parsed = new URL(content)
      const host = parsed.hostname.replace("www.", "")
      const match = allTrusted.find((domain) => host.includes(domain))

      if (match) {
        detectedSource = parsed.href
        credibility = 0.95
        label = localSources.includes(match)
          ? `🇵🇭 Verified Philippine news outlet: ${match.toUpperCase()}`
          : `🌐 Verified International source: ${match.toUpperCase()}`
      } else {
        detectedSource = parsed.href
        credibility = 0.4
        label = `❌ Unverified or unknown source: ${host}`
      }
    } catch {
      /* ignore invalid URL */
    }
  }

  if (!detectedSource) {
    for (const domain of allTrusted) {
      const name = domain.replace("www.", "").split(".")[0]
      if (text.includes(name)) {
        detectedSource = `https://${domain}`
        credibility = 0.9
        label = localSources.includes(domain)
          ? `🇵🇭 Verified Philippine news outlet: ${name.toUpperCase()}`
          : `🌐 Verified International source: ${name.toUpperCase()}`
        break
      }
    }
  }

  return { credibility, label, source: detectedSource }
}

// --- ENTITY EXTRACTION ---
function extractEntities(text: string) {
  const words = text.split(/\s+/)
  const capitalized = words.filter((w) => /^[A-Z]/.test(w) && w.length > 2)
  return { persons: capitalized.slice(0, 5) }
}

// --- FACT CHECK + NEWSAPI ---
async function generateFactChecksWithRealAPIs(content: string) {
  const googleApiKey = process.env.GOOGLE_FACT_CHECK_API_KEY
  const newsApiKey = process.env.NEWSAPI_KEY
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 10)
  const mainClaim = sentences[0]?.trim() || content.substring(0, 120)

  try {
    if (googleApiKey) {
      const url = `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(mainClaim)}&key=${googleApiKey}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        if (data.claims?.length) {
          return data.claims
            .slice(0, 3)
            .map((c: any) => ({
              claim: c.text,
              conclusion: c.claimReview?.[0]?.textualRating || "Unverified",
              source: c.claimReview?.[0]?.url || "Source not identified",
              relevance: computeRelevance(mainClaim, c.text),
            }))
            .sort((a: any, b: any) => b.relevance - a.relevance)
        }
      }
    }

    if (newsApiKey) {
      const keywords = mainClaim.split(/\s+/).slice(0, 8).join(" ")
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(keywords)}&language=en&sortBy=relevancy&apiKey=${newsApiKey}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        if (data.articles?.length) {
          return data.articles
            .slice(0, 3)
            .map((a: any) => ({
              claim: a.title,
              conclusion: "From reputable source",
              source: a.url,
              relevance: computeRelevance(mainClaim, a.title),
            }))
            .sort((a: any, b: any) => b.relevance - a.relevance)
        }
      }
    }
  } catch (err) {
    console.error("[API] Fact check error:", err)
  }

  return [
    {
      claim: "No verified sources found",
      conclusion: "Please check official media outlets manually",
      source: "Source not identified",
      relevance: 0,
    },
  ]
}

// --- SIMPLE TEXT SIMILARITY (Relevance) ---
function computeRelevance(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\W+/))
  const wordsB = new Set(b.toLowerCase().split(/\W+/))
  const intersection = [...wordsA].filter((w) => wordsB.has(w))
  return intersection.length / Math.max(wordsA.size, wordsB.size)
}

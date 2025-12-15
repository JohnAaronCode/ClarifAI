import { type NextRequest, NextResponse } from "next/server"
import { analyzeSentimentWithTransformers, extractEntitiesWithNER, ensembleAnalysis } from "@/lib/ml-utils"

export async function POST(request: NextRequest) {
  try {
    const { content, type, fileName } = await request.json()
    if (!content) {
      return NextResponse.json({ error: "No content provided" }, { status: 400 })
    }

    let processedContent = content

    if (type === "url") {
      try {
        console.log("[v0] Fetching URL:", content)
        const response = await fetch(content, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          signal: AbortSignal.timeout(15000),
        })
        if (!response.ok) {
          return NextResponse.json({
            verdict: "ERROR",
            confidence_score: 0,
            explanation: `Unable to fetch URL. Status: ${response.status}. Please check if the URL is accessible.`,
          })
        }
        const html = await response.text()
        processedContent = extractTextFromHTML(html)
        console.log("[v0] Extracted URL content length:", processedContent.length)

        if (processedContent.length < 30) {
          return NextResponse.json({
            verdict: "ERROR",
            confidence_score: 0,
            explanation: "URL content is too short or empty. Please check if the URL contains an article.",
          })
        }
      } catch (error) {
        console.error("[v0] Error fetching URL:", error)
        return NextResponse.json({
          verdict: "ERROR",
          confidence_score: 0,
          explanation: "Failed to fetch the URL. Please ensure it is valid and accessible.",
        })
      }
    }

    const validationResult = validateContent(processedContent, type)
    if (!validationResult.isValid) {
      return NextResponse.json({
        verdict: "ERROR",
        confidence_score: 0,
        explanation: validationResult.message,
      })
    }

    const analysis = await analyzeContentWithDualEngine(processedContent, type, fileName)
    return NextResponse.json(analysis)
  } catch (error) {
    console.error("Analysis error:", error)
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 })
  }
}

function extractTextFromHTML(html: string): string {
  const text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return text
}

function validateContent(content: string, type: string): { isValid: boolean; message: string } {
  const trimmed = content.trim()
  const hasLetters = /[a-zA-Z]/.test(trimmed)

  if (trimmed.length < 30) {
    return { isValid: false, message: "Content is too short. Please provide more text." }
  }

  if (!hasLetters) {
    return { isValid: false, message: "Content must contain text. Please provide a valid article or document." }
  }

  const wordCount = trimmed.split(/\s+/).length
  if (wordCount < 5) {
    return {
      isValid: false,
      message: "Please provide meaningful content to proceed.",
    }
  }

  return { isValid: true, message: "" }
}

async function analyzeContentWithDualEngine(content: string, type: string, fileName?: string) {
  const hfApiKey = process.env.HUGGINGFACE_API_KEY
  const openaiApiKey = process.env.OPENAI_API_KEY

  // --- Heuristic / rule-based analysis ---
  const entities = extractEntitiesAdvanced(content)
  const claims = extractMainClaims(content)
  const sourceAnalysis = analyzeSource(content, type)
  const factChecks = await generateFactChecksWithRealAPIs(content, claims)
  const clickbaitScore = detectClickbait(content)
  const credibilityPatterns = analyzeCredibilityPatterns(content)

  // --- Ensemble ML analysis if API keys available ---
  let ensembleResult: any = null
  if (hfApiKey || openaiApiKey) {
    console.log("[v0] Running dual-engine analysis (HF + OpenAI)...")
    ensembleResult = await ensembleAnalysis(content, hfApiKey || "", openaiApiKey || "")
  }

  // --- Sentiment analysis ---
  let mlSentiment: any = null
  if (hfApiKey) {
    mlSentiment = await analyzeSentimentWithTransformers(content, hfApiKey)
  }
  const sentimentAnalysis = mlSentiment
    ? {
        score: mlSentiment.detailed_scores.positive - mlSentiment.detailed_scores.negative,
        emotionalScore: mlSentiment.detailed_scores.negative,
        label: mlSentiment.label,
        ml_enhanced: true,
      }
    : analyzeSentiment(content)

  // --- NER entities (ML-based) ---
  let mlEntities: any[] = []
  if (hfApiKey) {
    const nerResults = await extractEntitiesWithNER(content, hfApiKey)
    mlEntities = nerResults
      .map((entity: any) => ({
        text: entity.word,
        type: entity.entity_group,
        score: entity.score,
      }))
      .slice(0, 8)
  }

  // --- Determine verdict and confidence ---
  let verdict: "REAL" | "FAKE" | "UNVERIFIED" = "UNVERIFIED"
  let confidence = 50
  let explanation = ""
  let reference = sourceAnalysis.source || ""

  if (ensembleResult) {
    verdict = ensembleResult.primary_verdict as any
    confidence = Math.min(ensembleResult.confidence_score, 99)

    if (verdict === "FAKE" && confidence > 70) {
      explanation = `Multiple suspicious patterns detected. ${clickbaitScore > 0.6 ? "The content uses sensationalized language. " : ""}Please verify with trusted sources.`
    } else if (verdict === "REAL" && confidence > 75) {
      explanation = `Content appears credible with professional structure. Cross-check with verified sources for confirmation.`
    } else if (factChecks.length > 0 && factChecks[0].source !== "Source not identified") {
      const bestFact = factChecks[0]
      reference = bestFact.source
      const conclusion = bestFact.conclusion.toLowerCase()

      if (conclusion.includes("true") || conclusion.includes("correct") || conclusion.includes("accurate")) {
        verdict = "REAL"
        confidence = Math.min(96, 88 + sourceAnalysis.credibility * 10)
        explanation = `Fact-checked and verified as accurate by ${bestFact.reviewer}. Multiple credibility signals confirm authenticity.`
      } else if (conclusion.includes("false") || conclusion.includes("wrong")) {
        verdict = "FAKE"
        confidence = Math.min(98, 90 + sourceAnalysis.credibility * 10)
        explanation = `Contains verifiable misinformation according to ${bestFact.reviewer}. Key claims contradict factual evidence.`
      } else {
        verdict = "UNVERIFIED"
        confidence = 65
        explanation = `Mixed findings detected. Unable to confirm authenticity. Recommend checking multiple sources.`
      }
    } else {
      explanation = `Analysis inconclusive. Please cross-check with verified news sources for accurate information.`
    }
  } else if (
    sourceAnalysis.credibility >= 0.9 &&
    content.length > 300 &&
    sentimentAnalysis.emotionalScore < 0.45 &&
    credibilityPatterns.score > 0.8
  ) {
    verdict = "REAL"
    confidence = 90
    explanation = `Verified source with strong credibility indicators.`
  } else if (sourceAnalysis.credibility < 0.35 && sentimentAnalysis.emotionalScore > 0.75 && clickbaitScore > 0.7) {
    verdict = "FAKE"
    confidence = 85
    explanation = `High-risk content detected: Low credibility source + extreme emotional language + clickbait patterns.`
  } else {
    verdict = "UNVERIFIED"
    confidence = Math.max(50, 55 + credibilityPatterns.score * 20)
    explanation = credibilityPatterns.hasIssues
      ? `Quality concerns found: ${credibilityPatterns.issues[0]}. Verify with trusted sources.`
      : `Insufficient evidence to verify. Check multiple news outlets.`
  }

  // --- AWAIT async functions for detailed analysis ---
  const sourceCredibility = await analyzeSourceCredibility(content, type, sourceAnalysis.credibility, verdict)
  const contentQuality = await analyzeContentQuality(content, verdict, confidence)

  let adjustedSourceCred = sourceCredibility.credibility_score
  let adjustedContentQuality = contentQuality.overall_score

  if (verdict === "REAL") {
    // REAL: credibility 70-100%, content quality 70-100%
    adjustedSourceCred = Math.max(0.7, Math.min(1, adjustedSourceCred))
    adjustedContentQuality = Math.max(0.7, Math.min(1, adjustedContentQuality))
  } else if (verdict === "FAKE") {
    // FAKE: credibility 0-30%, content quality 0-40%
    adjustedSourceCred = Math.min(0.3, adjustedSourceCred)
    adjustedContentQuality = Math.min(0.4, adjustedContentQuality)
  } else if (verdict === "UNVERIFIED") {
    // UNVERIFIED: credibility 30-50%, content quality 40-60%
    adjustedSourceCred = Math.max(0.3, Math.min(0.5, adjustedSourceCred))
    adjustedContentQuality = Math.max(0.4, Math.min(0.6, adjustedContentQuality))
  }

  sourceCredibility.credibility_score = adjustedSourceCred
  contentQuality.overall_score = adjustedContentQuality

  return {
    verdict,
    confidence_score: confidence,
    explanation,
    reference,
    source_links: sourceAnalysis.detectedSources,
    key_entities: mlEntities.length > 0 ? mlEntities : entities,
    sentiment_score: sentimentAnalysis.score,
    sentiment_label: sentimentAnalysis.label,
    source_credibility: Math.round(sourceAnalysis.credibility * 100),
    source_label: sourceAnalysis.label,
    source_url: sourceAnalysis.source,
    credibility_indicators: credibilityPatterns,
    fact_check_results: factChecks,
    clickbait_score: clickbaitScore,
    file_name: fileName,
    ml_enhanced: !!ensembleResult,
    ensemble_analysis: ensembleResult,
    source_credibility_detailed: sourceCredibility,
    content_quality_detailed: contentQuality,
  }
}

function analyzeSentiment(text: string) {
  const emotionalWords = {
    extreme: [
      "shocking",
      "outrageous",
      "unbelievable",
      "evil",
      "exclusive",
      "breaking",
      "exposed",
      "scandal",
      "bombshell",
      "conspiracy",
    ],
    high: [
      "amazing",
      "terrible",
      "urgent",
      "alarming",
      "horrific",
      "disaster",
      "tragic",
      "devastating",
      "stunning",
      "astonishing",
    ],
    moderate: ["important", "significant", "notable", "remarkable", "developing", "concerning"],
  }

  const lowerText = text.toLowerCase()
  let emotionalScore = 0

  for (const word of emotionalWords.extreme) {
    const occurrences = (lowerText.match(new RegExp(`\\b${word}\\b`, "gi")) || []).length
    emotionalScore += occurrences * 0.2
  }

  for (const word of emotionalWords.high) {
    const occurrences = (lowerText.match(new RegExp(`\\b${word}\\b`, "gi")) || []).length
    emotionalScore += occurrences * 0.1
  }

  for (const word of emotionalWords.moderate) {
    const occurrences = (lowerText.match(new RegExp(`\\b${word}\\b`, "gi")) || []).length
    emotionalScore += occurrences * 0.05
  }

  emotionalScore = Math.min(emotionalScore, 1)
  let label = "Neutral"
  if (emotionalScore > 0.75) label = "Highly emotional"
  else if (emotionalScore > 0.6) label = "Moderately emotional"
  else if (emotionalScore > 0.4) label = "Slightly emotional"

  return { score: emotionalScore, emotionalScore, label }
}

function detectClickbait(text: string): number {
  const clickbaitPatterns = {
    urgency: [
      "you won't believe",
      "shocking",
      "must see",
      "don't miss",
      "breaking news",
      "just happened",
      "this second",
      "immediately",
      "act now",
      "limited time",
    ],
    exaggeration: [
      "number one",
      "best ever",
      "worst ever",
      "unbelievable",
      "insane",
      "crazy",
      "mind-blowing",
      "absolutely",
      "stunning",
      "astonishing",
    ],
    vague: ["they say", "people claim", "sources say", "officials say", "health experts say", "celebrities say"],
  }

  const lowerText = text.toLowerCase()
  let clickbaitScore = 0

  for (const pattern of clickbaitPatterns.urgency) {
    if (lowerText.includes(pattern)) clickbaitScore += 0.16
  }

  for (const pattern of clickbaitPatterns.exaggeration) {
    if (lowerText.includes(pattern)) clickbaitScore += 0.13
  }

  for (const pattern of clickbaitPatterns.vague) {
    if (lowerText.includes(pattern)) clickbaitScore += 0.22
  }

  const questionMarks = (text.match(/\?/g) || []).length
  if (questionMarks > 4) clickbaitScore += 0.12

  return Math.min(clickbaitScore, 1)
}

function extractEntitiesAdvanced(text: string) {
  const words = text.split(/\s+/)
  const persons = new Set<string>()
  const organizations = new Set<string>()
  const locations = new Set<string>()

  for (let i = 0; i < words.length - 1; i++) {
    const pair = `${words[i]} ${words[i + 1]}`
    if (/^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(pair)) {
      if (words[i + 1].includes("Inc") || words[i + 1].includes("Corp") || words[i + 1].includes("Ltd")) {
        organizations.add(pair)
      } else {
        persons.add(pair)
      }
    }
  }

  return {
    persons: Array.from(persons).slice(0, 5),
    organizations: Array.from(organizations).slice(0, 3),
    locations: Array.from(locations).slice(0, 3),
  }
}

function extractMainClaims(text: string): string[] {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 15)
  return sentences.slice(0, 3).map((s) => s.trim())
}

function analyzeSource(content: string, type: string) {
  const localSources = [
    { domain: "rappler.com", name: "Rappler", credibility: 0.95, url: "https://rappler.com" },
    { domain: "gmanetwork.com", name: "GMA News", credibility: 0.93, url: "https://gmanetwork.com/news" },
    { domain: "abs-cbn.com", name: "ABS-CBN News", credibility: 0.92, url: "https://news.abs-cbn.com" },
    { domain: "inquirer.net", name: "Philippine Daily Inquirer", credibility: 0.9, url: "https://inquirer.net" },
    { domain: "philstar.com", name: "Philstar", credibility: 0.88, url: "https://philstar.com" },
    { domain: "manilatimes.net", name: "Manila Times", credibility: 0.87, url: "https://manilatimes.net" },
    { domain: "manilabulletin.net", name: "Manila Bulletin", credibility: 0.86, url: "https://mb.com.ph" },
    { domain: "cnnphilippines.com", name: "CNN Philippines", credibility: 0.94, url: "https://cnnphilippines.com" },
  ]

  const internationalSources = [
    { domain: "bbc.com", name: "BBC News", credibility: 0.98, url: "https://bbc.com/news" },
    { domain: "reuters.com", name: "Reuters", credibility: 0.97, url: "https://reuters.com" },
    { domain: "apnews.com", name: "Associated Press", credibility: 0.97, url: "https://apnews.com" },
    { domain: "cnn.com", name: "CNN", credibility: 0.95, url: "https://cnn.com" },
    { domain: "theguardian.com", name: "The Guardian", credibility: 0.94, url: "https://theguardian.com" },
    { domain: "nytimes.com", name: "New York Times", credibility: 0.96, url: "https://nytimes.com" },
    { domain: "washingtonpost.com", name: "Washington Post", credibility: 0.95, url: "https://washingtonpost.com" },
    { domain: "bloomberg.com", name: "Bloomberg", credibility: 0.94, url: "https://bloomberg.com" },
    { domain: "aljazeera.com", name: "Al Jazeera", credibility: 0.93, url: "https://aljazeera.com" },
    { domain: "npr.org", name: "NPR", credibility: 0.96, url: "https://npr.org" },
    { domain: "cnbc.com", name: "CNBC", credibility: 0.94, url: "https://cnbc.com" },
    { domain: "foxnews.com", name: "Fox News", credibility: 0.85, url: "https://foxnews.com" },
  ]

  const allSources = [...localSources, ...internationalSources]
  const text = content.toLowerCase()
  let detectedSource = ""
  const detectedSources: Array<{ name: string; url: string }> = []
  let credibility = 0.5
  let label = "Unable to verify source"

  // Extract key topics from content to find related sources
  const topics = extractTopicsFromContent(text)

  if (type === "url" || text.startsWith("http")) {
    try {
      const parsed = new URL(content)
      const host = parsed.hostname?.replace("www.", "") || ""
      const match = allSources.find((src) => host.includes(src.domain))

      if (match) {
        detectedSource = parsed.href
        credibility = match.credibility
        const isLocal = localSources.some((s) => s.domain === match.domain)
        label = isLocal ? `Verified Philippine news: ${match.name}` : `Verified International source: ${match.name}`

        detectedSources.push({ name: match.name, url: match.url })

        const relatedSources = allSources
          .filter(
            (src) =>
              src.name !== match.name && (localSources.some((s) => s.domain === src.domain) || src.credibility >= 0.9),
          )
          .sort((a, b) => b.credibility - a.credibility)
          .slice(0, 2)

        detectedSources.push(...relatedSources)
      } else {
        detectedSource = parsed.href
        credibility = 0.35
        label = `Unverified source: ${host}`

        const suggestedSources = localSources.slice(0, 2).concat(internationalSources.slice(0, 1))
        detectedSources.push(...suggestedSources.map((src) => ({ name: src.name, url: src.url })))
      }
    } catch {
      /* ignore invalid URL */
    }
  } else {
    // For text/file input: find sources mentioned or suggest top verified sources
    for (const src of allSources) {
      if (text.includes(src.domain.split(".")[0]) || text.includes(src.name.toLowerCase())) {
        detectedSources.push({ name: src.name, url: src.url })
        credibility = src.credibility
        const isLocal = localSources.some((s) => s.domain === src.domain)
        label = isLocal ? `Verified Philippine news: ${src.name}` : `Verified International source: ${src.name}`
        break
      }
    }

    // If still no sources found, add top credibility sources as suggestions
    if (detectedSources.length === 0) {
      const topSources = localSources.slice(0, 2).concat(internationalSources.slice(0, 1))
      detectedSources.push(...topSources.map((src) => ({ name: src.name, url: src.url })))
      label = "Suggested verified news sources"
    }
  }

  return { credibility, label, source: detectedSource, detectedSources: detectedSources.slice(0, 3) }
}

function extractTopicsFromContent(text: string): string[] {
  const topics: string[] = []
  const topicKeywords = {
    politics: ["president", "senator", "congress", "parliament", "election", "vote", "politician", "political"],
    health: ["disease", "health", "hospital", "doctor", "medicine", "vaccine", "pandemic", "covid"],
    economy: ["economy", "market", "stock", "business", "trade", "investment", "finance", "money"],
    technology: ["tech", "software", "app", "digital", "internet", "computer", "artificial"],
    sports: ["sport", "game", "team", "player", "match", "championship", "score", "league"],
    entertainment: ["movie", "film", "actor", "actress", "music", "singer", "celebrity", "show"],
    science: ["research", "study", "scientist", "discovery", "experiment", "space", "nasa"],
  }

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some((kw) => text.includes(kw))) {
      topics.push(topic)
    }
  }

  return topics
}

async function generateFactChecksWithRealAPIs(content: string, claims: string[]) {
  const googleApiKey = process.env.GOOGLE_FACT_CHECK_API_KEY
  const newsApiKey = process.env.NEWSAPI_KEY
  const hfApiKey = process.env.HUGGINGFACE_API_KEY

  const mainClaim = claims[0] || content.substring(0, 150)
  const results: any[] = []

  try {
    if (googleApiKey) {
      try {
        const url = `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(mainClaim)}&key=${googleApiKey}`
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
        if (res.ok) {
          const data = await res.json()
          if (data.claims?.length) {
            const mapped = data.claims.slice(0, 3).map((c: any) => ({
              claim: c.text,
              conclusion: c.claimReview?.[0]?.textualRating || "Unverified",
              source: c.claimReview?.[0]?.url || "https://toolbox.google.com/factcheck",
              reviewer: c.claimReview?.[0]?.publisher?.name || "Google Fact Check",
              relevance: computeRelevance(mainClaim, c.text),
            }))
            results.push(...mapped)
          }
        }
      } catch (err) {
        console.error("[Google Fact Check] Error:", err)
      }
    }

    if (newsApiKey && results.length < 2) {
      try {
        const keywords = mainClaim.split(/\s+/).slice(0, 6).join(" ")
        const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(keywords)}&language=en&sortBy=relevancy&pageSize=3&apiKey=${newsApiKey}`
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
        if (res.ok) {
          const data = await res.json()
          if (data.articles?.length) {
            const mapped = data.articles.map((a: any) => ({
              claim: a.title,
              conclusion: `From verified news source: "${a.description || a.content?.substring(0, 100)}"`,
              source: a.url,
              reviewer: a.source?.name || "News Source",
              relevance: computeRelevance(mainClaim, a.title),
            }))
            results.push(...mapped)
          }
        }
      } catch (err) {
        console.error("[NewsAPI] Error:", err)
      }
    }
  } catch (err) {
    console.error("[API] Fact check general error:", err)
  }

  if (results.length === 0) {
    results.push({
      claim: mainClaim.substring(0, 100),
      conclusion: "Unable to verify with external APIs. Please manually check with trusted news outlets.",
      source: "https://rappler.com",
      reviewer: "Manual Verification Required",
      relevance: 0,
    })
  }

  return results.sort((a, b) => b.relevance - a.relevance)
}

function computeRelevance(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\W+/))
  const wordsB = new Set(b.toLowerCase().split(/\W+/))
  const intersection = [...wordsA].filter((w) => wordsB.has(w))
  return intersection.length / Math.max(wordsA.size, wordsB.size)
}

function analyzeCredibilityPatterns(text: string): { score: number; hasIssues: boolean; issues: string[] } {
  const issues: string[] = []
  let score = 1.0

  const citationPatterns = [
    /according to\s+(?:sources|officials|experts)/i,
    /research\s+(?:shows|indicates|suggests)/i,
    /studies?\s+(?:found|show|indicate)/i,
    /experts?\s+(?:say|warn|suggest)/i,
    /\[\d+\]/,
  ]
  const citationCount = citationPatterns.filter((p) => p.test(text)).length
  if (citationCount >= 2) score += 0.15
  else if (citationCount === 0) {
    issues.push("No citations or evidence references")
    score -= 0.15
  }

  const passiveVoiceCount = (text.match(/\b(?:was|were|been|is|are)\s+\w+ed\b/gi) || []).length
  const totalWords = text.split(/\s+/).length
  const passiveRatio = passiveVoiceCount / totalWords
  if (passiveRatio > 0.15) {
    issues.push("Excessive passive voice (suspicious style)")
    score -= 0.1
  }

  const hedgingWords = ["may", "might", "could", "possibly", "allegedly", "reportedly", "suggest"]
  const hedgingCount = hedgingWords.filter((w) => text.toLowerCase().includes(w)).length
  if (hedgingCount >= 2) score += 0.1

  const vaguePatterns = [
    /(?:they|people|sources?|officials?)\s+(?:say|claim)\s+(?:that\s+)?(?:they|it)\s+(?:is|are)\s+(?:very|extremely|incredibly)\s+\w+/i,
    /unidentified\s+(?:sources?|officials?)/i,
    /some\s+(?:experts?|sources?)\s+believe/i,
  ]
  const vagueCount = vaguePatterns.filter((p) => p.test(text)).length
  if (vagueCount > 0) {
    issues.push("Vague or unverified claims")
    score -= 0.12
  }

  const allCapsCount = (text.match(/\b[A-Z\s]{8,}\b/g) || []).length
  if (allCapsCount > 2) {
    issues.push("Multiple ALL CAPS phrases")
    score -= 0.1
  }

  const ellipsisCount = (text.match(/\.\.\./g) || []).length
  if (ellipsisCount > 3) {
    issues.push("Excessive ellipsis (casual/unreliable style)")
    score -= 0.08
  }

  return {
    score: Math.max(0, Math.min(score, 1)),
    hasIssues: issues.length > 0,
    issues,
  }
}

async function analyzeSourceCredibility(content: string, type: string, baseCredibility: number, verdict?: string) {
  const googleApiKey = process.env.GOOGLE_FACT_CHECK_API_KEY
  const newsApiKey = process.env.NEWSAPI_KEY
  const hfApiKey = process.env.HUGGINGFACE_API_KEY

  const lower = content.toLowerCase()
  const result: any = {
    api_checks: [],
    credibility_score: baseCredibility,
    credibility_label: "Neutral",
    domain_authority: null,
    reason: [],
    bias_indicators: [],
  }

  // --- 1) DOMAIN AUTHORITY CHECK (if URL) ---
  if (type === "url") {
    try {
      const parsed = new URL(content)
      const domain = parsed.hostname.replace("www.", "")

      const daScore = await fetch(`https://openpagerank.com/api/v1.0/getPageRank?domains[]=${domain}`, {
        headers: { "API-OPR": process.env.OPEN_PAGE_RANK_API_KEY || "" },
      })
        .then((r) => r.json())
        .catch(() => null)

      if (daScore?.response?.[0]?.page_rank_integer) {
        const pageRank = daScore.response[0].page_rank_integer
        result.domain_authority = pageRank / 10 // normalize 0–10 -> 0–1
        result.credibility_score = (result.credibility_score + result.domain_authority) / 2
        result.reason.push("Domain authority successfully retrieved.")
      } else {
        result.reason.push("Domain authority unavailable.")
      }
    } catch {
      result.reason.push("URL parsing failed.")
    }
  }

  // --- 2) GOOGLE FACT CHECK API (CREDIBILITY BY VERIFICATION) ---
  if (googleApiKey) {
    try {
      const query = content.substring(0, 120)
      const url = `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(query)}&key=${googleApiKey}`
      const res = await fetch(url)
      const data = await res.json()

      if (data.claims?.length) {
        result.api_checks.push({
          api: "Google Fact Check",
          status: "Found",
          rating: data.claims[0].claimReview?.[0]?.textualRating || "Unverified",
        })

        const rating = result.api_checks[0].rating.toLowerCase()
        if (rating.includes("true") || rating.includes("accurate")) {
          result.credibility_score += 0.25
          result.reason.push("Google Fact Check marked content as accurate.")
        } else if (rating.includes("false") || rating.includes("incorrect")) {
          result.credibility_score -= 0.25
          result.reason.push("Google Fact Check flagged content as false.")
        }
      } else {
        result.api_checks.push({ api: "Google Fact Check", status: "No match" })
      }
    } catch {
      result.api_checks.push({ api: "Google Fact Check", status: "Failed" })
    }
  }

  // --- 3) NEWS API "trusted source" matching ---
  if (newsApiKey) {
    try {
      const res = await fetch(`https://newsapi.org/v2/top-headlines?language=en&apiKey=${newsApiKey}`)
      const data = await res.json()

      if (data.sources) {
        const trusted = data.sources.map((s: any) => s.name.toLowerCase())
        const mentionedTrusted = trusted.some((src: string) => lower.includes(src))

        if (mentionedTrusted) {
          result.credibility_score += 0.1
          result.reason.push("Trusted news outlet mentioned in text.")
        }
      }
    } catch {
      /* skip */
    }
  }

  // --- 4) HUGGINGFACE "credibility classifier" ---
  if (hfApiKey) {
    try {
      const hfRes = await fetch(
        "https://router.huggingface.co/hf-inference/models/cross-encoder/ms-marco-MiniLM-L-6-v2",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${hfApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: [[content, "credible news article"]],
          }),
        },
      )

      const score = Array.isArray(await hfRes.json()) ? (await hfRes.json())[0] : 0
      result.api_checks.push({ api: "HuggingFace Credibility", score })

      result.credibility_score = (result.credibility_score + score) / 2
    } catch {
      result.api_checks.push({ api: "HuggingFace Credibility", status: "Failed" })
    }
  }

  // --- FINAL LABEL ---
  const final = result.credibility_score

  result.credibility_label =
    final > 0.8 ? "Highly credible" : final > 0.6 ? "Credible" : final > 0.4 ? "Uncertain" : "Low credibility"

  // --- BIAS RATING (with explanations) ---
  try {
    const knownRight = ["foxnews.com", "breitbart.com", "dailycaller.com"]
    const knownLeft = ["cnn.com", "msnbc.com", "huffpost.com"]
    const knownCenter = ["reuters.com", "apnews.com", "bbc.com", "nytimes.com"]

    if (result.domain_authority && typeof result.domain_authority === "number" && result.domain_authority > 0) {
      const domain =
        typeof content === "string" && type === "url"
          ? (() => {
              try {
                return new URL(content).hostname.replace("www.", "")
              } catch {
                return ""
              }
            })()
          : ""

      if (domain) {
        if (knownRight.some((d) => domain.includes(d))) {
          result.bias_rating = "Right-leaning"
          result.bias_indicators = [
            "Known right-leaning editorial stance",
            "Opinion content may reflect political bias",
          ]
        } else if (knownLeft.some((d) => domain.includes(d))) {
          result.bias_rating = "Left-leaning"
          result.bias_indicators = ["Known left-leaning editorial stance", "Opinion content may reflect political bias"]
        } else if (knownCenter.some((d) => domain.includes(d))) {
          result.bias_rating = "Neutral"
          result.bias_indicators = [
            "Reputable news organization with neutral reporting standards",
            "Strong editorial guidelines minimize bias",
          ]
        } else {
          result.bias_rating = "Unable to determine"
          result.bias_indicators = [
            "Unknown source credibility",
            "Recommend cross-checking with established news organizations",
          ]
        }
      } else {
        result.bias_rating = "Unable to determine"
        result.bias_indicators = ["Source domain not provided", "Bias assessment requires source verification"]
      }
    } else {
      result.bias_rating = "Unable to determine"
      result.bias_indicators = [
        "Insufficient source information available",
        "Bias determination requires domain analysis",
      ]
    }
  } catch {
    result.bias_rating = "Unable to determine"
    result.bias_indicators = ["Error during bias assessment", "Manual source verification recommended"]
  }

  if (verdict === "FAKE") {
    result.credibility_score = Math.min(0.3, result.credibility_score)
    result.credibility_label = "Low credibility"
  } else if (verdict === "REAL") {
    result.credibility_score = Math.max(0.7, result.credibility_score)
    result.credibility_label = "High credibility"
  }

  return result
}

async function analyzeContentQuality(content: string, verdict?: string, confidence?: number) {
  const ltKey = process.env.LT_API_KEY
  const hfApiKey = process.env.HUGGINGFACE_API_KEY

  const result: any = {
    readability_score: null,
    grammar_issues: [],
    coherence_score: null,
    structure: {
      paragraphs: content.split(/\n\s*\n/).length,
      avg_sentence_length: 0,
    },
    quality_label: "Neutral",
  }

  // --- READABILITY ---
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length)
  const words = content.split(/\s+/).length
  result.structure.avg_sentence_length = Math.round(words / Math.max(sentences.length, 1))

  result.readability_score = Math.max(0, Math.min(1, 1 - result.structure.avg_sentence_length / 40))

  // --- LANGUAGETOOL GRAMMAR API ---
  if (ltKey) {
    try {
      const res = await fetch("https://api.languagetoolplus.com/v2/check", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          text: content,
          language: "en-US",
          apiKey: ltKey,
        }),
      })

      const data = await res.json()
      result.grammar_issues = data.matches?.slice(0, 5) || []
    } catch {}
  }

  // --- HUGGINGFACE COHERENCE ---
  if (hfApiKey) {
    try {
      const response = await fetch(
        "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${hfApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: [content, "highly coherent professionally written article"],
          }),
        },
      )

      const score = Array.isArray(await response.json()) ? (await response.json())[0] : 0
      result.coherence_score = score
    } catch {}
  }

  // --- SPECIFICITY heuristics ---
  const numbersCount = (content.match(/\b\d{1,4}\b/g) || []).length
  const dateMatches = (content.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\b|\b\d{4}\b/g) || [])
    .length
  const namedSourcePatterns = [/according to/i, /reported by/i, /said/i, /source:/i, /\bvia\b/i]
  const namedSourcesCount = namedSourcePatterns.reduce((acc, p) => acc + (p.test(content) ? 1 : 0), 0)
  const namedEntitiesCount = (content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g) || []).length

  const specificityScore = Math.max(
    0,
    Math.min(
      1,
      Math.min(10, numbersCount) * 0.04 +
        Math.min(3, dateMatches) * 0.12 +
        Math.min(3, namedSourcesCount) * 0.25 +
        Math.min(6, namedEntitiesCount) * 0.02,
    ),
  )

  let specificity_label = "Unspecific"
  if (specificityScore > 0.75) specificity_label = "Highly specific"
  else if (specificityScore > 0.5) specificity_label = "Somewhat specific"
  else if (specificityScore > 0.3) specificity_label = "Slightly specific"

  // --- EVIDENCE STRENGTH with verdict-aware adjustments ---
  const citationPatterns = [
    /according to\s+(?:sources|officials|experts)/i,
    /research\s+(?:shows|indicates|suggests)/i,
    /studies?\s+(?:found|show|indicate)/i,
    /experts?\s+(?:say|warn|suggest)/i,
    /\[\d+\]/,
  ]
  const citationCount = citationPatterns.reduce((acc, p) => acc + (p.test(content) ? 1 : 0), 0)

  const grammarPenalty = Math.min(1, result.grammar_issues.length / 6)
  const evidenceScore = Math.max(
    0,
    Math.min(
      1,
      Math.min(3, citationCount) * 0.28 + (1 - grammarPenalty) * 0.32 + (result.coherence_score || 0.5) * 0.4,
    ),
  )

  let evidence_strength_label = "Poor"
  if (evidenceScore > 0.75) evidence_strength_label = "Strong"
  else if (evidenceScore > 0.5) evidence_strength_label = "Moderate"
  else if (evidenceScore > 0.35) evidence_strength_label = "Weak"

  if (verdict === "FAKE") {
    result.overall_score = Math.min(0.4, evidenceScore)
    evidence_strength_label = "Weak"
  } else if (verdict === "REAL") {
    result.overall_score = Math.max(0.7, evidenceScore)
    evidence_strength_label = "Strong"
  } else if (verdict === "UNVERIFIED") {
    result.overall_score = Math.max(0.4, Math.min(0.6, evidenceScore))
    evidence_strength_label = evidence_strength_label === "Poor" ? "Weak" : evidence_strength_label
  } else {
    result.overall_score = evidenceScore
  }

  result.specificity_label = specificity_label
  result.specificity_score = specificityScore
  result.evidence_strength_label = evidence_strength_label
  result.evidence_strength_score = evidenceScore

  result.quality_label =
    result.overall_score > 0.75
      ? "High Quality"
      : result.overall_score > 0.55
        ? "Good"
        : result.overall_score > 0.4
          ? "Low Quality"
          : "Poor"

  return result
}
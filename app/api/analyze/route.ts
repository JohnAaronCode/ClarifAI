import { type NextRequest, NextResponse } from "next/server"
import { ensembleAnalysis } from "@/lib/ml-utils"

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

    const analysis = await analyzeContentWithDualEngine(processedContent, type, fileName, content)
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

function detectMeaninglessContent(content: string): { isMeaningless: boolean; reason: string; score: number } {
  const trimmed = content.trim()
  const words = trimmed.toLowerCase().split(/\s+/).filter((w) => w.length > 0)
  const sentences = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0)

  let meaningfulnessScore = 100

  const punctuationRatio = (trimmed.match(/[!?]{2,}|\.{2,}/g) || []).length * 5
  if (punctuationRatio > 20) meaningfulnessScore -= 30

  const oddCapitalizations = (trimmed.match(/[a-z][A-Z][a-z]/g) || []).length
  if (oddCapitalizations > words.length * 0.2) meaningfulnessScore -= 25

  const avgSentenceLength = words.length / Math.max(sentences.length, 1)
  if (avgSentenceLength < 3 && words.length > 20) meaningfulnessScore -= 20

  const fillerWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'to', 'of', 'in', 'at', 'on', 'by'])
  let fillerCount = 0
  for (const word of words) {
    if (fillerWords.has(word)) fillerCount++
  }
  const fillerRatio = fillerCount / words.length
  if (fillerRatio > 0.5) meaningfulnessScore -= 25

  const spamPhrases = [
    'best', 'amazing', 'incredible', 'absolutely', 'definitely', 'certainly',
    'extremely', 'very', 'really', 'so', 'most', 'must', 'should', 'would'
  ]
  const lowercaseContent = trimmed.toLowerCase()
  let superlativeCount = 0
  for (const phrase of spamPhrases) {
    superlativeCount += (lowercaseContent.match(new RegExp(phrase, 'g')) || []).length
  }
  if (superlativeCount > words.length * 0.15) meaningfulnessScore -= 20

  const nonsensePatterns = (trimmed.match(/([a-z])\1{2,}/g) || []).length
  if (nonsensePatterns > 5) meaningfulnessScore -= 30

  const randomSpecialChars = (trimmed.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{2,}/g) || []).length
  if (randomSpecialChars > 3) meaningfulnessScore -= 25

  const uppercase = (trimmed.match(/[A-Z]/g) || []).length
  const lowercase = (trimmed.match(/[a-z]/g) || []).length
  if (uppercase === 0 || lowercase === 0) meaningfulnessScore -= 15

  const transitionWords = [
    'however', 'therefore', 'thus', 'meanwhile', 'furthermore', 'moreover',
    'consequently', 'accordingly', 'subsequently', 'likewise', 'similarly',
    'instead', 'otherwise', 'rather', 'namely', 'indeed', 'also', 'because'
  ]
  const transitionCount = transitionWords.filter(word => lowercaseContent.includes(word)).length
  if (transitionCount === 0 && words.length > 100) meaningfulnessScore -= 10

  const uniqueWords = new Set(words)
  const diversityRatio = uniqueWords.size / words.length
  if (diversityRatio < 0.3) meaningfulnessScore -= 15

  meaningfulnessScore = Math.max(0, Math.min(100, meaningfulnessScore))

  if (meaningfulnessScore < 30) {
    return {
      isMeaningless: true,
      reason: "Content appears to be random, nonsensical, or gibberish. Please provide meaningful, coherent text for analysis.",
      score: meaningfulnessScore
    }
  }

  return { isMeaningless: false, reason: "", score: meaningfulnessScore }
}

function detectRepetitiveContent(content: string): { isRepetitive: boolean; reason: string } {
  const words = content.toLowerCase().split(/\s+/).filter((w) => w.length > 0)
  const uniqueWords = new Set(words)
  const uniqueRatio = uniqueWords.size / words.length

  if (uniqueRatio < 0.4) {
    return { isRepetitive: true, reason: "Content appears to be repetitive or spammy. Unique word ratio is too low." }
  }

  const wordFreq = new Map<string, number>()
  for (const word of words) {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
  }

  let maxFreq = 0
  let maxWord = ""
  for (const [word, freq] of wordFreq.entries()) {
    if (freq > maxFreq && word.length > 2) {
      maxFreq = freq
      maxWord = word
    }
  }

  if (maxFreq > 0 && maxFreq / words.length > 0.3) {
    return { isRepetitive: true, reason: `Content is overly repetitive with the word "${maxWord}" appearing excessively.` }
  }

  const phrases = new Set<string>()
  const repeatedPhrases = new Set<string>()
  const windowSize = 3
  for (let i = 0; i < words.length - windowSize + 1; i++) {
    const phrase = words.slice(i, i + windowSize).join(" ")
    if (phrases.has(phrase)) repeatedPhrases.add(phrase)
    phrases.add(phrase)
  }

  if (repeatedPhrases.size > words.length / 20) {
    return { isRepetitive: true, reason: "Content contains excessive phrase repetition, suggesting fabricated or template-based text." }
  }

  return { isRepetitive: false, reason: "" }
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
    return { isValid: false, message: "Please provide meaningful content to proceed." }
  }

  const meaningfulnessCheck = detectMeaninglessContent(trimmed)
  if (meaningfulnessCheck.isMeaningless) {
    return { isValid: false, message: meaningfulnessCheck.reason }
  }

  // Skip repetition check for URL-fetched content — extracted HTML is naturally
  // repetitive (nav bars, footers, repeated headings). Only check raw pasted text.
  if (type !== "url") {
    const repetitionCheck = detectRepetitiveContent(trimmed)
    if (repetitionCheck.isRepetitive) {
      return { isValid: false, message: repetitionCheck.reason }
    }
  }

  return { isValid: true, message: "" }
}

// Build a source search URL with clean encoding (spaces as +, not %20)
function buildSourceSearchUrl(sourceDomain: string, query: string): string {
  // Use + for spaces — most search engines handle this better than %20
  const clean = query.substring(0, 80).trim()
  const encoded = clean.split(/\s+/).map(encodeURIComponent).join("+")

  const searchUrlMap: Record<string, string> = {
    "rappler.com":        `https://www.rappler.com/search?q=${encoded}`,
    "gmanetwork.com":     `https://www.gmanetwork.com/news/search?q=${encoded}`,
    "abs-cbn.com":        `https://news.abs-cbn.com/search?q=${encoded}`,
    "inquirer.net":       `https://www.inquirer.net/search?q=${encoded}`,
    "philstar.com":       `https://www.philstar.com/search?q=${encoded}`,
    "manilatimes.net":    `https://www.manilatimes.net/search?q=${encoded}`,
    "mb.com.ph":          `https://mb.com.ph/search?s=${encoded}`,
    "cnnphilippines.com": `https://www.cnnphilippines.com/search?q=${encoded}`,
    "bbc.com":            `https://www.bbc.co.uk/search?q=${encoded}`,
    "reuters.com":        `https://www.reuters.com/search/news?blob=${encoded}`,
    "apnews.com":         `https://apnews.com/search?q=${encoded}`,
    "cnn.com":            `https://edition.cnn.com/search?q=${encoded}`,
    "theguardian.com":    `https://www.theguardian.com/search?q=${encoded}`,
    "nytimes.com":        `https://www.nytimes.com/search?query=${encoded}`,
    "washingtonpost.com": `https://www.washingtonpost.com/search/?query=${encoded}`,
    "bloomberg.com":      `https://www.bloomberg.com/search?query=${encoded}`,
    "aljazeera.com":      `https://www.aljazeera.com/search/${encoded}`,
    "npr.org":            `https://www.npr.org/search?query=${encoded}`,
    "cnbc.com":           `https://www.cnbc.com/search/?query=${encoded}`,
    "foxnews.com":        `https://www.foxnews.com/search-results/search?q=${encoded}`,
  }

  const match = Object.entries(searchUrlMap).find(([domain]) => sourceDomain.includes(domain))
  if (match) return match[1]

  // Fallback: Google News scoped to that site
  return `https://news.google.com/search?q=${encoded}+site:${sourceDomain}`
}

async function analyzeContentWithDualEngine(
  content: string,
  type: string,
  fileName?: string,
  originalInput?: string,
) {
  const openaiApiKey = process.env.OPENAI_API_KEY
  const groqApiKey = process.env.GROQ_API_KEY

  const entities = extractEntitiesAdvanced(content)
  const claims = extractMainClaims(content)
  const detectedTopics = detectTopicsFromContent(content.toLowerCase())
  const phKeywordMatches = TOPIC_KEYWORDS.national.filter((kw) => content.toLowerCase().includes(kw)).length
  const isPhilippinesContent = detectedTopics.includes("national") && phKeywordMatches >= 2
  const sourceAnalysis = analyzeSource(content, type, originalInput)
  const factChecks = await generateFactChecksWithRealAPIs(content, claims)
  const clickbaitScore = detectClickbait(content)
  const credibilityPatterns = analyzeCredibilityPatterns(content)
  // Try OpenAI for a precise search query; fall back to keyword extraction
  const aiQuery = await buildAISearchQuery(content, openaiApiKey, groqApiKey)
  const searchQuery = aiQuery || buildSearchQuery(content, claims)
  console.log("[ClarifAI] Search query:", searchQuery)

  // ── Heuristic signals — computed first, passed to OpenAI as evidence ──────
  const sentimentAnalysis = analyzeSentiment(content)

  let reference = ""
  if (sourceAnalysis.source) {
    try {
      const parsed = new URL(sourceAnalysis.source)
      reference = buildSourceSearchUrl(parsed.hostname.replace("www.", ""), searchQuery)
    } catch {
      reference = sourceAnalysis.source
    }
  }

  // Use the first valid fact-check URL as reference if available
  const bestFactCheck = factChecks.find((f: any) => f.source?.startsWith("http") && f.source !== "Source not identified")
  if (bestFactCheck) reference = bestFactCheck.source

  // ── Build evidence context to pass to OpenAI ──────────────────────────────
  const evidence = buildEvidenceContext({
    sourceAnalysis,
    factChecks,
    clickbaitScore,
    credibilityPatterns,
    sentimentAnalysis,
    detectedTopics,
  })

  // ── OpenAI — synthesize verdict from all evidence ─────────────────────────
  let verdict: "REAL" | "FAKE" | "UNVERIFIED" = "UNVERIFIED"
  let confidence = 50
  let explanation = ""
  let ensembleResult: any = null

  if (groqApiKey || openaiApiKey) {
    ensembleResult = await ensembleAnalysis(content, evidence, openaiApiKey || "", groqApiKey)
  }

  if (ensembleResult?.ml_signals) {
    verdict     = ensembleResult.primary_verdict as any
    confidence  = ensembleResult.confidence_score
    explanation = ensembleResult.ml_signals.verdict_explanation || ""
  } else {
    // ── Heuristic fallback — only when OpenAI unavailable ────────────────────
    const rawScore =
      sourceAnalysis.credibility * 0.35 +
      credibilityPatterns.score  * 0.30 +
      (1 - Math.max(0, sentimentAnalysis.emotionalScore - 0.3)) * 0.15 +
      (1 - clickbaitScore) * 0.15 +
      Math.min(content.length / 2000, 0.1) * 0.05

    confidence = Math.round(Math.min(rawScore * 100, 99))
    if (rawScore >= 0.72)      verdict = "REAL"
    else if (rawScore <= 0.38) verdict = "FAKE"
    else                       verdict = "UNVERIFIED"

    explanation = buildExplanation(verdict, {
      sourceCredibility: sourceAnalysis.credibility,
      emotionalScore: sentimentAnalysis.emotionalScore,
      clickbaitScore,
      credibilityPatterns,
      hasFactCheck: !!bestFactCheck,
    })
  }

  // Find trusted sources that have actually published related articles — via NewsAPI.
  // Falls back to search-page links. Returns [] when nothing relevant found.
  let analyzedDomain: string | null = null
  if (type === "url" && originalInput) {
    try { analyzedDomain = new URL(originalInput).hostname.replace("www.", "") } catch { /* ignore */ }
  }
  const enrichedSourceLinks = await findRelatedTrustedSources(
    searchQuery,
    analyzedDomain,
    process.env.NEWS_API_KEY,
    detectedTopics,
    isPhilippinesContent,
  )

  const sourceCredibility = await analyzeSourceCredibility(content, type, sourceAnalysis.credibility, verdict)
  const contentQuality = await analyzeContentQuality(content, verdict, confidence)

  let adjustedSourceCred = sourceCredibility.credibility_score
  let adjustedContentQuality = contentQuality.overall_score

  if (verdict === "REAL") {
    adjustedSourceCred = Math.max(0.7, Math.min(1, adjustedSourceCred))
    adjustedContentQuality = Math.max(0.7, Math.min(1, adjustedContentQuality))
  } else if (verdict === "FAKE") {
    adjustedSourceCred = Math.min(0.3, adjustedSourceCred)
    adjustedContentQuality = Math.min(0.4, adjustedContentQuality)
  } else if (verdict === "UNVERIFIED") {
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
    // ─── NEW: also expose a plain label for the reference link ───
    reference_label: reference
      ? `Search related articles on ${extractDomainLabel(reference)}`
      : undefined,
    source_links: enrichedSourceLinks,
    key_entities: entities,
    sentiment_score: sentimentAnalysis.score,
    sentiment_label: sentimentAnalysis.label,
    source_credibility: Math.round(sourceAnalysis.credibility * 100),
    source_label: sourceAnalysis.label,
    source_url: sourceAnalysis.source,
    credibility_indicators: credibilityPatterns,
    fact_check_results: factChecks,
    clickbait_score: clickbaitScore,
    file_name: fileName,
    ml_enhanced: !!(ensembleResult?.ml_signals),  // true only when OpenAI returned full analysis
    ensemble_analysis: ensembleResult,
    source_credibility_detailed: sourceCredibility,
    content_quality_detailed: contentQuality,
    // ─── NEW: expose the search query used for reference links ───
    search_query: searchQuery,
    detected_topics: detectedTopics,
  }
}

// ── Build a human-readable explanation from actual measured signals ──────────
// ── Build a structured evidence context string for OpenAI ─────────────────
// This gives OpenAI real data to reason from instead of guessing
function buildEvidenceContext(data: {
  sourceAnalysis: { credibility: number; label: string; source: string }
  factChecks: any[]
  clickbaitScore: number
  credibilityPatterns: { score: number; hasIssues: boolean; issues: string[] }
  sentimentAnalysis: { emotionalScore: number; label: string }
  detectedTopics: string[]
}): string {
  const lines: string[] = []

  // Source credibility
  const credPct = Math.round(data.sourceAnalysis.credibility * 100)
  lines.push(`Source credibility: ${credPct}% — ${data.sourceAnalysis.label || "unknown source"}`)

  // Detected topics
  if (data.detectedTopics.length > 0) {
    lines.push(`Detected topics: ${data.detectedTopics.join(", ")}`)
  }

  // Fact-check results
  const validFactChecks = data.factChecks.filter(
    (f: any) => f.source !== "Source not identified" && f.reviewer !== "Manual Verification Required"
  )
  if (validFactChecks.length > 0) {
    lines.push(`Fact-check results (${validFactChecks.length} found):`)
    validFactChecks.slice(0, 3).forEach((f: any) => {
      lines.push(`  - "${f.claim.substring(0, 80)}..." → ${f.conclusion} (by ${f.reviewer})`)
    })
  } else {
    lines.push("Fact-check results: No matching fact-checks found in external databases")
  }

  // Clickbait
  const clickPct = Math.round(data.clickbaitScore * 100)
  lines.push(`Clickbait/sensationalism score: ${clickPct}% — ${
    clickPct > 60 ? "high — sensationalist language detected" :
    clickPct > 30 ? "moderate" : "low — professional tone"
  }`)

  // Sentiment
  lines.push(`Sentiment: ${data.sentimentAnalysis.label} (emotional score: ${Math.round(data.sentimentAnalysis.emotionalScore * 100)}%)`)

  // Writing patterns
  if (data.credibilityPatterns.hasIssues && data.credibilityPatterns.issues.length > 0) {
    lines.push(`Writing quality issues: ${data.credibilityPatterns.issues.join("; ")}`)
  } else {
    lines.push("Writing quality: No major issues detected")
  }

  return lines.join("\n")
}

function buildExplanation(
  verdict: "REAL" | "FAKE" | "UNVERIFIED",
  signals: {
    sourceCredibility: number
    emotionalScore: number
    clickbaitScore: number
    credibilityPatterns: { score: number; hasIssues: boolean; issues: string[] }
    hasFactCheck: boolean
  },
): string {
  const { sourceCredibility, emotionalScore, clickbaitScore, credibilityPatterns, hasFactCheck } = signals
  const reasons: string[] = []

  if (verdict === "REAL") {
    if (sourceCredibility >= 0.85) reasons.push("published by a highly credible source")
    else if (sourceCredibility >= 0.65) reasons.push("source has a good credibility record")
    if (emotionalScore < 0.25) reasons.push("written in a neutral, objective tone")
    if (clickbaitScore < 0.2) reasons.push("no sensationalist language detected")
    if (hasFactCheck) reasons.push("at least one claim was verified by a fact-checker")
    if (credibilityPatterns.score > 0.75) reasons.push("strong writing structure and credibility patterns")

    if (reasons.length === 0) return "The article shows overall credible indicators based on available signals."
    return `This article appears credible. It is ${reasons.slice(0, -1).join(", ")}${reasons.length > 1 ? ", and " : ""}${reasons[reasons.length - 1]}.`
  }

  if (verdict === "FAKE") {
    if (clickbaitScore > 0.6) reasons.push("uses sensationalist or clickbait language")
    if (emotionalScore > 0.65) reasons.push("the tone is highly emotional rather than factual")
    if (sourceCredibility < 0.35) reasons.push("the source has a low credibility rating")
    if (credibilityPatterns.issues.includes("No citations or evidence references")) reasons.push("no sources or evidence are cited")
    if (credibilityPatterns.issues.some(i => i.includes("ALL CAPS"))) reasons.push("contains multiple all-caps phrases")
    if (credibilityPatterns.issues.some(i => i.includes("Vague"))) reasons.push("relies on vague, unattributed claims")

    if (reasons.length === 0) return "The article shows several signs of unreliable or misleading content based on detected patterns."
    return `This article raises credibility concerns. It ${reasons.slice(0, -1).join(", ")}${reasons.length > 1 ? ", and " : ""}${reasons[reasons.length - 1]}.`
  }

  // UNVERIFIED
  if (sourceCredibility >= 0.65) reasons.push("the source is generally credible")
  if (credibilityPatterns.issues.includes("No citations or evidence references")) reasons.push("no citations or evidence are provided")
  if (emotionalScore > 0.35) reasons.push("some emotional language is present")
  if (!hasFactCheck) reasons.push("no external fact-check was found for the claims")

  if (reasons.length === 0) return "The article could not be fully verified. Cross-referencing with other sources is recommended."
  return `This article's credibility is unclear. ${reasons.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(". ")}.`
}

// ── Find trusted sources that have actually published related articles ─────────
// Uses NewsAPI to search across trusted domains. Only returns sources where
// a matching article was found. Falls back to the source's search page.
// Returns [] when nothing relevant found — never guesses.
const TRUSTED_DOMAINS_NEWSAPI = [
  // Philippine
  { domain: "rappler.com",        name: "Rappler",                   url: "https://rappler.com" },
  { domain: "gmanetwork.com",     name: "GMA News",                  url: "https://gmanetwork.com/news" },
  { domain: "abs-cbn.com",        name: "ABS-CBN News",              url: "https://news.abs-cbn.com" },
  { domain: "inquirer.net",       name: "Philippine Daily Inquirer", url: "https://inquirer.net" },
  { domain: "philstar.com",       name: "Philstar",                  url: "https://philstar.com" },
  { domain: "manilatimes.net",    name: "Manila Times",              url: "https://manilatimes.net" },
  { domain: "mb.com.ph",          name: "Manila Bulletin",           url: "https://mb.com.ph" },
  { domain: "cnnphilippines.com", name: "CNN Philippines",           url: "https://cnnphilippines.com" },
  // International
  { domain: "bbc.com",            name: "BBC News",                  url: "https://bbc.com/news" },
  { domain: "reuters.com",        name: "Reuters",                   url: "https://reuters.com" },
  { domain: "apnews.com",         name: "Associated Press",          url: "https://apnews.com" },
  { domain: "cnn.com",            name: "CNN",                       url: "https://cnn.com" },
  { domain: "theguardian.com",    name: "The Guardian",              url: "https://theguardian.com" },
  { domain: "nytimes.com",        name: "New York Times",            url: "https://nytimes.com" },
  { domain: "washingtonpost.com", name: "Washington Post",           url: "https://washingtonpost.com" },
  { domain: "bloomberg.com",      name: "Bloomberg",                 url: "https://bloomberg.com" },
  { domain: "aljazeera.com",      name: "Al Jazeera",                url: "https://aljazeera.com" },
  { domain: "npr.org",            name: "NPR",                       url: "https://npr.org" },
  { domain: "cnbc.com",           name: "CNBC",                      url: "https://cnbc.com" },
]

type SourceResult = { name: string; url: string; article_url?: string; search_url: string; homepage_url: string }

async function findRelatedTrustedSources(
  searchQuery: string,
  excludeDomain: string | null,
  newsApiKey: string | undefined,
  detectedTopics: string[],
  isPhilippinesContent: boolean,
): Promise<SourceResult[]> {
  if (!searchQuery) return []

  const candidates = TRUSTED_DOMAINS_NEWSAPI.filter(
    (s) => !excludeDomain || !s.domain.includes(excludeDomain),
  )

  // ── Path A: NewsAPI — find sources that actually published related articles ──
  if (newsApiKey) {
    try {
      const domainList = candidates.map((s) => s.domain).join(",")
      const q = searchQuery.substring(0, 100).trim().split(/\s+/).map(encodeURIComponent).join("+")
      const apiUrl = `https://newsapi.org/v2/everything?q=${q}&domains=${domainList}&sortBy=relevancy&pageSize=10&language=en&apiKey=${newsApiKey}`
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(6000) })

      if (res.ok) {
        const data = await res.json()
        const articles: any[] = data.articles ?? []

        if (articles.length > 0) {
          const seen = new Set<string>()
          const candidates_to_verify: Array<{ article: any; match: typeof candidates[0] }> = []

          // Collect unique-domain candidates first
          for (const article of articles) {
            if (!article.url?.startsWith("http")) continue
            // Skip removed articles (NewsAPI returns "[Removed]" for some)
            if (article.title === "[Removed]" || article.url?.includes("removed")) continue

            let articleDomain = ""
            try { articleDomain = new URL(article.url).hostname.replace("www.", "") } catch { continue }

            if (seen.has(articleDomain)) continue
            seen.add(articleDomain)

            const match = candidates.find((s) => articleDomain.includes(s.domain) || s.domain.includes(articleDomain))
            if (!match) continue

            candidates_to_verify.push({ article, match })
          }

          // Verify each article URL is actually accessible (HEAD request)
          // Run checks in parallel, timeout 4s per URL
          const verified: SourceResult[] = []
          await Promise.all(
            candidates_to_verify.slice(0, 6).map(async ({ article, match }) => {
              if (verified.length >= 3) return
              try {
                const check = await fetch(article.url, {
                  method: "HEAD",
                  signal: AbortSignal.timeout(4000),
                  redirect: "follow",
                })
                // Only accept 200 OK — skip 404, 403 (paywall), 410 (gone)
                if (check.status === 200) {
                  verified.push({
                    name: match.name,
                    url: article.url,
                    article_url: article.url,
                    search_url: buildSourceSearchUrl(match.domain, searchQuery),
                    homepage_url: match.url,
                  })
                }
              } catch {
                // URL unreachable — skip it silently
              }
            })
          )

          if (verified.length > 0) return verified.slice(0, 3)
          // All articles failed verification — fall through to search pages
        }
      }
    } catch { /* fall through to topic-based */ }
  }

  // ── Path B: Topic-based fallback — use source search pages ───────────────
  // Only when NewsAPI is unavailable or found no accessible articles.
  // Links go to the source's search page pre-filled with the query —
  // the user can browse results themselves rather than hitting a dead link.
  if (detectedTopics.length === 0) return []

  const topicMatched = ALL_SOURCES
    .filter((src) => {
      if (excludeDomain && src.domain.includes(excludeDomain)) return false
      if (src.isLocal && !isPhilippinesContent) return false
      return true
    })
    .map((src) => {
      const overlap = src.topics.filter((t) => detectedTopics.includes(t)).length
      return { src, overlap, score: overlap + src.credibility * 0.01 }
    })
    .filter((s) => s.overlap > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  if (topicMatched.length === 0) return []

  return topicMatched.map(({ src }) => {
    const search_url = buildSourceSearchUrl(src.domain, searchQuery)
    return {
      name: src.name,
      url: search_url,
      article_url: undefined,
      search_url,
      homepage_url: src.url,
    }
  })
}

// Build a short, clean search query — max 5 meaningful keywords (heuristic)
function buildSearchQuery(content: string, claims: string[]): string {
  const stopwords = new Set([
    "the","a","an","and","or","but","is","are","was","were","to","of","in",
    "at","on","by","for","with","this","that","it","its","as","be","been",
    "has","had","have","will","said","also","from","more","than","about",
    "after","before","over","under","they","their","there","been","would",
    "could","should","very","just","that","which","when","what","where","who",
  ])

  const base = claims[0] || content.substring(0, 200)

  const tokens = base
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopwords.has(w.toLowerCase()))
    .slice(0, 5)

  return tokens.join(" ").trim() || content.substring(0, 60).replace(/[^a-zA-Z0-9\s]/g, " ").trim()
}

// Ask OpenAI to generate a precise search query for the article
// Returns null if OpenAI unavailable — caller falls back to buildSearchQuery
async function buildAISearchQuery(content: string, openaiApiKey?: string, groqApiKey?: string): Promise<string | null> {
  const groqKey = groqApiKey
  const systemMsg = "You generate short, specific news search queries. Respond with ONLY the query — no quotes, no punctuation, no explanation. Max 6 words."
  const userMsg = `Generate a search query for finding related news articles about this:\n\n${content.substring(0, 800)}`

  const tryQuery = async (baseUrl: string, key: string, model: string) => {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model, max_tokens: 20, temperature: 0,
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: userMsg },
          ],
        }),
        signal: AbortSignal.timeout(6000),
      })
      if (!res.ok) return null
      const data = await res.json()
      const q = data.choices?.[0]?.message?.content?.trim()
      return q && q.length > 3 && q.length < 80 && !q.includes("{") ? q : null
    } catch { return null }
  }

  if (groqKey) {
    const q = await tryQuery("https://api.groq.com/openai/v1", groqKey, "llama-3.3-70b-versatile")
    if (q) return q
  }
  if (openaiApiKey) {
    const q = await tryQuery("https://api.openai.com/v1", openaiApiKey, "gpt-4o-mini")
    if (q) return q
  }
  return null
}


// ─── NEW: extract readable domain label for UI display ─────────────────────
function extractDomainLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace("www.", "")
    const knownLabels: Record<string, string> = {
      "rappler.com": "Rappler",
      "gmanetwork.com": "GMA News",
      "abs-cbn.com": "ABS-CBN",
      "inquirer.net": "Inquirer",
      "philstar.com": "Philstar",
      "bbc.co.uk": "BBC",
      "bbc.com": "BBC",
      "reuters.com": "Reuters",
      "apnews.com": "AP News",
      "cnn.com": "CNN",
      "nytimes.com": "NYT",
      "theguardian.com": "The Guardian",
      "news.google.com": "Google News",
    }
    return Object.entries(knownLabels).find(([d]) => host.includes(d))?.[1] ?? host
  } catch {
    return "trusted source"
  }
}

function analyzeSentiment(text: string) {
  const emotionalWords = {
    extreme: [
      "shocking", "outrageous", "unbelievable", "evil", "exclusive", "breaking",
      "exposed", "scandal", "bombshell", "conspiracy",
    ],
    high: [
      "amazing", "terrible", "urgent", "alarming", "horrific", "disaster",
      "tragic", "devastating", "stunning", "astonishing",
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
      "you won't believe", "shocking", "must see", "don't miss", "breaking news",
      "just happened", "this second", "immediately", "act now", "limited time",
    ],
    exaggeration: [
      "number one", "best ever", "worst ever", "unbelievable", "insane", "crazy",
      "mind-blowing", "absolutely", "stunning", "astonishing",
    ],
    vague: [
      "they say", "people claim", "sources say", "officials say",
      "health experts say", "celebrities say",
    ],
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

// ─── Source registry with topic affinities ────────────────────────────────
// ── Source registry ───────────────────────────────────────────────────────────
// Topics represent each source's actual editorial focus.
// A source is only suggested when the article's dominant topics match.
const ALL_SOURCES = [
  // Philippine local sources
  { domain: "rappler.com",        name: "Rappler",                   credibility: 0.95, url: "https://rappler.com",           isLocal: true,  topics: ["national","politics","crime","health","social","technology","economy","environment"] },
  { domain: "gmanetwork.com",     name: "GMA News",                  credibility: 0.93, url: "https://gmanetwork.com/news",   isLocal: true,  topics: ["national","politics","entertainment","sports","social","health"] },
  { domain: "abs-cbn.com",        name: "ABS-CBN News",              credibility: 0.92, url: "https://news.abs-cbn.com",      isLocal: true,  topics: ["national","politics","entertainment","sports","social","health","crime"] },
  { domain: "inquirer.net",       name: "Philippine Daily Inquirer", credibility: 0.90, url: "https://inquirer.net",          isLocal: true,  topics: ["national","politics","crime","economy","social","sports"] },
  { domain: "philstar.com",       name: "Philstar",                  credibility: 0.88, url: "https://philstar.com",          isLocal: true,  topics: ["national","politics","economy","sports","entertainment","social"] },
  { domain: "manilatimes.net",    name: "Manila Times",              credibility: 0.87, url: "https://manilatimes.net",       isLocal: true,  topics: ["national","politics","economy","business","social"] },
  { domain: "mb.com.ph",          name: "Manila Bulletin",           credibility: 0.86, url: "https://mb.com.ph",             isLocal: true,  topics: ["national","politics","economy","technology","sports"] },
  { domain: "cnnphilippines.com", name: "CNN Philippines",           credibility: 0.94, url: "https://cnnphilippines.com",    isLocal: true,  topics: ["national","politics","economy","health","social","environment"] },
  // International sources
  { domain: "bbc.com",            name: "BBC News",                  credibility: 0.98, url: "https://bbc.com/news",          isLocal: false, topics: ["world","politics","health","science","technology","environment","economy","sports"] },
  { domain: "reuters.com",        name: "Reuters",                   credibility: 0.97, url: "https://reuters.com",           isLocal: false, topics: ["economy","finance","world","politics","health","technology","science"] },
  { domain: "apnews.com",         name: "Associated Press",          credibility: 0.97, url: "https://apnews.com",            isLocal: false, topics: ["world","politics","health","sports","science","technology","crime"] },
  { domain: "cnn.com",            name: "CNN",                       credibility: 0.95, url: "https://cnn.com",               isLocal: false, topics: ["world","politics","health","technology","entertainment","business"] },
  { domain: "theguardian.com",    name: "The Guardian",              credibility: 0.94, url: "https://theguardian.com",       isLocal: false, topics: ["environment","science","health","politics","social","technology","world"] },
  { domain: "nytimes.com",        name: "New York Times",            credibility: 0.96, url: "https://nytimes.com",           isLocal: false, topics: ["world","politics","economy","health","science","technology","social"] },
  { domain: "washingtonpost.com", name: "Washington Post",           credibility: 0.95, url: "https://washingtonpost.com",    isLocal: false, topics: ["world","politics","economy","technology","social"] },
  { domain: "bloomberg.com",      name: "Bloomberg",                 credibility: 0.94, url: "https://bloomberg.com",         isLocal: false, topics: ["economy","finance","markets","business","technology"] },
  { domain: "aljazeera.com",      name: "Al Jazeera",                credibility: 0.93, url: "https://aljazeera.com",         isLocal: false, topics: ["world","politics","environment","social","health"] },
  { domain: "npr.org",            name: "NPR",                       credibility: 0.96, url: "https://npr.org",               isLocal: false, topics: ["science","health","technology","social","politics","environment"] },
  { domain: "cnbc.com",           name: "CNBC",                      credibility: 0.94, url: "https://cnbc.com",              isLocal: false, topics: ["economy","finance","markets","business","technology"] },
  { domain: "foxnews.com",        name: "Fox News",                  credibility: 0.85, url: "https://foxnews.com",           isLocal: false, topics: ["world","politics","sports","entertainment"] },
]

// ── Topic keyword map ──────────────────────────────────────────────────────
const TOPIC_KEYWORDS: Record<string, string[]> = {
  politics:      ["president","senator","congress","parliament","election","vote","politician","government","administration","policy","senate","official","minister","governor","mayor","legislative","cabinet","ruling"],
  health:        ["disease","health","hospital","doctor","medicine","vaccine","pandemic","covid","virus","treatment","patient","medical","surgery","clinic","symptoms","outbreak","healthcare","mortality","epidemic"],
  economy:       ["economy","market","stock","business","trade","investment","finance","money","gdp","inflation","unemployment","budget","debt","revenue","fiscal","monetary","recession","bank"],
  technology:    ["technology","tech","software","app","digital","internet","computer","artificial intelligence","ai","robot","startup","cybersecurity","hack","data","smartphone","cloud","algorithm","platform"],
  science:       ["scientist","discovery","experiment","space","nasa","species","fossil","gene","dna","particle","research","laboratory","asteroid","telescope","biology","chemistry","physics"],
  sports:        ["sport","game","team","player","match","championship","score","league","tournament","coach","athlete","basketball","football","boxing","tennis","olympics","fifa","nba"],
  entertainment: ["movie","film","actor","actress","music","singer","celebrity","concert","award","show","series","netflix","streaming","album","director","box office","grammy","oscar"],
  environment:   ["climate","pollution","flood","typhoon","earthquake","carbon","renewable","energy","deforestation","wildlife","ocean","emissions","drought","wildfire","biodiversity","glacier"],
  crime:         ["crime","arrest","police","drug","murder","robbery","kidnap","suspect","court","verdict","prison","investigation","illegal","trafficking","fraud","corruption","sentenced","convicted","charged"],
  social:        ["poverty","education","school","student","protest","rights","gender","equality","welfare","housing","migrant","discrimination","inequality","refugee","human rights"],
  world:         ["international","foreign","war","conflict","treaty","diplomacy","united nations","nato","sanctions","embassy","bilateral","geopolitics","military","troops","ceasefire","invasion"],
  national:      ["philippines","filipino","manila","luzon","visayas","mindanao","cebu","davao","quezon city","makati","ncrpo","doh","dpwh","deped","dilg","nbi","pnp","bsp","pcso"],
}

// ── Detect dominant topics from content ────────────────────────────────────
// Requires at least 2 keyword hits per topic, and only returns topics that
// score at least 30% of the highest-scoring topic — avoids weak incidental matches.
function detectTopicsFromContent(text: string): string[] {
  const lower = text.toLowerCase()
  const scores: Record<string, number> = {}

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    let score = 0
    for (const kw of keywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")
      const matches = lower.match(new RegExp(`\\b${escaped}\\b`, "g"))
      if (matches) score += matches.length
    }
    if (score >= 2) scores[topic] = score
  }

  if (Object.keys(scores).length === 0) return []

  const maxScore = Math.max(...Object.values(scores))

  return Object.entries(scores)
    .filter(([, s]) => s >= maxScore * 0.30)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic]) => topic)
}

// ── Select sources relevant to dominant topics ─────────────────────────────
function selectRelevantSources(
  excludeDomain: string | null,
  detectedTopics: string[],
  count: number,
  isPhilippinesContent: boolean,
): typeof ALL_SOURCES {
  if (detectedTopics.length === 0) return []

  const scored = ALL_SOURCES
    .filter((src) => {
      if (excludeDomain && src.domain.includes(excludeDomain)) return false
      if (src.isLocal && !isPhilippinesContent) return false
      return true
    })
    .map((src) => {
      const overlap = src.topics.filter((t) => detectedTopics.includes(t)).length
      return { src, overlap, score: overlap + src.credibility * 0.01 }
    })
    .filter((s) => s.overlap > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return []

  return scored.slice(0, count).map((s) => s.src)
}
function analyzeSource(content: string, type: string, originalInput?: string) {
  const text = content.toLowerCase()
  const urlToParse = type === "url" && originalInput ? originalInput : content

  // Detect topics from actual content
  const detectedTopics = detectTopicsFromContent(text)
  // Local PH sources only when content has BOTH a national topic AND
  // at least 2 distinct PH-specific keywords (not just a passing mention)
  const phKeywordMatches = TOPIC_KEYWORDS.national.filter((kw) => text.includes(kw)).length
  const isPhilippinesContent = detectedTopics.includes("national") && phKeywordMatches >= 2

  let detectedSource = ""
  const detectedSources: Array<{ name: string; url: string }> = []
  let credibility = 0.5
  let label = "Unable to verify source"
  let excludeDomain: string | null = null

  if (type === "url") {
    try {
      const parsed = new URL(urlToParse)
      detectedSource = parsed.href
      const host = parsed.hostname.replace("www.", "")
      const match = ALL_SOURCES.find((src) => host.includes(src.domain))
      excludeDomain = host // always exclude the source itself from suggestions

      if (match) {
        credibility = match.credibility
        label = match.isLocal
          ? `Verified Philippine news: ${match.name}`
          : `Verified International source: ${match.name}`

        // The source itself is NOT in suggestions — user already knows that source
        // Pick 3 OTHER relevant sources based on content topics
        const suggestions = selectRelevantSources(host, detectedTopics, 3, isPhilippinesContent)
        detectedSources.push(...suggestions.map((s) => ({ name: s.name, url: s.url })))
      } else {
        credibility = 0.35
        label = `Unverified source: ${host}`
        const suggestions = selectRelevantSources(host, detectedTopics, 3, isPhilippinesContent)
        detectedSources.push(...suggestions.map((s) => ({ name: s.name, url: s.url })))
      }
    } catch {
      /* ignore invalid URL */
    }
  } else {
    // Text input — check if any known source is mentioned in the text
    const mentionedSource = ALL_SOURCES.find(
      (src) =>
        text.includes(src.domain.split(".")[0]) ||
        text.includes(src.name.toLowerCase()),
    )

    if (mentionedSource) {
      credibility = mentionedSource.credibility
      detectedSource = mentionedSource.url
      excludeDomain = mentionedSource.domain
      label = mentionedSource.isLocal
        ? `Verified Philippine news: ${mentionedSource.name}`
        : `Verified International source: ${mentionedSource.name}`

      // Suggest OTHER relevant sources, not the one already in the text
      const suggestions = selectRelevantSources(mentionedSource.domain, detectedTopics, 3, isPhilippinesContent)
      detectedSources.push(...suggestions.map((s) => ({ name: s.name, url: s.url })))
    } else {
      // No source mentioned — suggest based purely on content topics only if topics found
      if (detectedTopics.length > 0) {
        label = `Suggested sources for: ${detectedTopics.slice(0, 2).join(", ")}`
        const suggestions = selectRelevantSources(null, detectedTopics, 3, isPhilippinesContent)
        detectedSources.push(...suggestions.map((s) => ({ name: s.name, url: s.url })))
      } else {
        label = "Unable to verify source"
        // No topics detected — show nothing rather than irrelevant sources
      }
    }
  }

  return { credibility, label, source: detectedSource, detectedSources: detectedSources.slice(0, 3) }
}


async function generateFactChecksWithRealAPIs(content: string, claims: string[]) {
  const googleApiKey = process.env.GOOGLE_FACT_CHECK_API_KEY
  const newsApiKey = process.env.NEWS_API_KEY

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
              // ─── Use claimReview URL (actual article), not just the publisher root ──
              source: c.claimReview?.[0]?.url || "https://toolbox.google.com/factcheck",
              source_label: c.claimReview?.[0]?.publisher?.name || "Google Fact Check",
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
              // ─── Use the actual article URL from NewsAPI ──────────────────────────
              source: a.url,
              source_label: a.source?.name || "News Source",
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
      source_label: "Rappler",
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
  const newsApiKey = process.env.NEWS_API_KEY

  const lower = content.toLowerCase()
  const result: any = {
    api_checks: [],
    credibility_score: baseCredibility,
    credibility_label: "Neutral",
    domain_authority: null,
    reason: [],
    bias_indicators: [],
  }

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
        result.domain_authority = pageRank / 10
        result.credibility_score = (result.credibility_score + result.domain_authority) / 2
        result.reason.push("Domain authority successfully retrieved.")
      } else {
        result.reason.push("Domain authority unavailable.")
      }
    } catch {
      result.reason.push("URL parsing failed.")
    }
  }

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



  const final = result.credibility_score
  result.credibility_label =
    final > 0.8 ? "Highly credible" : final > 0.6 ? "Credible" : final > 0.4 ? "Uncertain" : "Low credibility"

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
          result.bias_indicators = ["Known right-leaning editorial stance", "Opinion content may reflect political bias"]
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

  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length)
  const words = content.split(/\s+/).length
  result.structure.avg_sentence_length = Math.round(words / Math.max(sentences.length, 1))
  result.readability_score = Math.max(0, Math.min(1, 1 - result.structure.avg_sentence_length / 40))

  if (ltKey) {
    try {
      const res = await fetch("https://api.languagetoolplus.com/v2/check", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ text: content, language: "en-US", apiKey: ltKey }),
      })
      const data = await res.json()
      result.grammar_issues = data.matches?.slice(0, 5) || []
    } catch {}
  }



  const numbersCount = (content.match(/\b\d{1,4}\b/g) || []).length
  const dateMatches = (
    content.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\b|\b\d{4}\b/g) || []
  ).length
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
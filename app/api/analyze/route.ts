import { type NextRequest, NextResponse } from "next/server"

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
          explanation: "Failed to fetch URL. Please check if the URL is valid and accessible.",
        })
      }
    }

    if (type === "file" && content.startsWith("[")) {
      processedContent =
        "File uploaded: " + content + ". Please provide file content or use URL/text input for analysis."
    }

    const validationResult = validateContent(processedContent, type)
    if (!validationResult.isValid) {
      return NextResponse.json({
        verdict: "ERROR",
        confidence_score: 0,
        explanation: validationResult.message,
      })
    }

    const analysis = await analyzeContent(processedContent, type, fileName)
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
      message: "Content has too few words. Please provide at least 5 words of meaningful content.",
    }
  }

  return { isValid: true, message: "" }
}

async function analyzeContent(content: string, type: string, fileName?: string) {
  const entities = extractEntitiesAdvanced(content)
  const claims = extractMainClaims(content)
  const sentimentAnalysis = analyzeSentiment(content)
  const sourceAnalysis = analyzeSource(content, type)
  const factChecks = await generateFactChecksWithRealAPIs(content, claims)
  const clickbaitScore = detectClickbait(content)
  const credibilityPatterns = analyzeCredibilityPatterns(content)

  let verdict: "REAL" | "FAKE" | "UNVERIFIED" = "UNVERIFIED"
  let confidence = 50
  let explanation = ""
  let reference = sourceAnalysis.source || ""

  const scores = {
    factCheck: 0,
    source: sourceAnalysis.credibility,
    sentiment: sentimentAnalysis.emotionalScore,
    clickbait: clickbaitScore,
    entities: Math.min(entities.persons.length + entities.organizations.length, 5) / 5,
    credibilityPatterns: credibilityPatterns.score,
  }

  if (factChecks.length > 0 && factChecks[0].source !== "Source not identified") {
    const bestFact = factChecks[0]
    reference = bestFact.source
    const conclusion = bestFact.conclusion.toLowerCase()

    if (
      conclusion.includes("true") ||
      conclusion.includes("correct") ||
      conclusion.includes("accurate") ||
      conclusion.includes("verified")
    ) {
      verdict = "REAL"
      confidence = Math.min(96, 90 + scores.source * 10)
      explanation = `Verified by ${bestFact.reviewer || "trusted fact-checking sources"}.`
    } else if (
      conclusion.includes("false") ||
      conclusion.includes("wrong") ||
      conclusion.includes("incorrect") ||
      conclusion.includes("misleading") ||
      conclusion.includes("false")
    ) {
      verdict = "FAKE"
      confidence = Math.min(98, 92 + scores.source * 10)
      explanation = `Flagged as FALSE by ${bestFact.reviewer || "fact-checkers"}. ${bestFact.conclusion}`
    } else if (
      conclusion.includes("mixture") ||
      conclusion.includes("partial") ||
      conclusion.includes("partly") ||
      conclusion.includes("unconfirmed")
    ) {
      verdict = "UNVERIFIED"
      confidence = 68
      explanation = `Mixed findings: Contains both accurate and false elements. See fact-check references below.`
    }
  } else if (
    sourceAnalysis.credibility >= 0.9 &&
    content.length > 300 &&
    sentimentAnalysis.emotionalScore < 0.45 &&
    credibilityPatterns.score > 0.8 &&
    !credibilityPatterns.hasIssues
  ) {
    verdict = "REAL"
    confidence = Math.min(94, 85 + credibilityPatterns.score * 10)
    explanation = `From verified ${sourceAnalysis.label}. Content shows strong credibility indicators: proper sourcing, balanced tone, and no sensationalism.`
  } else if (
    sourceAnalysis.credibility < 0.35 &&
    sentimentAnalysis.emotionalScore > 0.75 &&
    clickbaitScore > 0.7 &&
    credibilityPatterns.issues.length >= 3
  ) {
    verdict = "FAKE"
    confidence = Math.min(95, 82 + (1 - credibilityPatterns.score) * 15)
    explanation = `High-risk indicators detected: Low-credibility source + extreme emotional language + clickbait patterns + poor content quality. Issues: ${credibilityPatterns.issues.slice(0, 2).join(", ")}.`
  } else if (clickbaitScore > 0.85 && sentimentAnalysis.emotionalScore > 0.8 && entities.persons.length < 2) {
    verdict = "FAKE"
    confidence = 78
    explanation = `Strong manipulative patterns detected: Clickbait language (${(clickbaitScore * 100).toFixed(0)}%) + extreme emotion + lacks credible persons/organizations.`
  } else if (
    sourceAnalysis.credibility > 0.85 &&
    sentimentAnalysis.emotionalScore < 0.5 &&
    credibilityPatterns.score > 0.75
  ) {
    verdict = "REAL"
    confidence = 80
    explanation = `From reputable source: ${sourceAnalysis.label}. Balanced reporting with proper structure and no manipulative patterns.`
  } else if (
    entities.persons.length === 0 &&
    entities.organizations.length === 0 &&
    claims.length < 2 &&
    sourceAnalysis.credibility < 0.6
  ) {
    verdict = "UNVERIFIED"
    confidence = 38
    explanation = `Cannot verify: No specific entities or clear claims mentioned. Source not established. Recommend checking with multiple reliable news outlets.`
  } else if (
    credibilityPatterns.hasIssues &&
    credibilityPatterns.issues.length >= 2 &&
    sourceAnalysis.credibility < 0.65
  ) {
    verdict = credibilityPatterns.issues.some((i) => i.toLowerCase().includes("vague")) ? "UNVERIFIED" : "UNVERIFIED"
    confidence = 45 + credibilityPatterns.score * 25
    explanation = `Content quality concerns detected: ${credibilityPatterns.issues[0]} Recommendation: Cross-check with established news sources for accuracy.`
  } else {
    verdict = "UNVERIFIED"
    confidence = Math.max(50, 55 + credibilityPatterns.score * 20 - sourceAnalysis.credibility * 5)
    explanation =
      credibilityPatterns.issues.length > 0
        ? `Cannot definitively verify: ${credibilityPatterns.issues[0]} Please cross-reference with multiple trusted news sources for accuracy.`
        : `Insufficient evidence to verify. Recommendation: Check multiple trusted sources including ${sourceAnalysis.detectedSources.map((s) => s.name).join(", ") || "established news outlets"}.`
  }

  return {
    verdict,
    confidence_score: Math.min(confidence, 99),
    explanation,
    reference,
    source_links: sourceAnalysis.detectedSources,
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
  let extremeCount = 0

  for (const word of emotionalWords.extreme) {
    const occurrences = (lowerText.match(new RegExp(`\\b${word}\\b`, "gi")) || []).length
    emotionalScore += occurrences * 0.2
    extremeCount += occurrences
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
  let patterns = 0

  for (const pattern of clickbaitPatterns.urgency) {
    if (lowerText.includes(pattern)) {
      clickbaitScore += 0.16
      patterns++
    }
  }

  for (const pattern of clickbaitPatterns.exaggeration) {
    if (lowerText.includes(pattern)) {
      clickbaitScore += 0.13
      patterns++
    }
  }

  for (const pattern of clickbaitPatterns.vague) {
    if (lowerText.includes(pattern)) {
      clickbaitScore += 0.22
      patterns++
    }
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

  for (const word of words) {
    if (/^[A-Z][a-z]+/.test(word) && word.length > 3) {
      const context = words.join(" ").toLowerCase()
      if (context.includes("president") || context.includes("minister") || context.includes("said")) {
        persons.add(word)
      } else if (word.includes("Inc") || word.includes("Corp")) {
        organizations.add(word)
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

  if (type === "url" || text.startsWith("http")) {
    try {
      const parsed = new URL(content)
      const host = parsed.hostname?.replace("www.", "") || ""
      const match = allSources.find((src) => host.includes(src.domain))

      if (match) {
        detectedSource = parsed.href
        detectedSources.push({ name: match.name, url: match.url })
        credibility = match.credibility
        const isLocal = localSources.some((s) => s.domain === match.domain)
        label = isLocal ? `🇵🇭 Verified Philippine news: ${match.name}` : `Verified International source: ${match.name}`
      } else {
        detectedSource = parsed.href
        credibility = 0.35
        label = `Unverified source: ${host}`
      }
    } catch {
      /* ignore invalid URL */
    }
  }

  if (!detectedSource) {
    for (const src of allSources) {
      if (text.includes(src.domain.split(".")[0]) || text.includes(src.name.toLowerCase())) {
        detectedSource = src.url
        detectedSources.push({ name: src.name, url: src.url })
        credibility = src.credibility
        const isLocal = localSources.some((s) => s.domain === src.domain)
        label = isLocal ? `🇵🇭 Verified Philippine news: ${src.name}` : `Verified International source: ${src.name}`
        break
      }
    }
  }

  return { credibility, label, source: detectedSource, detectedSources }
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

    if (results.length === 0 && hfApiKey) {
      try {
        const hfRes = await fetch("https://api-inference.huggingface.co/models/roberta-base-openai-detector", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${hfApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: mainClaim }),
          signal: AbortSignal.timeout(5000),
        })
        if (hfRes.ok) {
          const hfData = await hfRes.json()
          const score = hfData?.[0]?.[0]?.score ?? 0
          results.push({
            claim: mainClaim,
            conclusion:
              score > 0.6 ? "Likely AI-generated or fabricated" : "Appears to be human-written factual content",
            source: "https://huggingface.co/openai/gpt2",
            reviewer: "AI Content Detection",
            relevance: 0.7,
          })
        }
      } catch (err) {
        console.error("[HuggingFace] Error:", err)
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
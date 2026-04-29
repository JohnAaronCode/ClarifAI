// FILIPINO LANGUAGE DETECTION 
const FILIPINO_MARKERS = [
  "ang","ng","na","sa","at","ay","mga","para","kung","pero","hindi",
  "ito","yan","yun","siya","sila","kami","tayo","kayo","ako","ikaw",
  "niya","nila","namin","natin","ninyo","akin","iyo","kaniya","kanila",
  "dahil","kaya","ngunit","subalit","habang","kapag","kahit","bago",
  "pagkatapos","upang","tulad","katulad","halimbawa","gayundin",
  "sinabi","ayon","ulat","balita","nagsabi","nagpahayag","inihayag",
  "gobyerno","pangulo","senado","kongreso","opisyal","batas","korte",
  "pulis","hukuman","eleksyon","boto","partido","kandidato",
  "piso","milyon","bilyon","porsyento","daan","libo",
  "ospital","paaralan","guro","mag-aaral","doktor","pasyente",
  "mahal","mura","libre","bayad","trabaho","negosyo",
  "namatay","nasugatan","nasalanta","nasunog","nangyari",
  "araw","linggo","buwan","taon","ngayon","kahapon","bukas",
]

export function detectLanguage(text: string): {
  isFilipino: boolean
  confidence: number
  detectedMarkers: string[]
} {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 1)
  if (words.length === 0) return { isFilipino: false, confidence: 0, detectedMarkers: [] }

  const detectedMarkers: string[] = []
  let filipinoWordCount = 0

  for (const word of words) {
    const clean = word.replace(/[^a-záéíóúñ]/g, "")
    if (FILIPINO_MARKERS.includes(clean)) {
      filipinoWordCount++
      if (!detectedMarkers.includes(clean)) detectedMarkers.push(clean)
    }
  }

  const ratio      = filipinoWordCount / words.length
  const isFilipino = ratio >= 0.08 || filipinoWordCount >= 10
  const confidence = Math.min(Math.round(ratio * 200), 100)

  return { isFilipino, confidence, detectedMarkers: detectedMarkers.slice(0, 10) }
}

// ARTICLE SUMMARY 
export function generateArticleSummary(content: string): {
  summary: string
  key_claims: Array<{ claim: string; status: "verified" | "unverified" | "disputed" }>
  word_count: number
  reading_time_minutes: number
} {
  const word_count           = content.trim().split(/\s+/).length
  const reading_time_minutes = Math.max(1, Math.ceil(word_count / 200))

  const sentences = content
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 40 && s.length < 350)

  if (sentences.length === 0) {
    return {
      summary: content.substring(0, 250).trim() + (content.length > 250 ? "..." : ""),
      key_claims: [],
      word_count,
      reading_time_minutes,
    }
  }

  const importantKeywords = [
    "according to","reported","announced","confirmed","said","stated",
    "revealed","found","showed","indicated","president","government",
    "officials","study","research","data","percent","%","million",
    "billion","deaths","arrested","charged","approved","signed","ordered",
  ]

  const scored = sentences.map((sentence, index) => {
    let score      = 0
    const lower    = sentence.toLowerCase()

    if (index === 0)      score += 4
    else if (index <= 2)  score += 2
    else if (index <= 5)  score += 1

    for (const kw of importantKeywords) {
      if (lower.includes(kw)) score += 0.5
    }
    if (/\b\d[\d,.]*\s*(%|million|billion|thousand|percent)\b/i.test(sentence)) score += 1.5
    if (/\b(said|told|confirmed|announced|reported)\b/i.test(sentence))          score += 1
    if (sentence.length < 60)  score -= 1
    if (sentence.length > 280) score -= 0.5
    if (sentence.endsWith("?")) score -= 2

    return { sentence, score, index }
  })

  const topCount   = Math.min(4, Math.max(2, Math.ceil(sentences.length / 8)))
  const topIndices = new Set(
    [...scored].sort((a, b) => b.score - a.score).slice(0, topCount).map(s => s.index)
  )

  const summaryParts = sentences.filter((_, i) => topIndices.has(i))
  const summary      = summaryParts.join(" ").substring(0, 600).trim()

  const attributionPattern = /\b(according to|confirmed by|announced by|reported by|said in a statement|official statement)\b/i
  const disputedPattern    = /\b(alleged|denied|disputed|accused|claimed|unverified|under investigation)\b/i
  const verifiedPattern    = /\b(confirmed|officially announced|signed into law|officially declared|on record)\b/i

  const claimsRaw = sentences
    .filter(s =>
      attributionPattern.test(s) ||
      disputedPattern.test(s) ||
      /\b(president|senator|court|police|government|official)\b.*\b(said|ordered|signed|approved|rejected|announced)\b/i.test(s)
    )
    .slice(0, 3)

  const key_claims = claimsRaw.map(claim => {
    let status: "verified" | "unverified" | "disputed" = "unverified"
    if (disputedPattern.test(claim))      status = "disputed"
    else if (verifiedPattern.test(claim)) status = "verified"
    return { claim: claim.substring(0, 160), status }
  })

  return { summary, key_claims, word_count, reading_time_minutes }
}

// SHARED DOMAIN 
export const SOURCE_SEARCH_URL_MAP: Record<string, string> = {
  "rappler.com":        "https://www.rappler.com/search?q=",
  "gmanetwork.com":     "https://www.gmanetwork.com/news/search?q=",
  "abs-cbn.com":        "https://news.abs-cbn.com/search?q=",
  "inquirer.net":       "https://www.inquirer.net/search?q=",
  "philstar.com":       "https://www.philstar.com/search?q=",
  "manilatimes.net":    "https://www.manilatimes.net/search?q=",
  "mb.com.ph":          "https://mb.com.ph/search?s=",
  "cnnphilippines.com": "https://www.cnnphilippines.com/search?q=",
  "bbc.com":            "https://www.bbc.co.uk/search?q=",
  "bbc.co.uk":          "https://www.bbc.co.uk/search?q=",
  "reuters.com":        "https://www.reuters.com/search/news?blob=",
  "apnews.com":         "https://apnews.com/search?q=",
  "cnn.com":            "https://edition.cnn.com/search?q=",
  "theguardian.com":    "https://www.theguardian.com/search?q=",
  "nytimes.com":        "https://www.nytimes.com/search?query=",
  "washingtonpost.com": "https://www.washingtonpost.com/search/?query=",
  "bloomberg.com":      "https://www.bloomberg.com/search?query=",
  "aljazeera.com":      "https://www.aljazeera.com/search/",
  "npr.org":            "https://www.npr.org/search?query=",
  "cnbc.com":           "https://www.cnbc.com/search/?query=",
  "foxnews.com":        "https://www.foxnews.com/search-results/search?q=",
}

export function buildSourceSearchUrlShared(domain: string, query: string): string {
  const encoded = encodeURIComponent(query.substring(0, 80).trim())
  const match   = Object.entries(SOURCE_SEARCH_URL_MAP).find(([d]) => domain.includes(d))
  if (match) return match[1] + encoded
  return `https://news.google.com/search?q=${encoded}+site:${domain}`
}

export function decodeHTMLEntities(text: string): string {
  if (!text) return ""
  return text
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&ndash;/g, "\u2013")
    .trim()
}
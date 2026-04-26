// ── FILIPINO LANGUAGE DETECTION ──────────────────────────────────────────
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

  const ratio = filipinoWordCount / words.length
  const isFilipino = ratio >= 0.08 || filipinoWordCount >= 10
  const confidence = Math.min(Math.round(ratio * 200), 100)

  return { isFilipino, confidence, detectedMarkers: detectedMarkers.slice(0, 10) }
}

// ── BIAS DETECTION ───────────────────────────────────────────────────────
const BIAS_SIGNALS = {
  left: [
    "social justice","income inequality","systemic racism","climate crisis",
    "marginalized communities","progressive","diversity and inclusion",
    "affordable housing","universal healthcare","wealth gap","workers rights",
    "corporate greed","police brutality","gun control","reproductive rights",
  ],
  right: [
    "traditional values","free market","small government","second amendment",
    "border security","illegal immigration","law and order","fiscal responsibility",
    "parental rights","religious freedom","national sovereignty","election integrity",
    "anti-woke","mainstream media","deep state","america first",
  ],
  proGovernment: [
    "administration lauds","government succeeds","officials praise",
    "president approves","positive steps","milestone achieved",
    "successful implementation","officials celebrate","government achieves",
    "authorities commend","landmark achievement","historic progress",
  ],
  critical: [
    "slammed","criticized","condemned","blasted","outrage",
    "failed","corruption","controversy","scandal","opposed",
    "accused","alleged","questionable","under fire","backlash",
    "demands accountability","calls for resignation","faces criticism",
  ],
  neutral: [
    "according to","reported","stated","announced","confirmed",
    "said in a statement","as of","data shows","records indicate",
    "sources say","officials told","in a press conference","citing",
  ],
}

// Known bias ratings per domain
const DOMAIN_BIAS_MAP: Record<string, { rating: string; lean: "left" | "center" | "right" }> = {
  "foxnews.com":           { rating: "Right-leaning",         lean: "right"  },
  "breitbart.com":         { rating: "Far-right",             lean: "right"  },
  "dailycaller.com":       { rating: "Right-leaning",         lean: "right"  },
  "nypost.com":            { rating: "Right-leaning",         lean: "right"  },
  "washingtonexaminer.com":{ rating: "Right-leaning",         lean: "right"  },
  "theblaze.com":          { rating: "Right-leaning",         lean: "right"  },
  "cnn.com":               { rating: "Left-leaning",          lean: "left"   },
  "msnbc.com":             { rating: "Left-leaning",          lean: "left"   },
  "huffpost.com":          { rating: "Left-leaning",          lean: "left"   },
  "motherjones.com":       { rating: "Left-leaning",          lean: "left"   },
  "thenation.com":         { rating: "Left-leaning",          lean: "left"   },
  "slate.com":             { rating: "Left-leaning",          lean: "left"   },
  "reuters.com":           { rating: "Center / Neutral",      lean: "center" },
  "apnews.com":            { rating: "Center / Neutral",      lean: "center" },
  "bbc.com":               { rating: "Center / Neutral",      lean: "center" },
  "nytimes.com":           { rating: "Center-left",           lean: "center" },
  "theguardian.com":       { rating: "Center-left",           lean: "center" },
  "npr.org":               { rating: "Center / Neutral",      lean: "center" },
  "bloomberg.com":         { rating: "Center / Neutral",      lean: "center" },
  "rappler.com":           { rating: "Center / Neutral",      lean: "center" },
  "inquirer.net":          { rating: "Center / Neutral",      lean: "center" },
  "gmanetwork.com":        { rating: "Center / Neutral",      lean: "center" },
  "abs-cbn.com":           { rating: "Center / Neutral",      lean: "center" },
  "philstar.com":          { rating: "Center / Neutral",      lean: "center" },
  "cnnphilippines.com":    { rating: "Center / Neutral",      lean: "center" },
  "manilatimes.net":       { rating: "Center / Neutral",      lean: "center" },
  "mb.com.ph":             { rating: "Center / Neutral",      lean: "center" },
}

export function detectBias(
  content: string,
  sourceDomain?: string | null,
): {
  political_lean: "Left" | "Center" | "Right" | "Unknown"
  bias_rating: string
  bias_confidence: number
  framing: "Pro-institution" | "Critical" | "Neutral"
  framing_scores: { proGov: number; critical: number; neutral: number }
  bias_indicators: string[]
  domain_bias?: { rating: string; lean: string } | null
} {
  const lower = content.toLowerCase()

  // Score content signals
  let leftScore = 0, rightScore = 0
  const foundIndicators: string[] = []

  for (const kw of BIAS_SIGNALS.left) {
    if (lower.includes(kw)) { leftScore++; foundIndicators.push(`Left signal: "${kw}"`) }
  }
  for (const kw of BIAS_SIGNALS.right) {
    if (lower.includes(kw)) { rightScore++; foundIndicators.push(`Right signal: "${kw}"`) }
  }

  // Framing scores
  let proGov = 0, critical = 0, neutral = 0
  for (const kw of BIAS_SIGNALS.proGovernment) { if (lower.includes(kw)) proGov++ }
  for (const kw of BIAS_SIGNALS.critical)       { if (lower.includes(kw)) critical++ }
  for (const kw of BIAS_SIGNALS.neutral)         { if (lower.includes(kw)) neutral++ }

  const framing: "Pro-institution" | "Critical" | "Neutral" =
    neutral >= proGov && neutral >= critical ? "Neutral"
    : proGov > critical ? "Pro-institution"
    : "Critical"

  // Domain-level bias lookup
  let domainBias: { rating: string; lean: string } | null = null
  let political_lean: "Left" | "Center" | "Right" | "Unknown" = "Unknown"
  let bias_rating = "Unable to determine"

  if (sourceDomain) {
    const match = Object.entries(DOMAIN_BIAS_MAP).find(([d]) =>
      sourceDomain.toLowerCase().includes(d)
    )
    if (match) {
      domainBias = match[1]
      bias_rating = match[1].rating
      political_lean =
        match[1].lean === "left"   ? "Left"   :
        match[1].lean === "right"  ? "Right"  :
        match[1].lean === "center" ? "Center" : "Unknown"
    }
  }

  // Fallback to content signals if no domain match
  if (political_lean === "Unknown" && (leftScore > 0 || rightScore > 0)) {
    const diff = leftScore - rightScore
    if (diff >= 2)       { political_lean = "Left";   bias_rating = "Possible left-leaning content" }
    else if (diff <= -2) { political_lean = "Right";  bias_rating = "Possible right-leaning content" }
    else                 { political_lean = "Center"; bias_rating = "Mostly neutral content signals" }
  }

  const bias_confidence = domainBias
    ? 85
    : Math.min(Math.round((Math.abs(leftScore - rightScore) / Math.max(leftScore + rightScore, 1)) * 100), 80)

  // Clean indicators for display
  const bias_indicators: string[] = []
  if (domainBias) bias_indicators.push(`Source known for ${domainBias.rating} editorial stance`)
  if (framing !== "Neutral") bias_indicators.push(`Content framing detected as "${framing}"`)
  if (leftScore > 0 || rightScore > 0) {
    bias_indicators.push(`${leftScore} left-leaning and ${rightScore} right-leaning signals found`)
  }
  if (bias_indicators.length === 0) bias_indicators.push("No significant bias signals detected in content")

  return {
    political_lean,
    bias_rating,
    bias_confidence,
    framing,
    framing_scores: { proGov, critical, neutral },
    bias_indicators,
    domain_bias: domainBias,
  }
}

// ── ARTICLE SUMMARY & KEY CLAIMS ─────────────────────────────────────────
export function generateArticleSummary(content: string): {
  summary: string
  key_claims: Array<{ claim: string; status: "verified" | "unverified" | "disputed" }>
  word_count: number
  reading_time_minutes: number
} {
  const word_count = content.trim().split(/\s+/).length
  const reading_time_minutes = Math.max(1, Math.ceil(word_count / 200))

  // Extract sentences
  const sentences = content
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 30 && s.length < 300)

  if (sentences.length === 0) {
    return {
      summary: content.substring(0, 200) + "...",
      key_claims: [],
      word_count,
      reading_time_minutes,
    }
  }

  // Score sentences by importance (position + keyword presence)
  const importantKeywords = [
    "according to","reported","announced","confirmed","said","stated",
    "revealed","found","showed","indicated","claimed","alleged",
    "president","government","officials","study","research","data",
    "percent","%","million","billion","deaths","arrested","charged",
  ]

  const scored = sentences.map((sentence, index) => {
    let score = 0
    const lower = sentence.toLowerCase()
    // Prioritize early sentences
    if (index === 0) score += 3
    else if (index <= 2) score += 2
    else if (index <= 5) score += 1
    // Keyword bonus
    for (const kw of importantKeywords) {
      if (lower.includes(kw)) score += 0.5
    }
    // Penalize very short or very long sentences
    if (sentence.length < 50) score -= 1
    if (sentence.length > 250) score -= 0.5
    return { sentence, score, index }
  })

  scored.sort((a, b) => b.score - a.score)

  // Take top 3-4 sentences for summary, preserve original order
  const topIndices = new Set(scored.slice(0, 4).map(s => s.index))
  const summaryParts = sentences
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => topIndices.has(i))
    .map(({ s }) => s)

  const summary = summaryParts.join(" ").substring(0, 600)

  // Extract key claims (first 3 strong assertion sentences)
  const claimPatterns = [
    /\b(president|senator|congress|official|government|court|police)\b/i,
    /\b(announced|confirmed|revealed|ordered|approved|rejected|signed)\b/i,
    /\b(according to|reported by|citing|sources say)\b/i,
    /\b(\d+[\.,]?\d*\s*(million|billion|thousand|percent|%))\b/i,
  ]

  const claimsRaw = sentences
    .filter(s => claimPatterns.some(p => p.test(s)))
    .slice(0, 3)

  // Simple verification heuristic
  const key_claims = claimsRaw.map(claim => {
    const lower = claim.toLowerCase()
    let status: "verified" | "unverified" | "disputed" = "unverified"
    if (
      lower.includes("according to") ||
      lower.includes("confirmed") ||
      lower.includes("official") ||
      lower.includes("said in a statement")
    ) status = "verified"
    else if (
      lower.includes("alleged") ||
      lower.includes("claimed") ||
      lower.includes("disputed") ||
      lower.includes("denied")
    ) status = "disputed"
    return { claim: claim.substring(0, 150), status }
  })

  return { summary, key_claims, word_count, reading_time_minutes }
}

// ── EXPORT / SHARE HELPERS ────────────────────────────────────────────────

// Generates plain text report for copy/download
export function generateTextReport(data: {
  verdict: string
  confidence_score: number
  explanation: string
  article_title?: string
  source_label?: string
  bias?: ReturnType<typeof detectBias>
  summary?: ReturnType<typeof generateArticleSummary>
  language?: ReturnType<typeof detectLanguage>
  analyzed_url?: string
}): string {
  const lines: string[] = []
  const now = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })

  lines.push("═══════════════════════════════════════")
  lines.push("         ClarifAI Analysis Report")
  lines.push("      News Credibility Analyzer")
  lines.push("═══════════════════════════════════════")
  lines.push(`Date: ${now}`)
  lines.push("")

  if (data.article_title) lines.push(`Article: ${data.article_title}`)
  if (data.analyzed_url)  lines.push(`URL: ${data.analyzed_url}`)
  if (data.source_label)  lines.push(`Source: ${data.source_label}`)
  lines.push("")

  lines.push("── VERDICT ─────────────────────────────")
  lines.push(`Result: ${data.verdict}`)
  lines.push(`Confidence: ${data.confidence_score}%`)
  lines.push(`Explanation: ${data.explanation}`)
  lines.push("")

  if (data.summary) {
    lines.push("── ARTICLE SUMMARY ──────────────────────")
    lines.push(data.summary.summary)
    lines.push(`Word count: ${data.summary.word_count} words | Reading time: ~${data.summary.reading_time_minutes} min`)
    lines.push("")

    if (data.summary.key_claims.length > 0) {
      lines.push("── KEY CLAIMS ───────────────────────────")
      for (const c of data.summary.key_claims) {
        lines.push(`[${c.status.toUpperCase()}] ${c.claim}`)
      }
      lines.push("")
    }
  }

  if (data.bias) {
    lines.push("── BIAS ANALYSIS ────────────────────────")
    lines.push(`Political lean: ${data.bias.political_lean}`)
    lines.push(`Bias rating: ${data.bias.bias_rating}`)
    lines.push(`Content framing: ${data.bias.framing}`)
    for (const ind of data.bias.bias_indicators) lines.push(`• ${ind}`)
    lines.push("")
  }

  if (data.language) {
    lines.push("── LANGUAGE ─────────────────────────────")
    lines.push(`Detected: ${data.language.isFilipino ? "Filipino/Tagalog" : "English"}`)
    if (data.language.isFilipino) {
      lines.push(`Filipino confidence: ${data.language.confidence}%`)
    }
    lines.push("")
  }

  lines.push("═══════════════════════════════════════")
  lines.push("Always verify news with primary sources.")
  lines.push("Generated by ClarifAI — clarif-ai-beta.vercel.app")
  lines.push("═══════════════════════════════════════")

  return lines.join("\n")
}
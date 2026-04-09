"use client"

import { Card } from "@/components/ui/card"
import {
  ExternalLink, AlertCircle, CheckCircle2, AlertTriangle, Globe, Info,
  ChevronDown, ChevronUp, Newspaper, ShieldCheck, ShieldAlert, ShieldQuestion,
  BarChart2, FileText, AlertOctagon, Star
} from "lucide-react"
import { useState } from "react"

interface SourceLink {
  name: string
  url: string
  article_url?: string
  search_url?: string
  homepage_url?: string
}

interface FactCheck {
  claim: string
  conclusion: string
  source: string
  source_label?: string
  reviewer: string
  relevance: number
}

interface ResultsDisplayProps {
  result: {
    verdict: "REAL" | "FAKE" | "UNVERIFIED" | "ERROR"
    confidence_score: number
    explanation: string
    reference?: string
    reference_label?: string
    source_links?: SourceLink[]
    key_entities?: any
    sentiment_score?: number
    sentiment_label?: string
    source_credibility?: number
    source_label?: string
    credibility_indicators?: {
      score: number
      hasIssues: boolean
      issues: string[]
    }
    fact_check_results?: FactCheck[]
    source_credibility_detailed?: {
      credibility_score: number
      credibility_label: string
      bias_rating?: string
      bias_indicators?: string[]
      domain_authority?: number | null
      api_checks?: any[]
      reason?: string[]
    }
    content_quality_detailed?: {
      overall_score: number
      quality_label: string
      readability_score?: number
      specificity_score?: number
      specificity_label?: string
      evidence_strength_score?: number
      evidence_strength_label?: string
      structure?: { paragraphs: number; avg_sentence_length: number }
      grammar_issues?: any[]
    }
    clickbait_score?: number
    search_query?: string
    detected_topics?: string[]
    ml_enhanced?: boolean
    analyzed_domain?: string
    ensemble_analysis?: {
      ml_signals?: {
        verdict_explanation?: string
        credibility_indicators?: string[]
        red_flags?: string[]
        sentiment?: string
        writing_quality?: string
      }
    }
  }
  inputContent: string
}

const VERDICT_CONFIG = {
  REAL: {
    label: "Credible",
    cardBg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800/60",
    textColor: "text-emerald-700 dark:text-emerald-400",
    barColor: "bg-emerald-500",
    barWidth: "w-full",
    icon: ShieldCheck,
  },
  FAKE: {
    label: "Likely False",
    cardBg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-200 dark:border-rose-800/60",
    textColor: "text-rose-700 dark:text-rose-400",
    barColor: "bg-rose-500",
    barWidth: "w-1/4",
    icon: ShieldAlert,
  },
  UNVERIFIED: {
    label: "Unverified",
    cardBg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800/60",
    textColor: "text-amber-700 dark:text-amber-500",
    barColor: "bg-amber-500",
    barWidth: "w-1/2",
    icon: ShieldQuestion,
  },
  ERROR: {
    label: "Error",
    cardBg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-200 dark:border-orange-800/60",
    textColor: "text-orange-700 dark:text-orange-400",
    barColor: "bg-orange-500",
    barWidth: "w-1/4",
    icon: AlertTriangle,
  },
}

function buildReasoningParagraph(result: ResultsDisplayProps["result"]): string {
  const mlSignals = result.ensemble_analysis?.ml_signals
  const explanation = mlSignals?.verdict_explanation || result.explanation || ""

  if (explanation && explanation.length > 40) {
    return explanation.replace(/^ML model:\s*\w+\s*\(\d+%\s*confidence\)\.\s*/i, "").trim()
  }

  const verdict = result.verdict
  const sentiment = result.sentiment_label ?? "Neutral"
  const clickbait = (result.clickbait_score ?? 0) * 100
  const issues = result.credibility_indicators?.issues ?? []
  const evidenceLabel = result.content_quality_detailed?.evidence_strength_label ?? ""
  const sourceLabel = (result.source_label || "")
    .replace(/^(Verified Philippine news:|Verified International source:|Suggested sources for:)\s*/i, "")
    .trim()

  if (verdict === "REAL") {
    const parts: string[] = []
    if (sourceLabel) parts.push(`This article was published by ${sourceLabel}, a credible and recognized news organization.`)
    else parts.push("This article comes from a source with credible indicators.")
    if (clickbait < 25) parts.push("The writing style is professional and does not use sensationalist or clickbait language.")
    if (evidenceLabel.toLowerCase().includes("strong")) parts.push("Claims are well-supported by evidence and credible references.")
    else parts.push("The content is factual in tone and presents information in a clear, structured manner.")
    return parts.join(" ")
  }

  if (verdict === "FAKE") {
    const parts: string[] = []
    if (clickbait >= 50) parts.push("This article uses sensationalist and clickbait language designed to provoke an emotional reaction rather than inform.")
    else parts.push("This article raises significant credibility concerns based on multiple detected signals.")
    if (issues.includes("No citations or evidence references")) parts.push("No citations, named sources, or supporting evidence were found to back the claims made.")
    if (sentiment.toLowerCase().includes("emotional")) parts.push(`The overall tone is ${sentiment.toLowerCase()}, which is inconsistent with factual, professional journalism.`)
    if (!parts[parts.length - 1].includes("verification")) parts.push("Independent verification from trusted news outlets is strongly recommended before sharing.")
    return parts.join(" ")
  }

  const parts: string[] = []
  parts.push("This article could not be fully verified based on available signals.")
  if (sourceLabel) parts.push(`The source (${sourceLabel}) has some credibility indicators, but the claims within could not be independently confirmed.`)
  if (issues.includes("No citations or evidence references")) parts.push("No direct citations or source references were found within the article.")
  else parts.push("While the content appears plausible in some areas, key claims lack sufficient supporting evidence.")
  parts.push("Cross-referencing with multiple trusted news outlets is recommended before drawing conclusions.")
  return parts.join(" ")
}

function getSourceTier(credScore: number, verdict: string, hasSource: boolean): "high" | "medium" | "low" | "none" {
  if (!hasSource) return "none"
  if (verdict === "FAKE" || credScore < 40) return "low"
  if (verdict === "UNVERIFIED" || credScore < 65) return "medium"
  return "high"
}

function getContentTier(score: number, verdict: string): "high" | "medium" | "low" {
  if (verdict === "FAKE" || score < 40) return "low"
  if (verdict === "UNVERIFIED" || score < 65) return "medium"
  return "high"
}

function tierLabel(tier: "high" | "medium" | "low" | "none", type: "trust" | "quality") {
  if (type === "trust") {
    return tier === "high" ? "High Trust" : tier === "medium" ? "Medium Trust" : tier === "none" ? "Unknown" : "Low Trust"
  }
  return tier === "high" ? "Good" : tier === "medium" ? "Fair" : "Poor"
}

function tierEmoji(tier: "high" | "medium" | "low" | "none") {
  return tier === "high" ? "🟢" : tier === "medium" ? "🟡" : "🔴"
}

function tierColors(tier: "high" | "medium" | "low" | "none") {
  if (tier === "high") return {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800/60",
    badge: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  }
  if (tier === "medium") return {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800/60",
    badge: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  }
  return {
    bg: "bg-rose-50 dark:bg-rose-950/30",
    border: "border-rose-200 dark:border-rose-800/60",
    badge: "bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400",
    dot: "bg-rose-500",
  }
}

function getSourceBullets(result: ResultsDisplayProps["result"], tier: "high" | "medium" | "low" | "none"): string[] {
  const sourceLabel = (result.source_label || "")
    .replace(/^(Verified Philippine news:|Verified International source:|Suggested sources for:)\s*/i, "")
    .trim()
  const bias = result.source_credibility_detailed?.bias_rating ?? ""
  const issues = result.credibility_indicators?.issues ?? []

  if (tier === "none") {
    return [
      "No publisher, website, or author could be identified for this content",
      "The origin of this article could not be traced to any known or trusted source",
      "Without a verifiable source, the information cannot be independently confirmed",
    ]
  }

  if (tier === "high") {
    return [
      sourceLabel
        ? `Published by ${sourceLabel}, a recognized and reputable news organization`
        : "The source is identified as a credible and established news outlet",
      bias && bias !== "Unable to determine" && bias !== "Neutral"
        ? `Editorial stance leans ${bias.toLowerCase()} — keep this in mind when interpreting the content`
        : "No significant bias indicators were detected in the source's reporting",
      "The publisher's track record and presence in trusted indexes support its reliability",
    ]
  }

  if (tier === "medium") {
    return [
      sourceLabel
        ? `Source was partially identified as ${sourceLabel}, but full verification was not possible`
        : "The source could not be fully identified or independently verified",
      bias && bias !== "Unable to determine"
        ? `Possible ${bias.toLowerCase()} bias detected — consider seeking additional perspectives on this topic`
        : "Bias assessment was inconclusive, so cross-referencing with other outlets is recommended",
      "Some credibility signals are present, but independent verification of the claims is still advised",
    ]
  }

  return [
    "The source is unknown, unverified, or not found in any recognized news index",
    issues.some(i => i.toLowerCase().includes("citation"))
      ? "No verifiable author or publisher attribution was found anywhere in this content"
      : "The publisher's identity and editorial credibility could not be confirmed",
    "This content does not match any recognized or reputable news references we checked",
  ]
}

function getContentBullets(result: ResultsDisplayProps["result"], tier: "high" | "medium" | "low"): string[] {
  const issues = result.credibility_indicators?.issues ?? []
  const mlSignals = result.ensemble_analysis?.ml_signals
  const evidenceLabel = result.content_quality_detailed?.evidence_strength_label ?? ""
  const clickbait = (result.clickbait_score ?? 0) * 100
  const sentiment = result.sentiment_label ?? "Neutral"
  const writingQuality = mlSignals?.writing_quality ?? ""

  if (tier === "high") {
    return [
      evidenceLabel.toLowerCase().includes("strong")
        ? "Claims are well-backed by evidence, named sources, or credible references"
        : "The article contains relevant context and supporting information for its claims",
      clickbait < 25
        ? "Writing style is professional with no clickbait or sensationalist language detected"
        : "Minimal sensationalism was detected and the tone remains mostly informative",
      writingQuality === "professional"
        ? "Content is clearly structured, professionally written, and easy to follow"
        : "The article presents its information in a clear and readable manner throughout",
    ]
  }

  if (tier === "medium") {
    return [
      evidenceLabel
        ? `Evidence strength is rated ${evidenceLabel.toLowerCase()} — some claims would benefit from additional sourcing`
        : "Some claims in this article lack sufficient supporting evidence or named sources",
      sentiment.toLowerCase().includes("emotional")
        ? `A ${sentiment.toLowerCase()} tone was detected in parts of the article, which may reduce overall objectivity`
        : "The tone is mostly neutral, but key claims should still be independently verified",
      issues.includes("No citations or evidence references")
        ? "No direct citations or source references were found within the body of the article"
        : "The article has partial structure, though certain sections would benefit from more clarity and sourcing",
    ]
  }

  return [
    issues.includes("No citations or evidence references")
      ? "No citations, named sources, or supporting evidence were provided to back the claims made"
      : "The article's claims are largely unsupported and difficult to verify with any external source",
    clickbait >= 50
      ? "Sensationalist and clickbait language was detected, suggesting the article is designed to provoke rather than inform"
      : sentiment.toLowerCase().includes("emotional")
        ? `A highly ${sentiment.toLowerCase()} tone was found throughout, prioritizing reaction over factual reporting`
        : "Key claims appear exaggerated or are presented without any factual grounding or attribution",
    issues.some(i => i.toLowerCase().includes("caps"))
      ? "Excessive ALL CAPS text was detected, a common stylistic marker in low-quality or misleading content"
      : issues.some(i => i.toLowerCase().includes("vague"))
        ? "The article relies heavily on vague, unattributed statements with no identifiable sources cited"
        : "The overall writing quality and factual specificity are too low to consider this a reliable source",
  ]
}

function SourceCredibilityCard({ result, verdict }: { result: ResultsDisplayProps["result"]; verdict: string }) {
  const rawCred = (result.source_credibility_detailed?.credibility_score ?? 0.5) * 100
  let credScore: number
  if (verdict === "REAL") credScore = Math.max(70, Math.min(100, rawCred))
  else if (verdict === "FAKE") credScore = Math.min(30, rawCred)
  else credScore = Math.max(30, Math.min(50, rawCred))

  const sourceLabel = result.source_label || ""
  const hasSource =
    sourceLabel.toLowerCase().includes("verified") ||
    sourceLabel.toLowerCase().includes("suggested") ||
    (result.source_credibility || 0) > 0

  const tier = getSourceTier(credScore, verdict, hasSource)
  const colors = tierColors(tier)
  const bullets = getSourceBullets(result, tier)

  return (
    <Card className={`p-5 border shadow-sm ${colors.bg} ${colors.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        <h5 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Source Credibility</h5>
        <span className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors.badge}`}>
          {tierEmoji(tier)} {tierLabel(tier, "trust")}
        </span>
      </div>
      <ul className="space-y-2">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} />
            <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{b}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function ContentQualityCard({ result, verdict }: { result: ResultsDisplayProps["result"]; verdict: string }) {
  const rawContent = (result.content_quality_detailed?.overall_score ?? 0.5) * 100
  let contentScore: number
  if (verdict === "REAL") contentScore = Math.max(70, Math.min(100, rawContent))
  else if (verdict === "FAKE") contentScore = Math.min(40, rawContent)
  else contentScore = Math.max(40, Math.min(60, rawContent))

  const tier = getContentTier(contentScore, verdict)
  const colors = tierColors(tier)
  const bullets = getContentBullets(result, tier)

  return (
    <Card className={`p-5 border shadow-sm ${colors.bg} ${colors.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        <h5 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Content Quality</h5>
        <span className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors.badge}`}>
          {tierEmoji(tier)} {tierLabel(tier, "quality")}
        </span>
      </div>
      <ul className="space-y-2">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} />
            <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{b}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function FinalTakeaway({ verdict, credScore, contentScore, hasSource }: {
  verdict: string; credScore: number; contentScore: number; hasSource: boolean
}) {
  const sourceTier = getSourceTier(credScore, verdict, hasSource)
  const contentTier = getContentTier(contentScore, verdict)

  let icon = <Info className="w-4 h-4 shrink-0 mt-0.5" />
  let bg = "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/60"
  let textColor = "text-blue-700 dark:text-blue-300"
  let message = ""

  if (verdict === "REAL" && sourceTier === "high" && contentTier === "high") {
    icon = <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
    bg = "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60"
    textColor = "text-emerald-700 dark:text-emerald-300"
    message = "This article appears credible. The source is trusted and the content is well-supported. Always cross-check critical claims with primary sources before sharing."
  } else if (verdict === "FAKE" || (sourceTier === "low" && contentTier === "low")) {
    icon = <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
    bg = "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60"
    textColor = "text-rose-700 dark:text-rose-300"
    message = "This article shows strong indicators of misinformation. Do not share without independent verification from multiple trusted news outlets."
  } else if (sourceTier === "none") {
    icon = <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
    bg = "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60"
    textColor = "text-amber-700 dark:text-amber-400"
    message = "No identifiable source was found. Even if the content reads well, the absence of a verifiable publisher means this should be treated with caution."
  } else if (verdict === "UNVERIFIED") {
    icon = <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
    bg = "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60"
    textColor = "text-amber-700 dark:text-amber-400"
    message = "This article could not be fully verified. Some signals suggest credibility while others raise concern — seek confirmation from multiple trusted sources before drawing conclusions."
  } else {
    message = "Mixed credibility signals were detected. Cross-reference this content with established news outlets before relying on or sharing it."
  }

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${bg}`}>
      <div className="flex items-start gap-2.5">
        {icon}
        <div>
          <p className={`text-xs font-semibold mb-0.5 ${textColor}`}>Final Takeaway</p>
          <p className={`text-xs leading-relaxed ${textColor}`}>{message}</p>
        </div>
      </div>
    </div>
  )
}

function ConclusionBadge({ text }: { text: string }) {
  const lower = text.toLowerCase()
  if (lower.includes("true") || lower.includes("accurate") || lower.includes("correct")) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
        <CheckCircle2 className="w-3 h-3" /> Verified
      </span>
    )
  }
  if (lower.includes("false") || lower.includes("wrong") || lower.includes("mislead")) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-semibold">
        <AlertCircle className="w-3 h-3" /> Disputed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-500 text-xs font-semibold">
      <Info className="w-3 h-3" /> Unverified
    </span>
  )
}

function FactorBar({ label, value, color = "bg-blue-500", detail }: {
  label: string; value: number; color?: string; detail?: string
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{detail || `${pct}%`}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Main Export ───────────────────────────────────────────────────────────
export default function ResultsDisplay({ result, inputContent }: ResultsDisplayProps) {
  if (result.verdict === "ERROR") {
    return (
      <Card className="p-6 bg-orange-50 dark:bg-orange-950/40 border-2 border-orange-200 dark:border-orange-800/60 shadow-sm">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-orange-700 dark:text-orange-400 mb-1">Unable to Process</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{result.explanation}</p>
            <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-4 border border-orange-200 dark:border-orange-800/60 space-y-1">
              <p className="text-xs font-semibold text-orange-900 dark:text-orange-200 mb-2">Suggestions:</p>
              {[
                "Check that your content is valid and properly formatted",
                "Ensure URLs are accessible and contain article content",
                "Avoid overly repetitive or template-like content",
                "Provide meaningful text with varied language",
              ].map((s, i) => (
                <p key={i} className="text-xs text-orange-800 dark:text-orange-300 flex items-start gap-2">
                  <span className="shrink-0 mt-0.5">•</span>{s}
                </p>
              ))}
            </div>
          </div>
        </div>
      </Card>
    )
  }

  const cfg = VERDICT_CONFIG[result.verdict]
  const VerdictIcon = cfg.icon
  const reasoning = buildReasoningParagraph(result)

  const rawCred = (result.source_credibility_detailed?.credibility_score ?? 0.5) * 100
  const rawContent = (result.content_quality_detailed?.overall_score ?? 0.5) * 100
  let credScore: number, contentScore: number
  if (result.verdict === "REAL") {
    credScore = Math.max(70, Math.min(100, rawCred))
    contentScore = Math.max(70, Math.min(100, rawContent))
  } else if (result.verdict === "FAKE") {
    credScore = Math.min(30, rawCred)
    contentScore = Math.min(40, rawContent)
  } else {
    credScore = Math.max(30, Math.min(50, rawCred))
    contentScore = Math.max(40, Math.min(60, rawContent))
  }

  const sourceLabel = result.source_label || ""
  const hasSource =
    sourceLabel.toLowerCase().includes("verified") ||
    sourceLabel.toLowerCase().includes("suggested") ||
    (result.source_credibility || 0) > 0

  return (
    <div className="space-y-4">

      {/* ── VERDICT CARD ─────────────────────────────────────────────── */}
      <Card className={`border-2 shadow-sm ${cfg.border} ${cfg.cardBg}`}>
        <div className="p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <VerdictIcon className={`w-5 h-5 shrink-0 ${cfg.textColor}`} />
            <h3 className={`text-lg font-bold ${cfg.textColor}`}>{cfg.label}</h3>
          </div>

          <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-4">
            <div className={`h-full rounded-full transition-all duration-700 ${cfg.barColor} ${cfg.barWidth}`} />
          </div>

          <p className={`text-sm leading-relaxed ${cfg.textColor}`}>{reasoning}</p>
        </div>
      </Card>

      {/* SOURCE LINKS */}
      <DynamicSourceLinks
        links={result.source_links ?? []}
        verdict={result.verdict}
        searchQuery={result.search_query}
        detectedTopics={result.detected_topics}
        analyzedDomain={result.analyzed_domain}
      />

      {/* METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SourceCredibilityCard result={result} verdict={result.verdict} />
        <ContentQualityCard result={result} verdict={result.verdict} />
      </div>

      {/* FACT-CHECKS */}
      <FactCheckSection checks={result.fact_check_results ?? []} />

      {/* FINAL TAKEAWAY */}
      <FinalTakeaway
        verdict={result.verdict}
        credScore={credScore}
        contentScore={contentScore}
        hasSource={hasSource}
      />
    </div>
  )
}

// ── Source Links ──────────────────────────────────────────────────────────
function DynamicSourceLinks({ links, verdict, searchQuery, detectedTopics, analyzedDomain }: {
  links: SourceLink[]
  verdict: "REAL" | "FAKE" | "UNVERIFIED"
  searchQuery?: string
  detectedTopics?: string[]
  analyzedDomain?: string
}) {
  const isReal = verdict === "REAL"
  const headerText =
    verdict === "REAL" ? "Verify with Trusted News Sources" :
    verdict === "FAKE" ? "Cross-check with Trusted Sources" :
    "Suggested Sources for Verification"

  const topicLabel = detectedTopics && detectedTopics.length > 0
    ? detectedTopics.slice(0, 2).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(" · ")
    : null

  const cardStyle = isReal
    ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60"
    : "bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-slate-700"
  const headingStyle = isReal
    ? "text-emerald-900 dark:text-emerald-300"
    : "text-slate-800 dark:text-slate-200"

  return (
    <Card className={`p-5 shadow-sm ${cardStyle}`}>
      <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
        <h4 className={`font-semibold flex items-center gap-2 text-sm ${headingStyle}`}>
          {isReal
            ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            : <Globe className="w-4 h-4 text-blue-500" />}
          {headerText}
        </h4>
        {topicLabel && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">
            {topicLabel}
          </span>
        )}
      </div>

      {links.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-800/30 p-5 text-center space-y-1.5">
          <Info className="w-4 h-4 text-slate-400 dark:text-slate-500 mx-auto" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No related articles found for this content.</p>
          <p className="text-xs text-slate-500 dark:text-slate-500">Verify this information manually from reputable news outlets.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((src, idx) => {
            // First link is the article's own source if it matches the analyzed domain
            const isOwnSource = idx === 0 && analyzedDomain && (
              src.article_url?.includes(analyzedDomain) ||
              src.url?.includes(analyzedDomain) ||
              src.homepage_url?.includes(analyzedDomain)
            )
            const isArticle = !!src.article_url

            return (
              <a key={idx} href={src.url} target="_blank" rel="noopener noreferrer"
                className={`group flex items-center justify-between p-3 rounded-xl border transition-all duration-150 ${
                  isReal
                    ? "bg-white dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/60 hover:border-emerald-400 hover:shadow-sm"
                    : "bg-white dark:bg-slate-800/50 border-blue-200 dark:border-slate-600/60 hover:border-blue-400 hover:shadow-sm"
                }`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isReal ? "bg-emerald-100 dark:bg-emerald-900/50" : "bg-blue-100 dark:bg-slate-700"
                  }`}>
                    <Newspaper className={`w-3.5 h-3.5 ${isReal ? "text-emerald-600 dark:text-emerald-400" : "text-blue-500 dark:text-blue-400"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm font-medium truncate ${
                        isReal ? "text-emerald-700 dark:text-emerald-300" : "text-blue-700 dark:text-blue-300"
                      }`}>{src.name}</p>
                      {isOwnSource && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 shrink-0">
                          <Star className="w-2.5 h-2.5" />
                          Source
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {isOwnSource
                        ? "Original article source"
                        : isArticle
                          ? "Related article found"
                          : "Search related articles"}
                    </p>
                  </div>
                </div>
                <ExternalLink className={`w-3.5 h-3.5 shrink-0 ml-2 transition-transform group-hover:translate-x-0.5 ${
                  isReal ? "text-emerald-500 dark:text-emerald-400" : "text-blue-400 dark:text-blue-500"
                }`} />
              </a>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ── Fact Check Section ────────────────────────────────────────────────────
function FactCheckSection({ checks }: { checks: FactCheck[] }) {
  const [expanded, setExpanded] = useState<number | null>(null)

  // Filter to only genuinely relevant fact checks
  const relevantChecks = checks.filter(c =>
    c.reviewer !== "Manual Verification Required" &&
    (c.relevance > 0.05 || c.source?.startsWith("http"))
  ).slice(0, 4)

  return (
    <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="w-4 h-4 text-indigo-500" />
        <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Related Fact-Check Results</h4>
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          {relevantChecks.length} result{relevantChecks.length !== 1 ? "s" : ""}
        </span>
      </div>

      {relevantChecks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-6 text-center space-y-2">
          <Info className="w-5 h-5 text-slate-400 dark:text-slate-500 mx-auto" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No matching fact-checks found</p>
          <p className="text-xs text-slate-500 dark:text-slate-500 max-w-xs mx-auto">
            No external fact-check database matched the claims in this article. Manually verify with trusted sources like Rappler's Fact Check, Reuters Fact Check, or AP Fact Check.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {[
              { name: "Rappler Fact Check", url: "https://www.rappler.com/topic/fact-check/" },
              { name: "Reuters Fact Check", url: "https://www.reuters.com/fact-check/" },
              { name: "AP Fact Check", url: "https://apnews.com/hub/ap-fact-check" },
            ].map(fc => (
              <a
                key={fc.name}
                href={fc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition"
              >
                <ExternalLink className="w-3 h-3" />
                {fc.name}
              </a>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {relevantChecks.map((check, idx) => {
            const validLink = check.source && check.source !== "Source not identified" && check.source.startsWith("http")
            const isExpanded = expanded === idx
            return (
              <div key={idx} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 overflow-hidden">
                <button onClick={() => setExpanded(isExpanded ? null : idx)}
                  className="w-full text-left p-4 flex items-start justify-between gap-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <ConclusionBadge text={check.conclusion} />
                      <span className="text-xs text-slate-500 dark:text-slate-400">— {check.reviewer || "News Source"}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-2">
                      &ldquo;{check.claim.substring(0, 120)}{check.claim.length > 120 ? "…" : ""}&rdquo;
                    </p>
                  </div>
                  <span className="shrink-0 mt-0.5">
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-slate-400" />
                      : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-200 dark:border-slate-700 space-y-3 bg-white dark:bg-slate-900/50">
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-3">{check.conclusion}</p>
                    {check.relevance > 0 && (
                      <FactorBar label="Relevance to your content" value={Math.round(check.relevance * 100)} color="bg-indigo-500" />
                    )}
                    {validLink ? (
                      <a href={check.source} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Read article on {check.source_label || check.reviewer || "source"}
                      </a>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-500 italic">Verify with trusted news outlets</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {relevantChecks.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/60">
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Fact-check results are sourced from external APIs. Always cross-reference with multiple trusted outlets before drawing conclusions.
          </p>
        </div>
      )}
    </Card>
  )
}
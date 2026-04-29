"use client"
// components/results-display.tsx

import { Card } from "@/components/ui/card"
import {
  ExternalLink, AlertCircle, CheckCircle2, AlertTriangle, Globe, Info,
  ChevronDown, ChevronUp, Newspaper, ShieldCheck, ShieldAlert, ShieldQuestion,
  BarChart2, FileText, AlertOctagon, BookOpen, Languages,
} from "lucide-react"
import { useState } from "react"
import { generateArticleSummary, buildSourceSearchUrlShared, detectLanguage } from "@/lib/bias-utils"

// ── Types ─────────────────────────────────────────────────────────────────
interface SourceLink { name: string; url: string; article_url?: string; search_url?: string; homepage_url?: string }
interface FactCheck  { claim: string; conclusion: string; source: string; source_label?: string; reviewer: string; relevance: number }

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
    credibility_indicators?: { score: number; hasIssues: boolean; issues: string[] }
    fact_check_results?: FactCheck[]
    source_credibility_detailed?: {
      credibility_score: number; credibility_label: string
      bias_indicators?: string[]; domain_authority?: number | null; api_checks?: any[]; reason?: string[]
    }
    content_quality_detailed?: {
      overall_score: number; quality_label: string; readability_score?: number
      specificity_score?: number; specificity_label?: string; evidence_strength_score?: number
      evidence_strength_label?: string; structure?: { paragraphs: number; avg_sentence_length: number }; grammar_issues?: any[]
    }
    clickbait_score?: number
    search_query?: string
    detected_topics?: string[]
    ml_enhanced?: boolean
    analyzed_domain?: string
    article_title?: string
    ensemble_analysis?: {
      ml_signals?: { verdict_explanation?: string; credibility_indicators?: string[]; red_flags?: string[]; sentiment?: string; writing_quality?: string }
    }
    language_detection?: {
      isFilipino: boolean
      confidence: number
      detectedMarkers: string[]
    }
    article_summary?: {
      summary: string
      key_claims: Array<{ claim: string; status: "verified" | "unverified" | "disputed" }>
      word_count: number
      reading_time_minutes: number
    }
  }
  inputContent: string
}

// ── Verdict config ────────────────────────────────────────────────────────
const VERDICT_CONFIG = {
  REAL:       { label: "Credible",     cardBg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-800/60", textColor: "text-emerald-700 dark:text-emerald-400", barColor: "bg-emerald-500", icon: ShieldCheck  },
  FAKE:       { label: "Likely False", cardBg: "bg-rose-50 dark:bg-rose-950/40",       border: "border-rose-200 dark:border-rose-800/60",       textColor: "text-rose-700 dark:text-rose-400",       barColor: "bg-rose-500",    icon: ShieldAlert  },
  UNVERIFIED: { label: "Unverified",   cardBg: "bg-amber-50 dark:bg-amber-950/40",     border: "border-amber-200 dark:border-amber-800/60",     textColor: "text-amber-700 dark:text-amber-500",     barColor: "bg-amber-500",   icon: ShieldQuestion },
  ERROR:      { label: "Error",        cardBg: "bg-orange-50 dark:bg-orange-950/40",   border: "border-orange-200 dark:border-orange-800/60",   textColor: "text-orange-700 dark:text-orange-400",   barColor: "bg-orange-500",  icon: AlertTriangle },
}

// ── Helpers ───────────────────────────────────────────────────────────────
function buildReasoningParagraph(result: ResultsDisplayProps["result"]): string {
  const mlSignals   = result.ensemble_analysis?.ml_signals
  const explanation = mlSignals?.verdict_explanation || result.explanation || ""
  if (explanation && explanation.length > 40) {
    return explanation.replace(/^ML model:\s*\w+\s*\(\d+%\s*confidence\)\.\s*/i, "").trim()
  }
  const verdict    = result.verdict
  const sentiment  = result.sentiment_label ?? "Neutral"
  const clickbait  = (result.clickbait_score ?? 0) * 100
  const issues     = result.credibility_indicators?.issues ?? []
  const evidenceLabel = result.content_quality_detailed?.evidence_strength_label ?? ""
  const sourceLabel   = (result.source_label || "").replace(/^(Verified Philippine news:|Verified International source:|Suggested sources for:)\s*/i, "").trim()

  if (verdict === "REAL") {
    const parts: string[] = []
    if (sourceLabel) parts.push(`Published by ${sourceLabel}, a credible and recognized news organization.`)
    else parts.push("This article comes from a source with credible indicators.")
    if (clickbait < 25) parts.push("The writing style is professional and does not use sensationalist language.")
    if (evidenceLabel.toLowerCase().includes("strong")) parts.push("Claims are well-supported by evidence.")
    return parts.join(" ")
  }
  if (verdict === "FAKE") {
    const parts: string[] = []
    if (clickbait >= 50) parts.push("This article uses sensationalist language designed to provoke rather than inform.")
    else parts.push("This article raises significant credibility concerns based on multiple detected signals.")
    if (issues.includes("No citations or evidence references")) parts.push("No citations or supporting evidence were found.")
    if (sentiment.toLowerCase().includes("emotional")) parts.push(`The tone is ${sentiment.toLowerCase()}, inconsistent with factual journalism.`)
    return parts.join(" ")
  }
  return "This article could not be fully verified. Cross-referencing with multiple trusted news outlets is recommended before drawing conclusions."
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
function tierColors(tier: "high" | "medium" | "low" | "none") {
  if (tier === "high")   return { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800/60", badge: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500", bar: "bg-emerald-500" }
  if (tier === "medium") return { bg: "bg-amber-50 dark:bg-amber-950/30",     border: "border-amber-200 dark:border-amber-800/60",     badge: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400",     dot: "bg-amber-500",   bar: "bg-amber-500"   }
  return                        { bg: "bg-rose-50 dark:bg-rose-950/30",        border: "border-rose-200 dark:border-rose-800/60",        badge: "bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400",         dot: "bg-rose-500",    bar: "bg-rose-500"    }
}
function tierLabel(tier: "high" | "medium" | "low" | "none", type: "trust" | "quality") {
  if (type === "trust") return tier === "high" ? "High Trust" : tier === "medium" ? "Medium Trust" : tier === "none" ? "Unknown" : "Low Trust"
  return tier === "high" ? "Good" : tier === "medium" ? "Fair" : "Poor"
}

function getSourceBullets(result: ResultsDisplayProps["result"], tier: "high" | "medium" | "low" | "none"): string[] {
  const sourceLabel = (result.source_label || "").replace(/^(Verified Philippine news:|Verified International source:|Suggested sources for:)\s*/i, "").trim()
  const issues = result.credibility_indicators?.issues ?? []
  if (tier === "none") return ["No publisher or website could be identified", "The origin of this article cannot be traced to a known source", "Without a verifiable source, information cannot be confirmed"]
  if (tier === "high") return [
    sourceLabel ? `Published by ${sourceLabel}, a recognized and reputable news organization` : "Source identified as a credible and established news outlet",
    "No significant bias indicators were detected",
    "Publisher track record supports its reliability",
  ]
  if (tier === "medium") return [
    sourceLabel ? `Source partially identified as ${sourceLabel}, but full verification was not possible` : "The source could not be fully identified or independently verified",
    "Bias assessment was inconclusive",
    "Cross-referencing with other outlets is recommended",
  ]
  return [
    "The source is unknown, unverified, or not in any recognized news index",
    issues.some(i => i.toLowerCase().includes("citation")) ? "No verifiable author or publisher attribution found" : "Publisher identity and editorial credibility could not be confirmed",
    "Content does not match any recognized or reputable news references",
  ]
}

function getContentBullets(result: ResultsDisplayProps["result"], tier: "high" | "medium" | "low"): string[] {
  const issues        = result.credibility_indicators?.issues ?? []
  const mlSignals     = result.ensemble_analysis?.ml_signals
  const evidenceLabel = result.content_quality_detailed?.evidence_strength_label ?? ""
  const clickbait     = (result.clickbait_score ?? 0) * 100
  const sentiment     = result.sentiment_label ?? "Neutral"
  if (tier === "high") return [
    evidenceLabel.toLowerCase().includes("strong") ? "Claims are well-backed by evidence and credible references" : "Article contains relevant context and supporting information",
    clickbait < 25 ? "Professional writing style with no clickbait detected" : "Minimal sensationalism, tone remains mostly informative",
    mlSignals?.writing_quality === "professional" ? "Content is clearly structured and professionally written" : "Information is presented in a clear and readable manner",
  ]
  if (tier === "medium") return [
    evidenceLabel ? `Evidence strength is rated ${evidenceLabel.toLowerCase()} — some claims need additional sourcing` : "Some claims lack sufficient supporting evidence",
    sentiment.toLowerCase().includes("emotional") ? `A ${sentiment.toLowerCase()} tone was detected, which may reduce objectivity` : "Tone is mostly neutral but key claims should be verified",
    issues.includes("No citations or evidence references") ? "No direct citations were found in the body of the article" : "Partial structure present, some sections need more sourcing",
  ]
  return [
    issues.includes("No citations or evidence references") ? "No citations or supporting evidence provided" : "Claims are largely unsupported and difficult to verify",
    clickbait >= 50 ? "Sensationalist language detected — designed to provoke rather than inform" : `Highly ${sentiment.toLowerCase()} tone found, prioritizing reaction over facts`,
    "Overall writing quality and factual specificity are too low to be reliable",
  ]
}

// ── Sub-components ────────────────────────────────────────────────────────
function CredibilityProgressBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-600 dark:text-slate-400">{label}</span>
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{pct}%</span>
      </div>
      <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function SourceCredibilityCard({ result, verdict }: { result: ResultsDisplayProps["result"]; verdict: string }) {
  const rawCred = (result.source_credibility_detailed?.credibility_score ?? 0.5) * 100
  const credScore = verdict === "REAL" ? Math.max(65, Math.min(100, rawCred)) : verdict === "FAKE" ? Math.min(45, rawCred) : Math.max(30, Math.min(75, rawCred))
  const sourceLabel = result.source_label || ""
  const hasSource   = sourceLabel.toLowerCase().includes("verified") || sourceLabel.toLowerCase().includes("suggested") || (result.source_credibility || 0) > 0
  const tier   = getSourceTier(credScore, verdict, hasSource)
  const colors = tierColors(tier)
  const bullets = getSourceBullets(result, tier)
  return (
    <Card className={`p-5 border shadow-sm ${colors.bg} ${colors.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        <h5 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Source Credibility</h5>
        <span className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors.badge}`}>{tierLabel(tier, "trust")}</span>
      </div>
      <div className="mb-3"><CredibilityProgressBar label="Credibility Score" value={credScore} color={colors.bar} /></div>
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
  const contentScore = verdict === "REAL" ? Math.max(65, Math.min(100, rawContent)) : verdict === "FAKE" ? Math.min(38, rawContent) : Math.max(35, Math.min(70, rawContent))
  const tier    = getContentTier(contentScore, verdict)
  const colors  = tierColors(tier)
  const bullets = getContentBullets(result, tier)
  const sentimentScore = result.sentiment_score !== undefined ? Math.round(result.sentiment_score * 100) : null
  const sentimentColor = sentimentScore !== null ? (sentimentScore > 60 ? "bg-rose-500" : sentimentScore > 35 ? "bg-amber-500" : "bg-emerald-500") : "bg-slate-400"
  return (
    <Card className={`p-5 border shadow-sm ${colors.bg} ${colors.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        <h5 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Content Quality</h5>
        <span className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors.badge}`}>{tierLabel(tier, "quality")}</span>
      </div>
      <div className="mb-3 space-y-2">
        <CredibilityProgressBar label="Content Quality" value={contentScore} color={colors.bar} />
        {sentimentScore !== null && <CredibilityProgressBar label="Emotional Tone" value={sentimentScore} color={sentimentColor} />}
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

// ── Article Summary ───────────────────────────────────────────────────────
function ArticleSummaryCard({ summary, title }: { summary: NonNullable<ResultsDisplayProps["result"]["article_summary"]>; title?: string }) {
  return (
    <Card className="p-5 border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        <h5 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Article Summary</h5>
      </div>
      {title && (
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2 leading-snug">{title}</p>
      )}
      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        {summary.summary || "No summary available for this content."}
      </p>
    </Card>
  )
}

// ── Language Detection ────────────────────────────────────────────────────
function FilipinoLanguageCard({ language }: { language: NonNullable<ResultsDisplayProps["result"]["language_detection"]> }) {
  return (
    <Card className="p-4 border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-sm">
      <div className="flex items-center gap-2">
        <Languages className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        <h5 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Language Detected</h5>
        <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300">
          🇵🇭 Filipino / Tagalog
        </span>
      </div>
      <div className="mt-3">
        <CredibilityProgressBar label="Filipino confidence" value={language.confidence} color="bg-yellow-500" />
        {language.detectedMarkers.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {language.detectedMarkers.slice(0, 8).map((m, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

// ── Fact-Check & Verification ─────────────────────────────────────────────
// Determines if source domain is "credible" based on verdict + source tier
function isSourceCredible(verdict: string, sourceTier: "high" | "medium" | "low" | "none"): boolean {
  return verdict === "REAL" || sourceTier === "high"
}

// Builds dynamic fact-checker links based on detected topics / content
function buildFactCheckerLinks(detectedTopics?: string[]) {
  // Always include these core fact-checkers
  const links = [
    { name: "Rappler FC", url: "https://www.rappler.com/topic/fact-check/" },
    { name: "Reuters FC", url: "https://www.reuters.com/fact-check/" },
    { name: "AP FC",      url: "https://apnews.com/hub/ap-fact-check" },
    { name: "Snopes",     url: "https://www.snopes.com" },
  ]
  return links
}

function buildSearchLinks(searchQuery?: string, detectedTopics?: string[]) {
  const q = encodeURIComponent((searchQuery || "").substring(0, 80))
  return [
    { name: "Rappler",     url: `https://www.rappler.com/search?q=${q}` },
    { name: "Reuters",     url: `https://www.reuters.com/search/news?blob=${q}` },
    { name: "AP News",     url: `https://apnews.com/search?q=${q}` },
    { name: "Google News", url: `https://news.google.com/search?q=${q}` },
  ]
}

function SearchLinks({ query, topics, label = "Search this topic:" }: { query?: string; topics?: string[]; label?: string }) {
  const links = buildSearchLinks(query, topics)
  return (
    <div className="flex items-center flex-wrap gap-1.5 text-xs text-slate-500 dark:text-slate-400">
      <span className="text-slate-400 dark:text-slate-500">🔍 {label}</span>
      {links.map(l => (
        <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer"
          className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition font-medium">
          {l.name}
        </a>
      ))}
    </div>
  )
}

function FactCheckerLinks({ label = "Check these fact-checkers:" }: { label?: string }) {
  const links = buildFactCheckerLinks()
  return (
    <div className="flex items-center flex-wrap gap-1.5 text-xs text-slate-500 dark:text-slate-400">
      <span className="text-slate-400 dark:text-slate-500">🔍 {label}</span>
      {links.map(l => (
        <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer"
          className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition font-medium">
          {l.name}
        </a>
      ))}
    </div>
  )
}

function FactCheckAndVerification({
  verdict, factChecks, sourceLinks, searchQuery, detectedTopics, sourceTier,
}: {
  verdict: "REAL" | "FAKE" | "UNVERIFIED"
  factChecks: FactCheck[]
  sourceLinks: SourceLink[]
  searchQuery?: string
  detectedTopics?: string[]
  sourceTier: "high" | "medium" | "low" | "none"
}) {
  const credible = isSourceCredible(verdict, sourceTier)

  // Filter: only real article links (not homepage-only)
  const relatedArticles = sourceLinks.filter(s =>
    s.article_url && s.article_url !== s.homepage_url && s.article_url.startsWith("http")
  ).slice(0, 3)

  // Filter: only real, relevant fact-check results
  const validFactChecks = factChecks.filter(f =>
    f.reviewer !== "Manual Verification Required" &&
    f.source?.startsWith("http") &&
    f.relevance > 0.05
  ).slice(0, 3)

  // ── SCENARIO LOGIC ──────────────────────────────────────────────────────
  // credible + may related articles
  if (credible && relatedArticles.length > 0) {
    return (
      <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-indigo-500" />
          <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Fact-Check & Verification</h4>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            Other outlets reporting this story:
          </p>
          {relatedArticles.map((src, i) => (
            <a key={i} href={src.article_url!} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition group">
              <div className="flex items-center gap-2 min-w-0">
                <Newspaper className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{src.name}</span>
              </div>
              <ExternalLink className="w-3 h-3 text-slate-400 shrink-0 group-hover:text-slate-600 transition" />
            </a>
          ))}
        </div>
        <SearchLinks query={searchQuery} topics={detectedTopics} />
      </Card>
    )
  }

  // credible + walang nahanap
  if (credible && relatedArticles.length === 0) {
    return (
      <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-indigo-500" />
          <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Fact-Check & Verification</h4>
        </div>
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60">
          <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            No additional coverage found. This may be a local or developing story. The source itself is credible.
          </p>
        </div>
        <SearchLinks query={searchQuery} topics={detectedTopics} label="Search this topic on:" />
      </Card>
    )
  }

  // likely false + may fact-check result
  if (verdict === "FAKE" && validFactChecks.length > 0) {
    return (
      <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-indigo-500" />
          <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Fact-Check & Verification</h4>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
            🔴 Fact-Check Found:
          </p>
          {validFactChecks.map((fc, i) => (
            <a key={i} href={fc.source} target="_blank" rel="noopener noreferrer"
              className="flex items-start justify-between gap-2 p-3 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition group">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-rose-700 dark:text-rose-300 truncate">{fc.claim.substring(0, 100)}{fc.claim.length > 100 ? "…" : ""}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Rated <span className="font-semibold">{fc.conclusion.substring(0, 60)}</span> by {fc.reviewer}</p>
              </div>
              <ExternalLink className="w-3 h-3 text-rose-400 shrink-0 mt-0.5 group-hover:text-rose-600 transition" />
            </a>
          ))}
        </div>
        <div className="flex items-center gap-1.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Do not share without verification.</p>
        </div>
        <FactCheckerLinks label="Check these fact-checkers:" />
      </Card>
    )
  }

  // likely false + walang fact-check
  if (verdict === "FAKE" && validFactChecks.length === 0) {
    return (
      <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-indigo-500" />
          <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Fact-Check & Verification</h4>
        </div>
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">No published fact-check found yet.</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
              No credible outlets found covering this claim. Absence of coverage is itself a red flag.
            </p>
          </div>
        </div>
        <FactCheckerLinks label="Verify manually:" />
      </Card>
    )
  }

  // unverified + may related articles
  if (verdict === "UNVERIFIED" && relatedArticles.length > 0) {
    return (
      <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-indigo-500" />
          <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Fact-Check & Verification</h4>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Newspaper className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            Related coverage found — verify these:
          </p>
          {relatedArticles.map((src, i) => (
            <a key={i} href={src.article_url!} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition group">
              <div className="flex items-center gap-2 min-w-0">
                <Newspaper className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{src.name}</span>
              </div>
              <ExternalLink className="w-3 h-3 text-slate-400 shrink-0 group-hover:text-slate-600 transition" />
            </a>
          ))}
        </div>
        <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <p>These articles cover similar topics but may not confirm or deny the specific claim.</p>
        </div>
        <SearchLinks query={searchQuery} topics={detectedTopics} label="Search further:" />
      </Card>
    )
  }

  // unverified + walang nahanap (default / fallback)
  return (
    <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <BarChart2 className="w-4 h-4 text-indigo-500" />
        <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Fact-Check & Verification</h4>
      </div>
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          No coverage found from trusted outlets. This could mean the story is too new, too local, or not picked up by major outlets.
        </p>
      </div>
      <SearchLinks query={searchQuery} topics={detectedTopics} label="Verify manually before sharing:" />
    </Card>
  )
}

// ── Final Takeaway ────────────────────────────────────────────────────────
function FinalTakeaway({ verdict, credScore, contentScore, hasSource }: { verdict: string; credScore: number; contentScore: number; hasSource: boolean }) {
  const sourceTier  = getSourceTier(credScore, verdict, hasSource)
  const contentTier = getContentTier(contentScore, verdict)
  let icon = <Info className="w-4 h-4 shrink-0 mt-0.5" />
  let bg   = "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/60"
  let textColor = "text-blue-700 dark:text-blue-300"
  let message   = ""

  if (verdict === "REAL" && sourceTier === "high" && contentTier === "high") {
    icon = <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
    bg   = "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60"
    textColor = "text-emerald-700 dark:text-emerald-300"
    message   = "This article appears credible. The source is trusted and the content is well-supported. Always cross-check critical claims with primary sources before sharing."
  } else if (verdict === "FAKE" || (sourceTier === "low" && contentTier === "low")) {
    icon = <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
    bg   = "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60"
    textColor = "text-rose-700 dark:text-rose-300"
    message   = "This article shows strong indicators of misinformation. Do not share without independent verification from multiple trusted news outlets."
  } else if (sourceTier === "none") {
    icon = <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
    bg   = "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60"
    textColor = "text-amber-700 dark:text-amber-400"
    message   = "No identifiable source was found. Even if the content reads well, the absence of a verifiable publisher means this should be treated with caution."
  } else if (verdict === "UNVERIFIED") {
    icon = <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
    bg   = "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60"
    textColor = "text-amber-700 dark:text-amber-400"
    message   = "This article could not be fully verified. Seek confirmation from multiple trusted sources before drawing conclusions."
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
              {["Check that your content is valid and properly formatted","Ensure URLs are accessible and contain article content","Avoid overly repetitive or template-like content","Provide meaningful text with varied language"].map((s, i) => (
                <p key={i} className="text-xs text-orange-800 dark:text-orange-300 flex items-start gap-2"><span className="shrink-0 mt-0.5">•</span>{s}</p>
              ))}
            </div>
          </div>
        </div>
      </Card>
    )
  }

  const cfg         = VERDICT_CONFIG[result.verdict]
  const VerdictIcon = cfg.icon
  const reasoning   = buildReasoningParagraph(result)

  const rawCred    = (result.source_credibility_detailed?.credibility_score ?? 0.5) * 100
  const rawContent = (result.content_quality_detailed?.overall_score ?? 0.5) * 100
  const credScore    = result.verdict === "REAL" ? Math.max(65, Math.min(100, rawCred)) : result.verdict === "FAKE" ? Math.min(45, rawCred) : Math.max(30, Math.min(75, rawCred))
  const contentScore = result.verdict === "REAL" ? Math.max(65, Math.min(100, rawContent)) : result.verdict === "FAKE" ? Math.min(38, rawContent) : Math.max(35, Math.min(70, rawContent))

  const sourceLabel = result.source_label || ""
  const hasSource   = sourceLabel.toLowerCase().includes("verified") || sourceLabel.toLowerCase().includes("suggested") || (result.source_credibility || 0) > 0
  const sourceTier  = getSourceTier(credScore, result.verdict, hasSource)

  return (
    <div className="space-y-4">

      {/* 1 ── VERDICT CARD */}
      <Card className={`border-2 shadow-sm ${cfg.border} ${cfg.cardBg}`}>
        <div className="p-5">
          <div className="flex items-center gap-2.5 mb-2">
            <VerdictIcon className={`w-5 h-5 shrink-0 ${cfg.textColor}`} />
            <h3 className={`text-lg font-bold ${cfg.textColor}`}>{cfg.label}</h3>
            <span className={`ml-auto text-sm font-semibold ${cfg.textColor}`}>{result.confidence_score}% confidence</span>
          </div>
          <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-4">
            <div className={`h-full rounded-full transition-all duration-700 ${cfg.barColor}`} style={{ width: `${result.confidence_score}%` }} />
          </div>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{reasoning}</p>
        </div>
      </Card>

      {/* 2 ── ARTICLE SUMMARY */}
      {result.article_summary?.summary && (
        <ArticleSummaryCard
          summary={result.article_summary}
          title={result.article_title}
        />
      )}

      {/* 3 ── SOURCE CREDIBILITY & CONTENT QUALITY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SourceCredibilityCard result={result} verdict={result.verdict} />
        <ContentQualityCard result={result} verdict={result.verdict} />
      </div>

      {/* 4 ── FACT-CHECK & VERIFICATION */}
      <FactCheckAndVerification
        verdict={result.verdict}
        factChecks={result.fact_check_results ?? []}
        sourceLinks={result.source_links ?? []}
        searchQuery={result.search_query}
        detectedTopics={result.detected_topics}
        sourceTier={sourceTier}
      />

      {/* FINAL TAKEAWAY */}
      <FinalTakeaway verdict={result.verdict} credScore={credScore} contentScore={contentScore} hasSource={hasSource} />
    </div>
  )
}
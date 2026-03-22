"use client"

import { Card } from "@/components/ui/card"
import {
  ExternalLink, AlertCircle, CheckCircle2, AlertTriangle, Search, ShieldCheck, ShieldAlert, ShieldQuestion, BarChart2, FileText, Globe, Info, ChevronDown, ChevronUp, Newspaper
} from "lucide-react"
import { useState } from "react"

interface SourceLink {
  name: string
  url: string           // best available URL: article > search > homepage
  article_url?: string  // direct article URL from NewsAPI (may not always exist)
  search_url?: string   // source search page pre-filled with query
  homepage_url?: string // bare domain — used as last resort only
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
  }
  inputContent: string
}

const VERDICT_CONFIG = {
  REAL: {
    label: "Credible",
    cardBg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800",
    textColor: "text-emerald-700 dark:text-emerald-400",
    badgeBg: "bg-emerald-100 dark:bg-emerald-900/50",
    barColor: "bg-emerald-500",
    icon: ShieldCheck,
  },
  FAKE: {
    label: "Likely False",
    cardBg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-200 dark:border-rose-800",
    textColor: "text-rose-700 dark:text-rose-400",
    badgeBg: "bg-rose-100 dark:bg-rose-900/50",
    barColor: "bg-rose-500",
    icon: ShieldAlert,
  },
  UNVERIFIED: {
    label: "Unverified",
    cardBg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    textColor: "text-amber-700 dark:text-amber-500",
    badgeBg: "bg-amber-100 dark:bg-amber-900/50",
    barColor: "bg-amber-500",
    icon: ShieldQuestion,
  },
  ERROR: {
    label: "Error",
    cardBg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-200 dark:border-orange-800",
    textColor: "text-orange-700 dark:text-orange-400",
    badgeBg: "bg-orange-100 dark:bg-orange-900/50",
    barColor: "bg-orange-500",
    icon: AlertTriangle,
  },
}

function ScoreRing({ score, size = 68, strokeWidth = 6, colorClass }: {
  score: number; size?: number; strokeWidth?: number; colorClass: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dash = Math.min((score / 100) * circumference, circumference)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth}
        className="stroke-gray-200 dark:stroke-gray-700" />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth}
        stroke="currentColor" strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round"
        className={`transition-all duration-700 ${colorClass}`} />
    </svg>
  )
}

function FactorBar({ label, value, color = "bg-blue-500", detail }: {
  label: string; value: number; color?: string; detail?: string
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{detail || `${pct}%`}</span>
      </div>
      <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function SignalPill({ positive, text }: { positive: boolean; text: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
      positive
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
        : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${positive ? "bg-emerald-500" : "bg-rose-500"}`} />
      {text}
    </span>
  )
}

function ConclusionBadge({ text }: { text: string }) {
  const lower = text.toLowerCase()
  if (lower.includes("true") || lower.includes("accurate") || lower.includes("correct")) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
        <CheckCircle2 className="w-3 h-3" /> Verified
      </span>
    )
  }
  if (lower.includes("false") || lower.includes("wrong") || lower.includes("mislead")) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 text-xs font-semibold">
        <AlertCircle className="w-3 h-3" /> Disputed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-500 text-xs font-semibold">
      <Info className="w-3 h-3" /> Unverified
    </span>
  )
}

export default function ResultsDisplay({ result, inputContent }: ResultsDisplayProps) {
  if (result.verdict === "ERROR") {
    return (
      <Card className="p-6 bg-orange-50 dark:bg-orange-950/40 border-2 border-orange-200 dark:border-orange-800">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-orange-700 dark:text-orange-400 mb-1">Unable to Process</h3>
            <p className="text-sm text-muted-foreground mb-4">{result.explanation}</p>
            <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-4 border border-orange-200 dark:border-orange-800 space-y-1">
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

  const readability = Math.round((result.content_quality_detailed?.readability_score ?? 0.5) * 100)
  const specificity = Math.round((result.content_quality_detailed?.specificity_score ?? 0.4) * 100)
  const evidenceScore = Math.round((result.content_quality_detailed?.evidence_strength_score ?? 0.5) * 100)
  const clickbait = Math.round((result.clickbait_score ?? 0) * 100)
  const credIndicator = Math.round((result.credibility_indicators?.score ?? 0.5) * 100)
  const issues = result.credibility_indicators?.issues ?? []
  const biasRating = result.source_credibility_detailed?.bias_rating ?? "Unable to determine"
  const grammarIssues = result.content_quality_detailed?.grammar_issues?.length ?? 0
  const avgSentLen = result.content_quality_detailed?.structure?.avg_sentence_length ?? 0



  return (
    <div className="space-y-4">

      {/* VERDICT CARD — compact */}
      <Card className={`border-2 ${cfg.border} ${cfg.cardBg}`}>
        <div className="p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <VerdictIcon className={`w-5 h-5 shrink-0 ${cfg.textColor}`} />
              <h3 className={`text-lg font-bold ${cfg.textColor}`}>{cfg.label}</h3>
            </div>
            <span className={`text-xl font-bold ${cfg.textColor}`}>{result.confidence_score}%</span>
          </div>
          <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-700 ${cfg.barColor}`}
              style={{ width: `${result.confidence_score}%` }}
            />
          </div>
          <p className="text-sm text-foreground leading-relaxed">{result.explanation}</p>
        </div>
      </Card>

      {/* DYNAMIC SOURCE LINKS */}
      <DynamicSourceLinks
        links={result.source_links ?? []}
        verdict={result.verdict}
        searchQuery={result.search_query}
        detectedTopics={result.detected_topics}
      />

      {/* METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source Credibility card */}
        <Card className="p-5 bg-card dark:bg-slate-800 border dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-blue-500" />
            <h5 className="font-semibold text-foreground text-sm">Source Credibility</h5>
          </div>
          <div className="flex items-start gap-4">
            <div className="relative shrink-0 w-[68px] h-[68px]">
              <ScoreRing score={Math.round(credScore)} colorClass="text-blue-500" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-foreground">{Math.round(credScore)}%</span>
              </div>
            </div>
            <div className="flex-1 space-y-3 min-w-0">
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {result.source_credibility_detailed?.credibility_label ?? "Uncertain"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {result.source_label || "Source analysis complete"}
                </p>
              </div>
              {result.source_credibility_detailed?.domain_authority != null && (
                <FactorBar
                  label="Domain Authority"
                  value={Math.round((result.source_credibility_detailed.domain_authority ?? 0) * 100)}
                  color="bg-blue-500"
                />
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Bias Rating</span>
                <span className={`text-xs font-semibold ${
                  biasRating.includes("leaning") ? "text-orange-500" :
                  biasRating === "Neutral" ? "text-emerald-600 dark:text-emerald-400" :
                  "text-muted-foreground"
                }`}>
                  {biasRating}
                </span>
              </div>
              {result.source_credibility_detailed?.bias_indicators?.slice(0, 2).map((ind, i) => (
                <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="shrink-0 mt-1">•</span>{ind}
                </p>
              ))}
            </div>
          </div>

          {result.source_credibility_detailed?.api_checks && result.source_credibility_detailed.api_checks.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-2">Verification checks</p>
              <div className="flex flex-wrap gap-2">
                {result.source_credibility_detailed.api_checks.map((chk: any, i: number) => (
                  <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                    chk.status === "Found" || (typeof chk.score === "number" && chk.score > 0.5)
                      ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                      : "bg-gray-100 dark:bg-gray-800 text-muted-foreground border-border"
                  }`}>
                    <CheckCircle2 className="w-3 h-3" />
                    {chk.api}{chk.rating ? `: ${chk.rating}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Content Quality card */}
        <Card className="p-5 bg-card dark:bg-slate-800 border dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-purple-500" />
            <h5 className="font-semibold text-foreground text-sm">Content Quality</h5>
          </div>
          <div className="flex items-start gap-4">
            <div className="relative shrink-0 w-[68px] h-[68px]">
              <ScoreRing score={Math.round(contentScore)} colorClass="text-purple-500" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-foreground">{Math.round(contentScore)}%</span>
              </div>
            </div>
            <div className="flex-1 space-y-3 min-w-0">
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {result.content_quality_detailed?.quality_label ?? "Neutral"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Avg. sentence length: {avgSentLen} words
                </p>
              </div>
              <FactorBar label="Readability" value={readability} color="bg-sky-500" detail={`${readability}%`} />
              <FactorBar
                label="Specificity"
                value={specificity}
                color="bg-violet-500"
                detail={result.content_quality_detailed?.specificity_label ?? `${specificity}%`}
              />
              <FactorBar
                label="Evidence Strength"
                value={evidenceScore}
                color="bg-purple-500"
                detail={result.content_quality_detailed?.evidence_strength_label ?? `${evidenceScore}%`}
              />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/50 grid grid-cols-2 gap-x-4 gap-y-2">
            {[
              {
                label: "Clickbait",
                value: clickbait < 25 ? "Low" : clickbait < 50 ? "Moderate" : "High",
                color: clickbait > 50 ? "text-rose-500" : clickbait > 25 ? "text-amber-500" : "text-emerald-600 dark:text-emerald-400",
              },
              {
                label: "Tone",
                value: result.sentiment_label ?? "Neutral",
                color: "text-foreground",
              },
              {
                label: "Grammar",
                value: grammarIssues === 0 ? "Clean" : `${grammarIssues} issue${grammarIssues > 1 ? "s" : ""}`,
                color: grammarIssues === 0 ? "text-emerald-600 dark:text-emerald-400" : grammarIssues < 3 ? "text-amber-500" : "text-rose-500",
              },
              {
                label: "Structure",
                value: credIndicator > 70 ? "Good" : credIndicator > 45 ? "Fair" : "Weak",
                color: "text-foreground",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className={`text-xs font-semibold ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* FACT-CHECK RESULTS */}
      {result.fact_check_results && result.fact_check_results.length > 0 && (
        <FactCheckSection checks={result.fact_check_results} />
      )}
    </div>
  )
}

function DynamicSourceLinks({
  links, verdict, searchQuery, detectedTopics,
}: {
  links: SourceLink[]
  verdict: "REAL" | "FAKE" | "UNVERIFIED"
  searchQuery?: string
  detectedTopics?: string[]
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
    ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
    : "bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700"

  const headingStyle = isReal
    ? "text-emerald-900 dark:text-emerald-300"
    : "text-foreground"

  return (
    <Card className={`p-5 ${cardStyle}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
        <h4 className={`font-semibold flex items-center gap-2 ${headingStyle}`}>
          {isReal
            ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            : <Globe className="w-4 h-4 text-blue-500" />
          }
          {headerText}
        </h4>
        {topicLabel && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">
            {topicLabel}
          </span>
        )}
      </div>

      {/* Empty state */}
      {links.length === 0 ? (
        <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 p-5 text-center space-y-1.5">
          <Info className="w-4 h-4 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">
            No related trusted sources found for this article.
          </p>
          <p className="text-xs text-muted-foreground">
            Verify this information manually from reputable news outlets.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((src, idx) => {
            const isArticle = !!src.article_url

            return (
              <a
                key={idx}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`group flex items-center justify-between p-3 rounded-xl border transition-all duration-150 ${
                  isReal
                    ? "bg-white dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 hover:shadow-sm"
                    : "bg-white dark:bg-slate-900 border-blue-200 dark:border-slate-600 hover:border-blue-400 hover:shadow-sm"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isReal ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-blue-100 dark:bg-slate-800"
                  }`}>
                    <Newspaper className={`w-3.5 h-3.5 ${isReal ? "text-emerald-600 dark:text-emerald-400" : "text-blue-500"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${
                      isReal ? "text-emerald-700 dark:text-emerald-300" : "text-blue-700 dark:text-blue-300"
                    }`}>{src.name}</p>
                    {/* Show actual article title if available, else generic label */}
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {isArticle ? "Related article found" : "Search results page"}
                    </p>
                  </div>
                </div>
                <ExternalLink className={`w-3.5 h-3.5 shrink-0 ml-2 transition-transform group-hover:translate-x-0.5 ${
                  isReal ? "text-emerald-500" : "text-blue-400"
                }`} />
              </a>
            )
          })}
        </div>
      )}
    </Card>
  )
}

function FactCheckSection({ checks }: { checks: FactCheck[] }) {
  const [expanded, setExpanded] = useState<number | null>(null)

  return (
    <Card className="p-5 bg-card dark:bg-slate-800 border dark:border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="w-4 h-4 text-indigo-500" />
        <h4 className="font-semibold text-foreground text-sm">Related Fact-Check Results</h4>
        <span className="ml-auto text-xs text-muted-foreground">
          {checks.slice(0, 4).length} result{checks.slice(0, 4).length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-2">
        {checks.slice(0, 4).map((check, idx) => {
          const validLink =
            check.source &&
            check.source !== "Source not identified" &&
            check.source.startsWith("http")
          const isExpanded = expanded === idx

          return (
            <div
              key={idx}
              className="rounded-xl border border-border bg-background dark:bg-slate-900 overflow-hidden"
            >
              <button
                onClick={() => setExpanded(isExpanded ? null : idx)}
                className="w-full text-left p-4 flex items-start justify-between gap-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <ConclusionBadge text={check.conclusion} />
                    <span className="text-xs text-muted-foreground">— {check.reviewer || "News Source"}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground line-clamp-2">
                    &ldquo;{check.claim.substring(0, 120)}{check.claim.length > 120 ? "…" : ""}&rdquo;
                  </p>
                </div>
                <span className="shrink-0 mt-0.5">
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border/50 space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed pt-3">{check.conclusion}</p>
                  {check.relevance > 0 && (
                    <FactorBar
                      label="Relevance to your content"
                      value={Math.round(check.relevance * 100)}
                      color="bg-indigo-500"
                    />
                  )}
                  {validLink ? (
                    <a
                      href={check.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Read article on {check.source_label || check.reviewer || "source"}
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Verify with trusted news outlets</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-border/50">
        <p className="text-xs text-muted-foreground flex items-start gap-2">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Fact-check results are sourced from external APIs. Always cross-reference with multiple trusted outlets before drawing conclusions.
        </p>
      </div>
    </Card>
  )
}
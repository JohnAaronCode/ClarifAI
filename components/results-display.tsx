"use client"

import { Card } from "@/components/ui/card"
import { ExternalLink, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react"
import { useState } from "react"

interface ResultsDisplayProps {
  result: {
    verdict: "REAL" | "FAKE" | "UNVERIFIED" | "ERROR"
    confidence_score: number
    explanation: string
    reference?: string
    reference_label?: string
    source_links?: Array<{ name: string; url: string }>
    key_entities?: any
    sentiment_score?: number
    sentiment_label?: string
    source_credibility?: number
    source_label?: string
    credibility_indicators?: any
    fact_check_results?: any
    source_credibility_detailed?: any
    content_quality_detailed?: any
  }
  inputContent: string
}

export default function ResultsDisplay({ result, inputContent }: ResultsDisplayProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  const getVerdictColor = () => {
    switch (result.verdict) {
      case "REAL":
        return "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
      case "FAKE":
        return "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
      default:
        return "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800"
    }
  }

  const getVerdictTextColor = () => {
    switch (result.verdict) {
      case "REAL":
        return "text-green-600 dark:text-green-400"
      case "FAKE":
        return "text-red-600 dark:text-red-400"
      default:
        return "text-yellow-600 dark:text-yellow-400"
    }
  }

  const getProgressBarColor = () => {
    switch (result.verdict) {
      case "REAL":
        return "bg-green-500"
      case "FAKE":
        return "bg-red-500"
      default:
        return "bg-yellow-500"
    }
  }

  const getVerdictIcon = () => {
    switch (result.verdict) {
      case "REAL":
        return <CheckCircle2 className="w-6 h-6" />
      case "FAKE":
        return <AlertTriangle className="w-6 h-6" />
      default:
        return <AlertCircle className="w-6 h-6" />
    }
  }

  const getBiasColor = (bias: string) => {
    if (bias.includes("leaning")) return "text-orange-600 dark:text-orange-400"
    if (bias.includes("Neutral")) return "text-green-600 dark:text-green-400"
    return "text-gray-600 dark:text-gray-400"
  }

  const getVerdictBasedScores = () => {
    const credScore = (result.source_credibility_detailed?.credibility_score || 0) * 100
    const contentScore = (result.content_quality_detailed?.overall_score || 0) * 100

    let adjustedCredScore = credScore
    let adjustedContentScore = contentScore
    let credLabel = "Uncertain"
    let contentLabel = "Uncertain"

    if (result.verdict === "REAL") {
      // REAL: credibility 70-100%, content quality 70-100%
      adjustedCredScore = Math.max(70, Math.min(100, credScore))
      adjustedContentScore = Math.max(70, Math.min(100, contentScore))
      credLabel = adjustedCredScore > 85 ? "High credibility" : "Good credibility"
      contentLabel = adjustedContentScore > 85 ? "Strong evidence" : "Moderate evidence"
    } else if (result.verdict === "FAKE") {
      // FAKE: credibility 0-30%, content quality 0-40%
      adjustedCredScore = Math.min(30, credScore)
      adjustedContentScore = Math.min(40, contentScore)
      credLabel = "Low credibility"
      contentLabel = "Weak evidence"
    } else if (result.verdict === "UNVERIFIED") {
      // UNVERIFIED: credibility 30-50%, content quality 40-60%
      adjustedCredScore = Math.max(30, Math.min(50, credScore))
      adjustedContentScore = Math.max(40, Math.min(60, contentScore))
      credLabel = "Uncertain credibility"
      contentLabel = "Mixed evidence"
    }

    return {
      credScore: Math.round(adjustedCredScore),
      contentScore: Math.round(adjustedContentScore),
      credLabel,
      contentLabel,
    }
  }

  const scores = getVerdictBasedScores()

  if (result.verdict === "ERROR") {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 dark:text-red-400 text-base font-medium">{result.explanation}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Main Verdict Card */}
      <Card className={`p-6 border-2 ${getVerdictColor()}`}>
        <div className="flex items-start gap-4">
          <div className={`${getVerdictTextColor()} shrink-0`}>{getVerdictIcon()}</div>
          <div className="flex-1">
            <h3 className={`text-2xl font-bold ${getVerdictTextColor()} mb-2`}>{result.verdict}</h3>
            <p className="text-sm text-muted-foreground mb-3">Confidence: {result.confidence_score}%</p>

            <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-2 mb-4 overflow-hidden">
              <div
                className={`${getProgressBarColor()} h-full rounded-full transition-all`}
                style={{ width: `${result.confidence_score}%` }}
              ></div>
            </div>

            <div>
              <p className="text-sm text-foreground font-medium mb-2">Why this result:</p>
              <p className="text-sm text-foreground">{result.explanation}</p>
            </div>
          </div>
          <div className="shrink-0">
            <span className={`text-2xl font-bold px-3 py-2 rounded ${getVerdictTextColor()} bg-white/20`}>
              {result.confidence_score}%
            </span>
          </div>
        </div>
      </Card>

      {result.verdict === "REAL" && result.source_links && result.source_links.length > 0 && (
        <Card className="p-6 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
          <h4 className="font-semibold mb-4 text-green-900 dark:text-green-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Verified Sources Confirming This
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {result.source_links.map((src, idx) => (
              <a
                key={idx}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 border border-green-200 dark:border-green-700 rounded-lg bg-white dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors flex items-center justify-between group"
              >
                <span className="text-sm font-medium text-green-700 dark:text-green-300 group-hover:text-green-900 dark:group-hover:text-green-200">
                  {src.name}
                </span>
                <ExternalLink className="w-4 h-4 text-green-600 dark:text-green-400" />
              </a>
            ))}
          </div>
        </Card>
      )}

      {result.source_links && result.source_links.length > 0 && result.verdict !== "REAL" && (
        <Card className="p-6 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700">
          <h4 className="font-semibold mb-4 text-foreground flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Verified News Sources to Check
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {result.source_links.map((src, idx) => (
              <a
                key={idx}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 border border-blue-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 hover:bg-blue-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between group"
              >
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300 group-hover:text-blue-900 dark:group-hover:text-blue-200">
                  {src.name}
                </span>
                <ExternalLink className="w-4 h-4 text-blue-500 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300" />
              </a>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6 bg-card dark:bg-slate-800 border dark:border-slate-700">
        <div className="space-y-4">
          {/* Source Credibility - Simplified */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h5 className="font-semibold text-foreground">Source Credibility</h5>
              <span className="text-sm font-medium text-foreground">
                {scores.credScore}% ({scores.credLabel})
              </span>
            </div>
            <div className="w-full h-2 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${scores.credScore}%` }}
              ></div>
            </div>
          </div>

          {/* Bias Rating */}
          <div className="flex justify-between items-center pt-2">
            <span className="text-sm font-medium text-foreground">Bias Rating</span>
            <span
              className={`text-sm font-medium ${getBiasColor(result.source_credibility_detailed?.bias_rating || "Neutral")}`}
            >
              {result.source_credibility_detailed?.bias_rating ?? "Uncertain"}
            </span>
          </div>

          <hr className="border-muted-foreground/40" />

          {/* Content Quality - Simplified */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h5 className="font-semibold text-foreground">Content Quality</h5>
              <span className="text-sm font-medium text-foreground">
                {scores.contentScore}% ({scores.contentLabel})
              </span>
            </div>
            <div className="w-full h-2 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all"
                style={{ width: `${scores.contentScore}%` }}
              ></div>
            </div>
          </div>

          {/* Specificity and Evidence Strength inline */}
          <div className="flex justify-between items-center pt-2 text-sm">
            <div>
              <span className="text-muted-foreground">Specificity: </span>
              <span className="font-medium text-foreground">{result.content_quality_detailed?.specificity_label}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Evidence: </span>
              <span className="font-medium text-foreground">
                {result.content_quality_detailed?.evidence_strength_label}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Fact-Check Results */}
      {result.fact_check_results && result.fact_check_results.length > 0 && (
        <Card className="p-6 bg-card dark:bg-slate-800 border dark:border-slate-700">
          <h4 className="font-semibold mb-4 text-foreground flex items-center gap-2">Fact-Check Reference</h4>
          <div className="space-y-4">
            {result.fact_check_results.slice(0, 4).map((check: any, idx: number) => {
              const validLink =
                check.source && check.source !== "Source not identified" && check.source.startsWith("http")

              return (
                <div
                  key={idx}
                  className="border border-muted rounded-lg p-4 bg-background dark:bg-slate-900 hover:border-muted-foreground/50 transition-colors"
                >
                  <div className="mb-3">
                    <p className="font-semibold text-sm text-foreground mb-1">
                      "{check.claim.substring(0, 120)}
                      {check.claim.length > 120 ? "..." : ""}"
                    </p>
                    <p className="text-xs text-muted-foreground font-medium">— {check.reviewer || "News Source"}</p>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">{check.conclusion}</p>

                  {validLink ? (
                    <a
                      href={check.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 text-xs hover:underline inline-flex items-center gap-1.5 font-medium"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Read Full Article
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Verify with trusted news outlets</p>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
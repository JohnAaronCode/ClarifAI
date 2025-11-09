"use client"

import { Card } from "@/components/ui/card"
import { ExternalLink, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react"

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
  }
  inputContent: string
}

export default function ResultsDisplay({ result, inputContent }: ResultsDisplayProps) {
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

            <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-1.5 mb-4 overflow-hidden">
              <div
                className={`${getProgressBarColor()} h-full rounded-full transition-all`}
                style={{ width: `${result.confidence_score}%` }}
              ></div>
            </div>

            <p className="text-sm text-foreground">{result.explanation}</p>
          </div>
          <div className="shrink-0">
            <span className={`text-2xl font-bold px-3 py-2 rounded ${getVerdictTextColor()} bg-white/20`}>
              {result.confidence_score}%
            </span>
          </div>
        </div>
      </Card>

      {result.source_links && result.source_links.length > 0 && (
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

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {result.sentiment_score !== undefined && (
          <Card className="p-4 bg-card dark:bg-slate-800 border dark:border-slate-700">
            <p className="text-xs text-muted-foreground uppercase mb-2 font-semibold">Sentiment Score</p>
            <p className="text-2xl font-bold text-foreground mb-2">{(result.sentiment_score * 100).toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">{result.sentiment_label || "Neutral"}</p>
          </Card>
        )}
        {result.source_credibility !== undefined && (
          <Card className="p-4 bg-card dark:bg-slate-800 border dark:border-slate-700">
            <p className="text-xs text-muted-foreground uppercase mb-2 font-semibold">Source Credibility</p>
            <p className="text-2xl font-bold text-foreground mb-2">{result.source_credibility}%</p>
            <p className="text-xs text-muted-foreground">
              {result.source_credibility > 75
                ? "Highly Credible"
                : result.source_credibility > 50
                  ? "Moderate"
                  : "Low Credibility"}
            </p>
          </Card>
        )}
        {result.credibility_indicators && (
          <Card className="p-4 bg-card dark:bg-slate-800 border dark:border-slate-700">
            <p className="text-xs text-muted-foreground uppercase mb-2 font-semibold">Content Quality</p>
            <p className="text-2xl font-bold text-foreground mb-2">
              {Math.round(result.credibility_indicators.score * 100)}%
            </p>
            {result.credibility_indicators.issues.length > 0 && (
              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                {result.credibility_indicators.issues[0]}
              </p>
            )}
          </Card>
        )}
      </div>

      {result.fact_check_results && result.fact_check_results.length > 0 && (
        <Card className="p-6 bg-card dark:bg-slate-800 border dark:border-slate-700">
          <h4 className="font-semibold mb-4 text-foreground flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            Fact Check References
          </h4>
          <div className="space-y-3">
            {result.fact_check_results.slice(0, 4).map((check: any, idx: number) => {
              const validLink =
                check.source && check.source !== "Source not identified" && check.source.startsWith("http")

              return (
                <div key={idx} className="border border-muted rounded p-4 bg-background dark:bg-slate-900">
                  <p className="font-semibold text-sm mb-2 text-foreground line-clamp-2">{check.claim}</p>
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{check.conclusion}</p>
                  {check.reviewer && (
                    <p className="text-xs text-muted-foreground mb-3">
                      <span className="font-semibold text-foreground">Source:</span> {check.reviewer}
                    </p>
                  )}

                  {validLink ? (
                    <a
                      href={check.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 text-sm hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Read Full Reference
                    </a>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 italic text-xs">Manual verification recommended</p>
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
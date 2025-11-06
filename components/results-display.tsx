"use client"

import { Card } from "@/components/ui/card"

interface ResultsDisplayProps {
  result: {
    verdict: "REAL" | "FAKE" | "UNVERIFIED" | "ERROR"
    confidence_score: number
    explanation: string
    reference?: string
    key_entities?: any
    sentiment_score?: number
    sentiment_label?: string
    source_credibility?: number
    source_label?: string
    fact_check_results?: any
  }
  inputContent: string
}

// Detect known news sources (Rappler, GMA, ABS-CBN, etc.)
function detectSource(content: string): { label: string; url: string } | null {
  const sources = [
    { name: "Rappler", domain: "rappler.com" },
    { name: "GMA News", domain: "gmanetwork.com" },
    { name: "ABS-CBN News", domain: "abs-cbn.com" },
    { name: "Philippine Daily Inquirer", domain: "inquirer.net" },
    { name: "Manila Bulletin", domain: "mb.com.ph" },
    { name: "CNN Philippines", domain: "cnnphilippines.com" },
    { name: "Philstar", domain: "philstar.com" },
    { name: "BBC News", domain: "bbc.com" },
    { name: "CNN", domain: "cnn.com" },
    { name: "Reuters", domain: "reuters.com" },
    { name: "Al Jazeera", domain: "aljazeera.com" },
    { name: "The Guardian", domain: "theguardian.com" },
    { name: "New York Times", domain: "nytimes.com" },
    { name: "Washington Post", domain: "washingtonpost.com" },
    { name: "Fox News", domain: "foxnews.com" },
    { name: "NBC News", domain: "nbcnews.com" },
    { name: "Bloomberg", domain: "bloomberg.com" },
    { name: "Associated Press", domain: "apnews.com" },
    { name: "The Independent", domain: "independent.co.uk" },
    { name: "Sky News", domain: "news.sky.com" },
    { name: "USA Today", domain: "usatoday.com" },
    { name: "Time", domain: "time.com" },
    { name: "NPR", domain: "npr.org" },
    { name: "The Economist", domain: "economist.com" },
  ]

  for (const src of sources) {
    if (content.includes(src.domain)) {
      return { label: src.name, url: `https://${src.domain}` }
    }
  }

  const urlMatch = content.match(/https?:\/\/[^\s]+/)
  if (urlMatch) return { label: "External Source", url: urlMatch[0] }

  return null
}

export default function ResultsDisplay({ result, inputContent }: ResultsDisplayProps) {
  const source = detectSource(inputContent)

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

  if (result.verdict === "ERROR") {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 dark:text-red-400 text-lg font-semibold">{result.explanation}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ✅ Verdict Card (kept intact) */}
      <Card className={`p-6 border-2 ${getVerdictColor()}`}>
        <div className="flex items-start gap-4">
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

            {source && (
              <div className="mt-4 text-sm">
                <span className="font-semibold text-foreground">Reference:</span>{" "}
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {source.label}
                </a>
              </div>
            )}
          </div>
          <div className="shrink-0">
            <span className={`text-2xl font-bold px-3 py-2 rounded ${getVerdictTextColor()} bg-white/20`}>
              {result.confidence_score}%
            </span>
          </div>
        </div>
      </Card>

      {/* ✅ Detailed Metrics (unchanged) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {result.sentiment_score !== undefined && (
          <Card className="p-4 bg-card dark:bg-slate-800 border dark:border-slate-700">
            <p className="text-xs text-muted-foreground uppercase mb-2 font-semibold">Sentiment Score</p>
            <p className="text-2xl font-bold text-foreground mb-2">{(result.sentiment_score * 100).toFixed(0)}%</p>
            <div className="text-xs space-y-2">
              <p className="text-muted-foreground font-semibold">{result.sentiment_label || "Neutral"}</p>
              <p className="text-muted-foreground">
                {result.sentiment_score > 0.5
                  ? "Positive emotional language detected"
                  : result.sentiment_score < -0.5
                  ? "Negative emotional language detected"
                  : "Balanced and neutral tone"}
              </p>
            </div>
          </Card>
        )}
        {result.source_credibility !== undefined && (
          <Card className="p-4 bg-card dark:bg-slate-800 border dark:border-slate-700">
            <p className="text-xs text-muted-foreground uppercase mb-2 font-semibold">Source Credibility</p>
            <p className="text-2xl font-bold text-foreground mb-2">{(result.source_credibility * 100).toFixed(0)}%</p>
            <div className="text-xs space-y-2">
              <p className="text-muted-foreground font-semibold">
                {result.source_credibility > 0.7
                  ? "Credible"
                  : result.source_credibility > 0.4
                  ? "Moderate"
                  : "Low Credibility"}
              </p>
              <p className="text-muted-foreground">
                {result.source_credibility > 0.7
                  ? "Multiple reliable sources cited"
                  : result.source_credibility > 0.4
                  ? "Some credible sources found"
                  : "Limited or questionable sources"}
              </p>
            </div>
          </Card>
        )}
        {result.key_entities && (
          <Card className="p-4 bg-card dark:bg-slate-800 border dark:border-slate-700">
            <p className="text-xs text-muted-foreground uppercase mb-2 font-semibold">Entities Found</p>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-foreground">
                {(result.key_entities?.persons?.length || 0) + (result.key_entities?.locations?.length || 0)}
              </p>
              <div className="text-xs space-y-1">
                {(result.key_entities?.persons?.length || 0) > 0 && (
                  <p className="text-muted-foreground">
                    <span className="font-semibold">People:</span> {result.key_entities.persons.join(", ")}
                  </p>
                )}
                {(result.key_entities?.locations?.length || 0) > 0 && (
                  <p className="text-muted-foreground">
                    <span className="font-semibold">Places:</span> {result.key_entities.locations.join(", ")}
                  </p>
                )}
                {(result.key_entities?.persons?.length || 0) === 0 &&
                  (result.key_entities?.locations?.length || 0) === 0 && (
                    <p className="text-muted-foreground">No significant entities identified</p>
                  )}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* ✅ Fact Check References */}
      {result.fact_check_results && result.fact_check_results.length > 0 && (
        <Card className="p-6 bg-card dark:bg-slate-800 border dark:border-slate-700">
          <h4 className="font-semibold mb-4 text-foreground">Fact Check References</h4>
          <div className="space-y-3">
            {result.fact_check_results.map((check: any, idx: number) => {
              const validLink =
                check.source &&
                check.source !== "Source not identified" &&
                (check.source.startsWith("http://") || check.source.startsWith("https://"))

              return (
                <div
                  key={idx}
                  className="border border-muted rounded p-3 bg-background dark:bg-slate-900"
                >
                  <p className="font-semibold text-sm mb-1 text-foreground">{check.claim}</p>
                  <p className="text-sm text-muted-foreground mb-2">{check.conclusion}</p>

                  {validLink ? (
                    <a
                      href={check.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 text-sm hover:underline inline-flex items-center gap-1"
                    >
                      Read full article →
                    </a>
                  ) : (
                    <p className="text-gray-500 italic text-xs">No verified source available</p>
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

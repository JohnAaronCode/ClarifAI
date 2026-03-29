"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import Navbar from "@/components/navbar"
import DetectorForm from "@/components/detector-form"
import ResultsDisplay from "@/components/results-display"
import Footer from "@/components/footer"
import {
  ShieldCheck, ShieldAlert, ShieldQuestion, Trash2, CheckSquare, Square,
  BarChart2, TrendingUp, Clock, FileText, Link2, ChevronRight, X, Search,
  Filter, AlertTriangle, CheckCircle2, Info
} from "lucide-react"

interface AnalysisResult {
  verdict: "REAL" | "FAKE" | "UNVERIFIED" | "ERROR"
  confidence_score: number
  explanation: string
  key_entities?: any
  sentiment_score?: number
  source_credibility?: number
  fact_check_results?: any
}

interface HistoryItem {
  id: string
  input_type: "text" | "url"
  content_preview: string
  verdict: "REAL" | "FAKE" | "UNVERIFIED"
  confidence_score: number
  explanation: string
  key_entities?: any
  sentiment_score?: number
  source_credibility?: number
  fact_check_results?: any
  created_at: string
}

const VERDICT_DISPLAY = {
  REAL: {
    label: "Credible",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
    icon: ShieldCheck,
    dot: "bg-emerald-500",
  },
  FAKE: {
    label: "Likely False",
    bg: "bg-rose-100 dark:bg-rose-900/30",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-800",
    icon: ShieldAlert,
    dot: "bg-rose-500",
  },
  UNVERIFIED: {
    label: "Unverified",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-600",
    border: "border-amber-200 dark:border-amber-800",
    icon: ShieldQuestion,
    dot: "bg-amber-500",
  },
}

export default function DetectorPage() {
  const [activeTab, setActiveTab] = useState("detector")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [inputContent, setInputContent] = useState("")

  const handleAnalyze = async (content: string, type: "text" | "url") => {
    setLoading(true)
    setInputContent(content)

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, type }),
      })

      const data = await response.json()
      setResult(data)

      if (data.verdict !== "ERROR") {
        const history = JSON.parse(localStorage.getItem("analysisHistory") || "[]")
        const existingIndex = history.findIndex(
          (item: HistoryItem) => item.content_preview === content.substring(0, 200)
        )
        const newEntry: HistoryItem = {
          id: existingIndex >= 0 ? history[existingIndex].id : Date.now().toString(),
          input_type: type,
          content_preview: content.substring(0, 200),
          verdict: data.verdict,
          confidence_score: data.confidence_score,
          explanation: data.explanation,
          key_entities: data.key_entities,
          sentiment_score: data.sentiment_score,
          source_credibility: data.source_credibility,
          fact_check_results: data.fact_check_results,
          created_at: new Date().toISOString(),
        }
        if (existingIndex >= 0) history.splice(existingIndex, 1)
        history.unshift(newEntry)
        localStorage.setItem("analysisHistory", JSON.stringify(history))
      }
    } catch (error) {
      console.error("Analysis error:", error)
      setResult({
        verdict: "ERROR",
        confidence_score: 0,
        explanation: "Error during analysis. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-center">ClarifAI</h1>
          <p className="text-center text-muted-foreground">News Credibility Analyzer</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="detector">Content Credibility Analysis</TabsTrigger>
            <TabsTrigger value="history">Analysis History</TabsTrigger>
          </TabsList>

          <TabsContent value="detector" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-semibold mb-2 text-center">Article Credibility Assessment</h2>
              <p className="text-muted-foreground mb-6 text-center">
                Submit a news article or URL for credibility assessment and detailed analysis.
              </p>
              <DetectorForm onAnalyze={handleAnalyze} onClearResult={() => setResult(null)} loading={loading} />
            </Card>
            {result && <ResultsDisplay result={result} inputContent={inputContent} />}
          </TabsContent>

          <TabsContent value="history">
            <HistoryTab />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  )
}

// ── History Tab ─────────────────────────────────────────────────────────────
function HistoryTab() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [filtered, setFiltered] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [activeFilter, setActiveFilter] = useState<"ALL" | "REAL" | "FAKE" | "UNVERIFIED">("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const stats = {
    total: history.length,
    real: history.filter(d => d.verdict === "REAL").length,
    fake: history.filter(d => d.verdict === "FAKE").length,
    unverified: history.filter(d => d.verdict === "UNVERIFIED").length,
    avgConfidence: history.length > 0
      ? Math.round(history.reduce((s, d) => s + d.confidence_score, 0) / history.length)
      : 0,
  }

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("analysisHistory") || "[]")
    // Strip any entries with invalid/ERROR verdicts from old localStorage data
    const valid = saved.filter((i: HistoryItem) =>
      i.verdict === "REAL" || i.verdict === "FAKE" || i.verdict === "UNVERIFIED"
    )
    setHistory(valid)
    setFiltered(valid)
    setLoading(false)
  }, [])

  useEffect(() => {
    let result = [...history]
    if (activeFilter !== "ALL") result = result.filter(i => i.verdict === activeFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(i => i.content_preview.toLowerCase().includes(q) || i.explanation.toLowerCase().includes(q))
    }
    setFiltered(result)
  }, [history, activeFilter, searchQuery])

  const toggleSelect = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedItems.size === filtered.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(filtered.map(i => i.id)))
    }
  }

  const deleteSelected = () => {
    if (selectedItems.size === 0) return
    const updated = history.filter(i => !selectedItems.has(i.id))
    localStorage.setItem("analysisHistory", JSON.stringify(updated))
    setHistory(updated)
    setSelectedItems(new Set())
  }

  const clearAll = () => {
    localStorage.setItem("analysisHistory", "[]")
    setHistory([])
    setFiltered([])
    setSelectedItems(new Set())
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading history...</p>
        </div>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <Card className="p-16 text-center">
        <BarChart2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-lg font-semibold text-foreground mb-1">No assessments yet</p>
        <p className="text-sm text-muted-foreground">Start by analyzing some content to see your history here.</p>
      </Card>
    )
  }

  const allSelected = filtered.length > 0 && selectedItems.size === filtered.length

  return (
    <div className="space-y-5">

      {/* ── Stats Overview ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Analyzed", value: stats.total, color: "text-foreground", sub: "articles", bg: "bg-muted/50" },
          { label: "Credible", value: stats.real, color: "text-emerald-600 dark:text-emerald-400", sub: `${stats.total > 0 ? Math.round((stats.real / stats.total) * 100) : 0}% of total`, bg: "bg-emerald-50 dark:bg-emerald-950/30" },
          { label: "Likely False", value: stats.fake, color: "text-rose-600 dark:text-rose-400", sub: `${stats.total > 0 ? Math.round((stats.fake / stats.total) * 100) : 0}% of total`, bg: "bg-rose-50 dark:bg-rose-950/30" },
          { label: "Unverified", value: stats.unverified, color: "text-amber-600 dark:text-amber-500", sub: `${stats.total > 0 ? Math.round((stats.unverified / stats.total) * 100) : 0}% of total`, bg: "bg-amber-50 dark:bg-amber-950/30" },
        ].map(({ label, value, color, sub, bg }) => (
          <Card key={label} className={`p-4 border ${bg}`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs font-semibold text-foreground mt-0.5">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </Card>
        ))}
      </div>

      {/* Avg confidence banner */}
      {stats.total > 0 && (
        <Card className="p-4 flex items-center gap-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <TrendingUp className="w-5 h-5 text-blue-500 shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Average Credibility Score</p>
            <div className="mt-1.5 h-1.5 w-full bg-blue-200 dark:bg-blue-900 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${stats.avgConfidence}%` }} />
            </div>
          </div>
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400 shrink-0">
            {stats.avgConfidence}%
          </span>
        </Card>
      )}

      {/* ── Controls ───────────────────────────────────────────────────── */}
      <Card className="p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search assessments..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {(["ALL", "REAL", "FAKE", "UNVERIFIED"] as const).map(f => {
            const countKey = f.toLowerCase() as "real" | "fake" | "unverified"
            const count = f === "ALL" ? stats.total : (stats[countKey] ?? 0)
            const isActive = activeFilter === f
            const cfg = f !== "ALL" ? VERDICT_DISPLAY[f] : null
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  isActive
                    ? cfg
                      ? `${cfg.bg} ${cfg.text} ${cfg.border}`
                      : "bg-foreground text-background border-foreground"
                    : "bg-muted/50 text-muted-foreground border-border hover:border-foreground/30"
                }`}
              >
                {cfg && isActive && <cfg.icon className="w-3 h-3" />}
                {f === "ALL" ? "All" : VERDICT_DISPLAY[f].label}
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${isActive ? "bg-white/30" : "bg-muted"}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Bulk actions */}
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/50">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
          >
            {allSelected
              ? <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
              : <Square className="w-3.5 h-3.5" />}
            {allSelected ? "Deselect all" : "Select all"}
          </button>

          <div className="flex items-center gap-2">
            {selectedItems.size > 0 && (
              <span className="text-xs text-muted-foreground">{selectedItems.size} selected</span>
            )}
            <button
              onClick={deleteSelected}
              disabled={selectedItems.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-200 dark:hover:bg-rose-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <Trash2 className="w-3 h-3" />
              Delete selected
            </button>
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground border border-border hover:bg-muted/80 transition"
            >
              <X className="w-3 h-3" />
              Clear all
            </button>
          </div>
        </div>
      </Card>

      {/* ── Results count ─────────────────────────────────────────────── */}
      {filtered.length !== history.length && (
        <p className="text-xs text-muted-foreground px-1">
          Showing {filtered.length} of {history.length} assessments
        </p>
      )}

      {/* ── History list ──────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No matching assessments</p>
          <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filter.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const cfg = VERDICT_DISPLAY[item.verdict as keyof typeof VERDICT_DISPLAY] ?? VERDICT_DISPLAY["UNVERIFIED"]
            const VIcon = cfg.icon
            const isSelected = selectedItems.has(item.id)
            const isExpanded = expandedId === item.id
            const date = new Date(item.created_at)

            return (
              <Card
                key={item.id}
                className={`overflow-hidden transition-all border ${
                  isSelected ? "border-blue-400 dark:border-blue-600 shadow-sm" : "border-border hover:border-border/80"
                }`}
              >
                {/* Main row */}
                <div className="p-4 flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelect(item.id)}
                    className="mt-0.5 shrink-0 text-muted-foreground hover:text-blue-500 transition"
                  >
                    {isSelected
                      ? <CheckSquare className="w-4 h-4 text-blue-500" />
                      : <Square className="w-4 h-4" />}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-2 mb-2 leading-snug">
                      {item.content_preview}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {" · "}
                        {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium uppercase tracking-wide ${
                        item.input_type === "url"
                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                          : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                      }`}>
                        {item.input_type === "url"
                          ? <Link2 className="w-2.5 h-2.5" />
                          : <FileText className="w-2.5 h-2.5" />}
                        {item.input_type}
                      </span>
                    </div>
                  </div>

                  {/* Verdict + score */}
                  <div className="flex flex-col items-end gap-2 ml-2 shrink-0">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                      <VIcon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                    <div className="text-right">
                      <span className="text-lg font-bold text-foreground">{item.confidence_score}%</span>
                      <p className="text-xs text-muted-foreground">credibility</p>
                    </div>
                  </div>
                </div>

                {/* Mini confidence bar */}
                <div className="h-1 w-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className={`h-full transition-all duration-500 ${
                      item.verdict === "REAL" ? "bg-emerald-400" :
                      item.verdict === "FAKE" ? "bg-rose-400" : "bg-amber-400"
                    }`}
                    style={{ width: `${item.confidence_score}%` }}
                  />
                </div>

                {/* Expand button */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition border-t border-border/30"
                >
                  {isExpanded ? "Hide details" : "Show details"}
                  <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-3 border-t border-border/50 bg-muted/20 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1">Assessment Summary</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.explanation}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {item.source_credibility !== undefined && (
                        <div className="rounded-lg bg-background dark:bg-slate-900 border border-border p-3">
                          <p className="text-xs text-muted-foreground mb-0.5">Source Credibility</p>
                          <p className="text-sm font-bold text-foreground">{item.source_credibility}%</p>
                        </div>
                      )}
                      {item.sentiment_score !== undefined && (
                        <div className="rounded-lg bg-background dark:bg-slate-900 border border-border p-3">
                          <p className="text-xs text-muted-foreground mb-0.5">Sentiment Score</p>
                          <p className="text-sm font-bold text-foreground">{Math.round(item.sentiment_score * 100)}%</p>
                        </div>
                      )}
                    </div>

                    {/* Verdict-specific contextual note */}
                    {item.verdict === "FAKE" && (
                      <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 p-3 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-rose-700 dark:text-rose-400">
                          This content showed strong indicators of misinformation. Do not share without independent verification.
                        </p>
                      </div>
                    )}
                    {item.verdict === "REAL" && (
                      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">
                          This content appeared credible at the time of assessment. Always verify with primary sources.
                        </p>
                      </div>
                    )}
                    {item.verdict === "UNVERIFIED" && (
                      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 flex items-start gap-2">
                        <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 dark:text-amber-500">
                          Could not be fully verified. Seek confirmation from multiple trusted sources.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
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
  BarChart2, Clock, FileText, Link2, ChevronRight, X, Search,
  Filter, AlertTriangle, CheckCircle2, Info,
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
  REAL:       { label: "Credible",     bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-700", icon: ShieldCheck,    dot: "bg-emerald-500" },
  FAKE:       { label: "Likely False", bg: "bg-rose-100 dark:bg-rose-900/40",       text: "text-rose-700 dark:text-rose-400",       border: "border-rose-200 dark:border-rose-700",       icon: ShieldAlert,    dot: "bg-rose-500"    },
  UNVERIFIED: { label: "Unverified",   bg: "bg-amber-100 dark:bg-amber-900/40",     text: "text-amber-700 dark:text-amber-400",     border: "border-amber-200 dark:border-amber-700",     icon: ShieldQuestion, dot: "bg-amber-500"   },
}

function makeContentKey(content: string): string {
  return content.trim().toLowerCase().replace(/\s+/g, " ").substring(0, 300)
}

export default function DetectorPage() {
  const [activeTab, setActiveTab] = useState("detector")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [inputContent, setInputContent] = useState("")

  useEffect(() => {
    document.title = "ClarifAI — Detector"
  }, [])

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
        // Increment global analysis counter — awaited so it actually runs
        try {
          const patchRes = await fetch("/api/visitors", { method: "PATCH" })
          if (!patchRes.ok) console.warn("[ClarifAI] PATCH /api/visitors failed:", patchRes.status)
        } catch (e) {
          console.warn("[ClarifAI] PATCH /api/visitors error:", e)
        }

        // Save to local history (deduplicated by content)
        const history: HistoryItem[] = JSON.parse(localStorage.getItem("analysisHistory") || "[]")
        const contentKey = makeContentKey(content)
        const deduplicated = history.filter(item => makeContentKey(item.content_preview) !== contentKey)
        const newEntry: HistoryItem = {
          id: Date.now().toString(),
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
        deduplicated.unshift(newEntry)
        localStorage.setItem("analysisHistory", JSON.stringify(deduplicated.slice(0, 50)))
      }
    } catch (error) {
      setResult({ verdict: "ERROR", confidence_score: 0, explanation: "Error during analysis. Please try again." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        :root { color-scheme: light dark; }
        .dark .detector-page-bg { background: #111111 !important; }

        .cai-history-card { transition: all 0.25s cubic-bezier(0.4,0,0.2,1) !important; }
        .cai-history-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.18); }

        /* ... existing styles mo ... */

        /* FLOATING BUBBLES */
        @keyframes floatBubble {
          0% {
            transform: translateY(0) scale(1);
            opacity: 0.5;
          }
          50% {
            transform: translateY(-120px) scale(1.1);
            opacity: 0.8;
          }
          100% {
            transform: translateY(-240px) scale(1);
            opacity: 0;
          }
        }

        .bubble {
          position: absolute;
          bottom: -60px;
          border-radius: 50%;
          background: rgba(59, 130, 246, 0.15);
          animation: floatBubble linear infinite;
        }
      `}</style>

      <div
        className="detector-page-bg min-h-screen bg-slate-50 dark:bg-[#111111] flex flex-col"
        style={{ transition: "background 0.3s", position: "relative", overflow: "hidden" }}
      >
        {/* ── Rich animated background ── */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>

        {/* Floating bubbles background */}
        <div style={{
          position: "fixed",
          inset: 0,
          overflow: "hidden",
          zIndex: 0,
          pointerEvents: "none"
        }}>
          <div className="bubble b1" />
          <div className="bubble b2" />
          <div className="bubble b3" />
        </div>

          {/* Orbs */}
          <div style={{
            position:"absolute",
            top:"-10%",
            left:"-5%",
            width:520,
            height:520,
            borderRadius:"50%",
            background:"radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 68%)",
            filter:"blur(1px)"
          }} />

          <div style={{
            position:"absolute",
            top:"-6%",
            right:"-8%",
            width:440,
            height:440,
            borderRadius:"50%",
            background:"radial-gradient(circle, rgba(6,182,212,0.13) 0%, transparent 68%)",
            filter:"blur(1px)"
          }} />

          <div style={{
            position:"absolute",
            bottom:"5%",
            left:"28%",
            width:380,
            height:380,
            borderRadius:"50%",
            background:"radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 68%)",
            filter:"blur(1px)"
          }} />
        </div>

        <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", minHeight:"100vh" }}>
          <Navbar />

          <main className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full">
            <div className="mb-8">
              <h1 className="text-4xl font-bold mb-2 text-center text-slate-900 dark:text-white tracking-tight">ClarifAI</h1>
              <p className="text-center text-slate-500 dark:text-[#6b6b6b] text-sm">News Credibility Analyzer</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-200 dark:bg-[#1a1a1a]">
                <TabsTrigger value="detector" className="data-[state=active]:bg-white dark:data-[state=active]:bg-[#222222] data-[state=active]:text-slate-900 dark:data-[state=active]:text-white text-slate-600 dark:text-[#6b6b6b] transition-all duration-200">
                  Content Credibility Analysis
                </TabsTrigger>
                <TabsTrigger value="history" className="data-[state=active]:bg-white dark:data-[state=active]:bg-[#222222] data-[state=active]:text-slate-900 dark:data-[state=active]:text-white text-slate-600 dark:text-[#6b6b6b] transition-all duration-200">
                  Analysis History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="detector" className="space-y-6">
                <Card className="p-6 bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-white/8 shadow-sm cai-stat-card">
                  <h2 className="text-2xl font-semibold mb-2 text-center text-slate-900 dark:text-white">Article Credibility Assessment</h2>
                  <p className="text-slate-500 dark:text-[#6b6b6b] mb-6 text-center text-sm">
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
      </div>
    </>
  )
}

function HistoryTab() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [filtered, setFiltered] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [activeFilter, setActiveFilter] = useState<"ALL" | "REAL" | "FAKE" | "UNVERIFIED">("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const stats = {
    total:        history.length,
    real:         history.filter(d => d.verdict === "REAL").length,
    fake:         history.filter(d => d.verdict === "FAKE").length,
    unverified:   history.filter(d => d.verdict === "UNVERIFIED").length,
    avgConfidence: history.length > 0
      ? Math.round(history.reduce((s, d) => s + d.confidence_score, 0) / history.length)
      : 0,
  }

  useEffect(() => {
    const saved: HistoryItem[] = JSON.parse(localStorage.getItem("analysisHistory") || "[]")
    const valid = saved.filter(i => i.verdict === "REAL" || i.verdict === "FAKE" || i.verdict === "UNVERIFIED")
    setHistory(valid); setFiltered(valid); setLoading(false)
  }, [])

  useEffect(() => {
    let result = [...history]
    if (activeFilter !== "ALL") result = result.filter(i => i.verdict === activeFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(i =>
        i.content_preview.toLowerCase().includes(q) ||
        i.explanation.toLowerCase().includes(q)
      )
    }
    setFiltered(result)
  }, [history, activeFilter, searchQuery])

  const toggleSelect = (id: string) => {
    setSelectedItems(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  const toggleSelectAll = () => {
    if (selectedItems.size === filtered.length) setSelectedItems(new Set())
    else setSelectedItems(new Set(filtered.map(i => i.id)))
  }
  const deleteSelected = () => {
    if (selectedItems.size === 0) return
    const updated = history.filter(i => !selectedItems.has(i.id))
    localStorage.setItem("analysisHistory", JSON.stringify(updated))
    setHistory(updated); setSelectedItems(new Set())
  }
  const clearAll = () => {
    localStorage.setItem("analysisHistory", "[]")
    setHistory([]); setFiltered([]); setSelectedItems(new Set())
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500 dark:text-[#6b6b6b]">Loading history...</p>
      </div>
    </div>
  )

  if (history.length === 0) return (
    <Card className="p-16 text-center bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-white/8">
      <BarChart2 className="w-12 h-12 text-slate-300 dark:text-[#333] mx-auto mb-4" />
      <p className="text-lg font-semibold text-slate-800 dark:text-white mb-1">No assessments yet</p>
      <p className="text-sm text-slate-500 dark:text-[#6b6b6b]">Start by analyzing some content to see your history here.</p>
    </Card>
  )

  const allSelected = filtered.length > 0 && selectedItems.size === filtered.length

  return (
    <div className="space-y-5">
      <Card className="p-4 space-y-3 bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-white/8 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#555]" />
          <input type="text" placeholder="Search assessments..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-[#222] text-slate-800 dark:text-[#e5e5e5] placeholder:text-slate-400 dark:placeholder:text-[#555] focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition" />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-[#a0a0a0]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-slate-400 dark:text-[#555] shrink-0" />
          {(["ALL", "REAL", "FAKE", "UNVERIFIED"] as const).map(f => {
            const countKey = f.toLowerCase() as "real" | "fake" | "unverified"
            const count = f === "ALL" ? stats.total : (stats[countKey] ?? 0)
            const isActive = activeFilter === f
            const cfg = f !== "ALL" ? VERDICT_DISPLAY[f] : null
            return (
              <button key={f} onClick={() => setActiveFilter(f)} className={`cai-filter-pill inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                isActive
                  ? cfg ? `${cfg.bg} ${cfg.text} ${cfg.border}` : "bg-slate-800 dark:bg-white text-white dark:text-slate-900 border-slate-800 dark:border-white"
                  : "bg-slate-100 dark:bg-[#222] text-slate-500 dark:text-[#6b6b6b] border-slate-200 dark:border-white/8 hover:border-slate-400 dark:hover:border-white/20"
              }`}>
                {cfg && isActive && <cfg.icon className="w-3 h-3" />}
                {f === "ALL" ? "All" : VERDICT_DISPLAY[f].label}
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${isActive ? "bg-black/10 dark:bg-white/20" : "bg-slate-200 dark:bg-[#333]"}`}>{count}</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-200 dark:border-white/6">
          <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#6b6b6b] hover:text-slate-700 dark:hover:text-[#a0a0a0] transition">
            {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-blue-500" /> : <Square className="w-3.5 h-3.5" />}
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          <div className="flex items-center gap-2">
            {selectedItems.size > 0 && <span className="text-xs text-slate-500 dark:text-[#6b6b6b]">{selectedItems.size} selected</span>}
            <button onClick={deleteSelected} disabled={selectedItems.size === 0}
              className="cai-action-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-200 dark:hover:bg-rose-950/60 disabled:opacity-40 disabled:cursor-not-allowed transition">
              <Trash2 className="w-3 h-3" />Delete selected
            </button>
            <button onClick={clearAll}
              className="cai-action-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-[#222] text-slate-600 dark:text-[#a0a0a0] border border-slate-200 dark:border-white/8 hover:bg-slate-200 dark:hover:bg-[#2a2a2a] transition">
              <X className="w-3 h-3" />Clear all
            </button>
          </div>
        </div>
      </Card>

      {filtered.length !== history.length && (
        <p className="text-xs text-slate-500 dark:text-[#6b6b6b] px-1">Showing {filtered.length} of {history.length} assessments</p>
      )}

      {filtered.length === 0 ? (
        <Card className="p-10 text-center bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-white/8">
          <Search className="w-8 h-8 text-slate-300 dark:text-[#333] mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700 dark:text-[#a0a0a0]">No matching assessments</p>
          <p className="text-xs text-slate-500 dark:text-[#6b6b6b] mt-1">Try adjusting your search or filter.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const cfg = VERDICT_DISPLAY[item.verdict as keyof typeof VERDICT_DISPLAY] ?? VERDICT_DISPLAY["UNVERIFIED"]
            const VIcon = cfg.icon
            const isSelected = selectedItems.has(item.id)
            const isExpanded = expandedId === item.id
            const date = new Date(item.created_at)

            return (
              <Card key={item.id} className={`cai-history-card overflow-hidden bg-white dark:bg-[#1a1a1a] shadow-sm ${
                isSelected ? "border-blue-400 dark:border-blue-500/50" : "border-slate-200 dark:border-white/8 hover:border-slate-300 dark:hover:border-white/[0.14]"
              }`}>
                <div className="p-4 flex items-start gap-3">
                  <button onClick={() => toggleSelect(item.id)} className="mt-0.5 shrink-0 text-slate-400 dark:text-[#555] hover:text-blue-500 transition">
                    {isSelected ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-[#e5e5e5] line-clamp-2 mb-2 leading-snug">{item.content_preview}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-[#6b6b6b]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium uppercase tracking-wide ${item.input_type === "url" ? "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400" : "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400"}`}>
                        {item.input_type === "url" ? <Link2 className="w-2.5 h-2.5" /> : <FileText className="w-2.5 h-2.5" />}
                        {item.input_type}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 ml-2 shrink-0">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                      <VIcon className="w-3 h-3" />{cfg.label}
                    </span>
                    <div className="text-right">
                      <span className="text-lg font-bold text-slate-800 dark:text-white">{item.confidence_score}%</span>
                      <p className="text-xs text-slate-500 dark:text-[#6b6b6b]">credibility</p>
                    </div>
                  </div>
                </div>

                <div className="h-0.5 w-full bg-slate-100 dark:bg-[#222]">
                  <div className={`h-full transition-all duration-500 ${item.verdict === "REAL" ? "bg-emerald-400" : item.verdict === "FAKE" ? "bg-rose-400" : "bg-amber-400"}`}
                    style={{ width: `${item.confidence_score}%` }} />
                </div>

                <button onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-slate-500 dark:text-[#6b6b6b] hover:text-slate-700 dark:hover:text-[#a0a0a0] hover:bg-slate-50 dark:hover:bg-[#1f1f1f] transition border-t border-slate-100 dark:border-white/5">
                  {isExpanded ? "Hide details" : "Show details"}
                  <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-3 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-[#161616] space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-[#a0a0a0] mb-1">Assessment Summary</p>
                      <p className="text-xs text-slate-500 dark:text-[#6b6b6b] leading-relaxed">{item.explanation}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {item.source_credibility !== undefined && (
                        <div className="rounded-lg bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/8 p-3">
                          <p className="text-xs text-slate-500 dark:text-[#6b6b6b] mb-0.5">Source Credibility</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-white">{item.source_credibility}%</p>
                        </div>
                      )}
                      {item.sentiment_score !== undefined && (
                        <div className="rounded-lg bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/8 p-3">
                          <p className="text-xs text-slate-500 dark:text-[#6b6b6b] mb-0.5">Sentiment Score</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-white">{Math.round(item.sentiment_score * 100)}%</p>
                        </div>
                      )}
                    </div>
                    {item.verdict === "FAKE" && (
                      <div className="rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-3 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-rose-700 dark:text-rose-400">This content showed strong indicators of misinformation. Do not share without independent verification.</p>
                      </div>
                    )}
                    {item.verdict === "REAL" && (
                      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 p-3 flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">This content appeared credible at the time of assessment. Always verify with primary sources.</p>
                      </div>
                    )}
                    {item.verdict === "UNVERIFIED" && (
                      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-3 flex items-start gap-2">
                        <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 dark:text-amber-400">Could not be fully verified. Seek confirmation from multiple trusted sources.</p>
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
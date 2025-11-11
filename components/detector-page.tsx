"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import Navbar from "@/components/navbar"
import DetectorForm from "@/components/detector-form"
import ResultsDisplay from "@/components/results-display"

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
  input_type: "text" | "url" | "file"
  content_preview: string
  fileName?: string
  verdict: "REAL" | "FAKE" | "UNVERIFIED"
  confidence_score: number
  explanation: string
  key_entities?: any
  sentiment_score?: number
  source_credibility?: number
  fact_check_results?: any
  created_at: string
}

export default function DetectorPage() {
  const [activeTab, setActiveTab] = useState("detector")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [inputContent, setInputContent] = useState("")

  const handleAnalyze = async (content: string, type: "text" | "url" | "file", fileName?: string) => {
    setLoading(true)
    setInputContent(content)

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, type, fileName }),
      })

      const data = await response.json()
      setResult(data)

      if (data.verdict !== "ERROR") {
        const history = JSON.parse(localStorage.getItem("analysisHistory") || "[]")
        const newEntry: HistoryItem = {
          id: Date.now().toString(),
          input_type: type,
          content_preview: type === "file" ? fileName || "File" : content.substring(0, 200),
          fileName: fileName,
          verdict: data.verdict,
          confidence_score: data.confidence_score,
          explanation: data.explanation,
          key_entities: data.key_entities,
          sentiment_score: data.sentiment_score,
          source_credibility: data.source_credibility,
          fact_check_results: data.fact_check_results,
          created_at: new Date().toISOString(),
        }
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
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-center">ClarifiAI</h1>
          <p className="text-center text-muted-foreground">Fake News Detector</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="detector">Detector</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="detector" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-semibold mb-2">Verify News Content</h2>
              <p className="text-muted-foreground mb-6">
                Enter a news article, link, or upload a file to check if it's real or fake
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
    </div>
  )
}

function HistoryTab() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [stats, setStats] = useState({ total: 0, real: 0, fake: 0, unverified: 0, avgConfidence: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = () => {
      try {
        const savedHistory = JSON.parse(localStorage.getItem("analysisHistory") || "[]")
        setHistory(savedHistory)

        if (savedHistory && savedHistory.length > 0) {
          const real = savedHistory.filter((d: HistoryItem) => d.verdict === "REAL").length
          const fake = savedHistory.filter((d: HistoryItem) => d.verdict === "FAKE").length
          const unverified = savedHistory.filter((d: HistoryItem) => d.verdict === "UNVERIFIED").length
          const avgConfidence =
            savedHistory.reduce((sum: number, d: HistoryItem) => sum + d.confidence_score, 0) / savedHistory.length

          setStats({
            total: savedHistory.length,
            real,
            fake,
            unverified,
            avgConfidence: Math.round(avgConfidence),
          })
        }
      } catch (error) {
        console.error("Error loading history:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [])

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all history?")) {
      localStorage.setItem("analysisHistory", "[]")
      setHistory([])
      setStats({ total: 0, real: 0, fake: 0, unverified: 0, avgConfidence: 0 })
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading history...</div>
  }

  if (history.length === 0) {
    return (
      <Card className="p-12">
        <div className="text-center">
          <p className="text-muted-foreground text-lg">No analysis history yet. Start by analyzing some content!</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold">Analysis History</h2>
            <div className="text-sm text-muted-foreground mt-1">{stats.total} total analyses</div>
          </div>
          <button
            onClick={handleClearAll}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Clear All
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
            <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </div>
          <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
            <div className="text-3xl font-bold text-green-600">{stats.real}</div>
            <div className="text-sm text-muted-foreground">Real</div>
          </div>
          <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
            <div className="text-3xl font-bold text-red-600">{stats.fake}</div>
            <div className="text-sm text-muted-foreground">Fake</div>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg">
            <div className="text-3xl font-bold text-yellow-600">{stats.avgConfidence}%</div>
            <div className="text-sm text-muted-foreground">Avg Confidence</div>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {history.map((item) => (
          <Card key={item.id} className="p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-semibold line-clamp-2">
                  {item.input_type === "file" ? `📄 ${item.fileName || "File"}` : item.content_preview}
                </p>
                <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  <span>{item.input_type.toUpperCase()}</span>
                </div>
              </div>
              <div className="text-right ml-4">
                <div
                  className={`font-bold ${
                    item.verdict === "REAL"
                      ? "text-green-600"
                      : item.verdict === "FAKE"
                        ? "text-red-600"
                        : "text-yellow-600"
                  }`}
                >
                  {item.verdict}
                </div>
                <div className="text-lg font-bold">{item.confidence_score}%</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
"use client"

import type React from "react"
import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, X } from "lucide-react"

interface DetectorFormProps {
  onAnalyze: (content: string, type: "text" | "url") => void
  onClearResult: () => void
  loading: boolean
}

export default function DetectorForm({ onAnalyze, onClearResult, loading }: DetectorFormProps) {
  const [activeTab, setActiveTab] = useState("article")
  const [articleText, setArticleText] = useState("")
  const [urlInput, setUrlInput] = useState("")
  const [articleError, setArticleError] = useState("")
  const [urlError, setUrlError] = useState("")

  // ── Detect if input looks like a URL ──────────────────────────────────
  function looksLikeUrl(text: string): boolean {
    const trimmed = text.trim()
    return /^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed) || /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/|$)/.test(trimmed)
  }

  // ── Article tab validation ─────────────────────────────────────────────
  const validateArticleInput = (text: string): { isValid: boolean; error: string } => {
    const trimmed = text.trim()

    if (!trimmed) return { isValid: false, error: "" }

    // Looks like a URL pasted in the wrong tab
    if (looksLikeUrl(trimmed)) {
      return {
        isValid: false,
        error: "This looks like a URL. Please switch to the URL tab to analyze a link.",
      }
    }

    if (trimmed.length < 30) {
      return { isValid: false, error: "Content is too short. Please paste a full article or at least a few sentences." }
    }

    const wordCount = trimmed.split(/\s+/).filter(Boolean).length
    if (wordCount < 5) {
      return { isValid: false, error: "Please paste a full article or more text to analyze." }
    }

    const words = trimmed.toLowerCase().split(/\s+/).filter(Boolean)
    const uniqueRatio = new Set(words).size / words.length
    if (uniqueRatio < 0.4) {
      return { isValid: false, error: "The content seems too repetitive. Please provide a real article with varied text." }
    }

    return { isValid: true, error: "" }
  }

  // ── URL tab validation ─────────────────────────────────────────────────
  const validateUrlInput = (url: string): { isValid: boolean; error: string } => {
    const trimmed = url.trim()

    if (!trimmed) return { isValid: false, error: "" }

    // Looks like plain text pasted in the wrong tab
    if (!looksLikeUrl(trimmed)) {
      return {
        isValid: false,
        error: "This looks like article text, not a URL. Please switch to the Article Content tab.",
      }
    }

    try {
      // Auto-prefix if missing scheme
      const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
      new URL(withScheme)
      return { isValid: true, error: "" }
    } catch {
      return { isValid: false, error: "Please enter a valid URL (e.g., https://example.com/article)" }
    }
  }

  const handleArticleSubmit = () => {
    const validation = validateArticleInput(articleText)
    if (!validation.isValid) {
      setArticleError(validation.error)
      return
    }
    setArticleError("")
    onAnalyze(articleText, "text")
  }

  const handleUrlSubmit = () => {
    const validation = validateUrlInput(urlInput)
    if (!validation.isValid) {
      setUrlError(validation.error)
      return
    }
    setUrlError("")
    // Normalize URL before sending
    const trimmed = urlInput.trim()
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    onAnalyze(normalized, "url")
  }

  const handleArticleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setArticleText(e.target.value)
    setArticleError("")
    if (urlInput) setUrlInput("")
    if (e.target.value.trim() === "") onClearResult()
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrlInput(e.target.value)
    setUrlError("")
    if (articleText) setArticleText("")
    if (e.target.value.trim() === "") onClearResult()
  }

  const handleClearArticle = () => {
    setArticleText("")
    setArticleError("")
    onClearResult()
  }

  const handleClearUrl = () => {
    setUrlInput("")
    setUrlError("")
    onClearResult()
  }

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="article">Article Content</TabsTrigger>
          <TabsTrigger value="url">URL</TabsTrigger>
        </TabsList>

        {/* ARTICLE TAB */}
        <TabsContent value="article" className="space-y-4">
          <div className="relative">
            <Textarea
              placeholder="Paste the article content here to assess credibility"
              value={articleText}
              onChange={handleArticleChange}
              className={`min-h-32 pr-10 ${articleError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            {articleText && (
              <button
                onClick={handleClearArticle}
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition"
                aria-label="Clear article"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {articleError && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{articleError}</p>
            </div>
          )}

          <Button
            onClick={handleArticleSubmit}
            disabled={loading || !articleText.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Assessing Credibility...
              </>
            ) : (
              "Analyze Credibility"
            )}
          </Button>
        </TabsContent>

        {/* URL TAB */}
        <TabsContent value="url" className="space-y-4">
          <div className="relative">
            <Input
              type="url"
              placeholder="Enter an article URL (e.g., https://rappler.com/article)"
              value={urlInput}
              onChange={handleUrlChange}
              className={`pr-10 ${urlError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            {urlInput && (
              <button
                onClick={handleClearUrl}
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition"
                aria-label="Clear URL"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {urlError && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{urlError}</p>
            </div>
          )}

          <Button
            onClick={handleUrlSubmit}
            disabled={loading || !urlInput.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Assessing Credibility...
              </>
            ) : (
              "Analyze Credibility"
            )}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  )
}
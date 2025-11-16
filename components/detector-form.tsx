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

  const handleArticleSubmit = () => {
    if (articleText.trim()) onAnalyze(articleText, "text")
  }

  const handleUrlSubmit = () => {
    if (urlInput.trim()) onAnalyze(urlInput, "url")
  }

  const handleArticleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setArticleText(e.target.value)
    if (urlInput) setUrlInput("")
    if (e.target.value.trim() === "") onClearResult()
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrlInput(e.target.value)
    if (articleText) setArticleText("")
    if (e.target.value.trim() === "") onClearResult()
  }

  const handleClearArticle = () => {
    setArticleText("")
    onClearResult()
  }

  const handleClearUrl = () => {
    setUrlInput("")
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
              placeholder="Paste your article content here..."
              value={articleText}
              onChange={handleArticleChange}
              className="min-h-32 pr-10"
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

          <Button
            onClick={handleArticleSubmit}
            disabled={loading || !articleText.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Analyze Now"
            )}
          </Button>
        </TabsContent>

        {/* URL TAB */}
        <TabsContent value="url" className="space-y-4">
          <div className="relative">
            <Input
              type="url"
              placeholder="Enter news article URL"
              value={urlInput}
              onChange={handleUrlChange}
              className="pr-10"
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

          <Button
            onClick={handleUrlSubmit}
            disabled={loading || !urlInput.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Analyze Now"
            )}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  )
}

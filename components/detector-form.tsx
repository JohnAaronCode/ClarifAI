"use client"

import type React from "react"
import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Upload, Loader2, X } from "lucide-react"

interface DetectorFormProps {
  onAnalyze: (content: string, type: "text" | "url" | "file") => void
  onClearResult: () => void  // ✅ new prop to clear results when deleting input
  loading: boolean
}

export default function DetectorForm({ onAnalyze, onClearResult, loading }: DetectorFormProps) {
  const [activeTab, setActiveTab] = useState("article")
  const [articleText, setArticleText] = useState("")
  const [urlInput, setUrlInput] = useState("")
  const [fileContent, setFileContent] = useState("")
  const [fileName, setFileName] = useState("")

  const handleArticleSubmit = () => {
    if (articleText.trim()) onAnalyze(articleText, "text")
  }

  const handleUrlSubmit = () => {
    if (urlInput.trim()) onAnalyze(urlInput, "url")
  }

  const handleFileSubmit = () => {
    if (fileContent.trim()) onAnalyze(fileContent, "file")
  }

  // --- When typing in one input, clear the other ---
  const handleArticleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setArticleText(e.target.value)
    if (urlInput) setUrlInput("") // clear URL field
    if (e.target.value.trim() === "") onClearResult() // clear results if input cleared
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrlInput(e.target.value)
    if (articleText) setArticleText("") // clear article content
    if (e.target.value.trim() === "") onClearResult() // clear results if input cleared
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const text = await file.text()
    setFileContent(text)
    setFileName(file.name)
  }

  const handleChangeFile = () => {
    setFileContent("")
    setFileName("")
    const fileInput = document.getElementById("file-upload") as HTMLInputElement
    if (fileInput) fileInput.value = ""
    onClearResult() // ✅ clear result when removing file
  }

  // --- NEW: Clear buttons for text & URL ---
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
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="article">Article Content</TabsTrigger>
          <TabsTrigger value="url">URL</TabsTrigger>
          <TabsTrigger value="file">Upload File</TabsTrigger>
        </TabsList>

        {/* --- ARTICLE TAB --- */}
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

        {/* --- URL TAB --- */}
        <TabsContent value="url" className="space-y-4">
          <div className="relative">
            <Input
              type="url"
              placeholder="Enter news article URL..."
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

        {/* --- FILE TAB (unchanged except for onClearResult call) --- */}
        <TabsContent value="file" className="space-y-4">
          {!fileContent ? (
            <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="file"
                accept=".txt,.pdf,.docx"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer w-full block space-y-3">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                <div>
                  <p className="font-semibold">Upload a file</p>
                  <p className="text-sm text-muted-foreground">TXT, PDF, or DOCX</p>
                </div>
              </label>
            </div>
          ) : (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-3 dark:bg-slate-800 dark:border-slate-700">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">File Loaded</p>
                  <p className="text-sm text-muted-foreground">{fileName}</p>
                  <p className="text-xs text-muted-foreground mt-1">{fileContent.length} characters</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleChangeFile}>
                  Change File
                </Button>
              </div>
              <div className="bg-background dark:bg-slate-900 p-3 rounded max-h-40 overflow-y-auto text-xs whitespace-pre-wrap break-words border dark:border-slate-700 text-foreground dark:text-slate-100">
                {fileContent.substring(0, 300)}
                {fileContent.length > 300 && "..."}
              </div>
            </div>
          )}

          <Button
            onClick={handleFileSubmit}
            disabled={loading || !fileContent.trim()}
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

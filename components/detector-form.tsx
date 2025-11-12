"use client"

import type React from "react"
import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Upload, Loader2, X } from "lucide-react"

interface DetectorFormProps {
  onAnalyze: (content: string, type: "text" | "url" | "file", fileName?: string) => void
  onClearResult: () => void
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
    if (fileContent.trim()) onAnalyze(fileContent, "file", fileName)
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      let text = ""

      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        text = await extractPdfText(file)
      } else if (
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name.endsWith(".docx")
      ) {
        text = await extractDocxText(file)
      } else if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        text = await file.text()
      } else {
        text = await file.text()
      }

      console.log("[v0] File loaded - name:", file.name, "extracted text length:", text.length)
      setFileContent(text)
      setFileName(file.name)
    } catch (error) {
      console.error("Error reading file:", error)
      setFileContent("[Error reading file - please try another file]")
      setFileName(file.name)
    }
  }

  async function extractDocxText(file: File): Promise<string> {
    if (typeof window === "undefined") {
      throw new Error("Cannot process DOCX files on the server")
    }

    try {
      const mammoth = await import("mammoth")
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer })
      return result.value || "No text found in DOCX file"
    } catch (err) {
      console.error("DOCX parsing error:", err)
      throw new Error("Failed to parse DOCX file")
    }
  }

  async function extractPdfText(file: File): Promise<string> {
    if (typeof window === "undefined") {
      throw new Error("Cannot process PDF files on the server")
    }

    try {
      const pdfjsLib = await import("pdfjs-dist")

      if (typeof window !== "undefined") {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
      }

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      let text = ""

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map((item: any) => item.str).join(" ")
        text += pageText + " "
      }

      return text.trim() || "No text found in PDF file"
    } catch (err) {
      console.error("PDF parsing error:", err)
      throw new Error("Failed to parse PDF file")
    }
  }

  const handleChangeFile = () => {
    setFileContent("")
    setFileName("")
    const fileInput = document.getElementById("file-upload") as HTMLInputElement
    if (fileInput) fileInput.value = ""
    onClearResult()
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
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="article">Article Content</TabsTrigger>
          <TabsTrigger value="url">URL</TabsTrigger>
          <TabsTrigger value="file">Upload File</TabsTrigger>
        </TabsList>

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

        <TabsContent value="url" className="space-y-4">
          <div className="relative">
            <Input
              type="url"
              placeholder="Enter news article URL (e.g., https://rappler.com/article)..."
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
          <p className="text-xs text-muted-foreground">We'll fetch and analyze the article content from the URL</p>
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
                  <p className="text-sm text-muted-foreground">TXT, DOCX, or PDF</p>
                </div>
              </label>
            </div>
          ) : (
            <div className="border rounded-lg p-4 bg-muted/30 dark:bg-slate-800 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">File Loaded</p>
                  <p className="text-sm text-blue-600 font-medium">{fileName}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleChangeFile}>
                  Change File
                </Button>
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
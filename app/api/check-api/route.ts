// app/api/check-api/route.ts
// Tests all API keys using the correct .env variable names

import { NextResponse } from "next/server"
import { ensembleAnalysis } from "@/lib/ml-utils"

export async function GET() {
  const results: Record<string, { status: "ok" | "fail" | "missing"; message: string; latency_ms?: number }> = {}

  // ── 1. HUGGING_FACE_API_KEY ────────────────────────────────────────────────
  const hfKey = process.env.HUGGING_FACE_API_KEY
  if (!hfKey) {
    results.HUGGING_FACE_API_KEY = { status: "missing", message: "Not set in .env" }
  } else {
    const t = Date.now()
    try {
      const res = await fetch(
        "https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${hfKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ inputs: "This is a test sentence." }),
          signal: AbortSignal.timeout(10000),
        },
      )
      const data = await res.json()
      if (res.ok && Array.isArray(data)) {
        results.HUGGING_FACE_API_KEY = {
          status: "ok",
          message: `Working — sentiment model responded (label: ${data[0]?.[0]?.label ?? "unknown"})`,
          latency_ms: Date.now() - t,
        }
      } else if (res.status === 503) {
        results.HUGGING_FACE_API_KEY = {
          status: "ok",
          message: "Key valid — model is loading (normal on first call, wait 20s and retry)",
          latency_ms: Date.now() - t,
        }
      } else {
        results.HUGGING_FACE_API_KEY = {
          status: "fail",
          message: data.error || `HTTP ${res.status}`,
          latency_ms: Date.now() - t,
        }
      }
    } catch (e: any) {
      results.HUGGING_FACE_API_KEY = { status: "fail", message: e.message }
    }
  }

  // ── 2. NEWS_API_KEY ────────────────────────────────────────────────────────
  const newsKey = process.env.NEWS_API_KEY
  if (!newsKey) {
    results.NEWS_API_KEY = { status: "missing", message: "Not set in .env" }
  } else {
    const t = Date.now()
    try {
      const res = await fetch(
        `https://newsapi.org/v2/everything?q=philippines&pageSize=1&apiKey=${newsKey}`,
        { signal: AbortSignal.timeout(5000) },
      )
      const data = await res.json()
      if (res.ok && data.status === "ok") {
        results.NEWS_API_KEY = {
          status: "ok",
          message: `Working — ${data.totalResults} articles available`,
          latency_ms: Date.now() - t,
        }
      } else {
        results.NEWS_API_KEY = {
          status: "fail",
          message: data.message || `HTTP ${res.status}`,
          latency_ms: Date.now() - t,
        }
      }
    } catch (e: any) {
      results.NEWS_API_KEY = { status: "fail", message: e.message }
    }
  }

  // ── 3. GOOGLE_FACT_CHECK_API_KEY ───────────────────────────────────────────
  const googleKey = process.env.GOOGLE_FACT_CHECK_API_KEY
  if (!googleKey) {
    results.GOOGLE_FACT_CHECK_API_KEY = { status: "missing", message: "Not set in .env" }
  } else {
    const t = Date.now()
    try {
      const res = await fetch(
        `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=philippines&key=${googleKey}`,
        { signal: AbortSignal.timeout(5000) },
      )
      const data = await res.json()
      if (res.ok && !data.error) {
        const count = data.claims?.length ?? 0
        results.GOOGLE_FACT_CHECK_API_KEY = {
          status: "ok",
          message: `Working — returned ${count} fact-check claims`,
          latency_ms: Date.now() - t,
        }
      } else {
        results.GOOGLE_FACT_CHECK_API_KEY = {
          status: "fail",
          message: data.error?.message || `HTTP ${res.status}`,
          latency_ms: Date.now() - t,
        }
      }
    } catch (e: any) {
      results.GOOGLE_FACT_CHECK_API_KEY = { status: "fail", message: e.message }
    }
  }

  // ── 4. OPENAI_API_KEY ──────────────────────────────────────────────────────
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    results.OPENAI_API_KEY = { status: "missing", message: "Not set in .env" }
  } else {
    const t = Date.now()
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${openaiKey}` },
        signal: AbortSignal.timeout(5000),
      })
      const data = await res.json()
      if (res.ok && data.data) {
        results.OPENAI_API_KEY = {
          status: "ok",
          message: `Working — ${data.data.length} models accessible`,
          latency_ms: Date.now() - t,
        }
      } else {
        results.OPENAI_API_KEY = {
          status: "fail",
          message: data.error?.message || `HTTP ${res.status}`,
          latency_ms: Date.now() - t,
        }
      }
    } catch (e: any) {
      results.OPENAI_API_KEY = { status: "fail", message: e.message }
    }
  }

  // ── 5. OPEN_PAGE_RANK_API_KEY ──────────────────────────────────────────────
  const oprKey = process.env.OPEN_PAGE_RANK_API_KEY
  if (!oprKey) {
    results.OPEN_PAGE_RANK_API_KEY = { status: "missing", message: "Not set in .env" }
  } else {
    const t = Date.now()
    try {
      const res = await fetch("https://openpagerank.com/api/v1.0/getPageRank?domains[]=google.com", {
        headers: { "API-OPR": oprKey },
        signal: AbortSignal.timeout(5000),
      })
      const data = await res.json()
      if (res.ok && data.response?.[0]?.page_rank_decimal != null) {
        results.OPEN_PAGE_RANK_API_KEY = {
          status: "ok",
          message: `Working — google.com page rank: ${data.response[0].page_rank_decimal}`,
          latency_ms: Date.now() - t,
        }
      } else {
        results.OPEN_PAGE_RANK_API_KEY = {
          status: "fail",
          message: data.error || `HTTP ${res.status}`,
          latency_ms: Date.now() - t,
        }
      }
    } catch (e: any) {
      results.OPEN_PAGE_RANK_API_KEY = { status: "fail", message: e.message }
    }
  }

  // ── Also run a quick ensemble test (uses OpenAI as primary) ─────────────
  let ensembleTest: any = null
  if (openaiKey || hfKey) {
    try {
      ensembleTest = await ensembleAnalysis(
        "The DOH reported 1,200 dengue cases this week in Metro Manila.",
        hfKey || "",
        openaiKey || "",
      )
    } catch (e: any) {
      ensembleTest = { error: e.message }
    }
  }

  const ok = Object.values(results).filter((r) => r.status === "ok").length
  const missing = Object.values(results).filter((r) => r.status === "missing").length
  const failed = Object.values(results).filter((r) => r.status === "fail").length

  return NextResponse.json({
    summary: { ok, missing, failed },
    results,
    ensemble_test: ensembleTest,
    checked_at: new Date().toISOString(),
  })
}
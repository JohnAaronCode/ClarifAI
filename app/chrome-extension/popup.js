const DEFAULT_SERVER = "https://your-clarifai-app.vercel.app"
let currentMode = "text"
let serverUrl = DEFAULT_SERVER

// ── Init ─────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const stored = await chrome.storage.local.get(["serverUrl", "autoDetect"])
  if (stored.serverUrl) {
    serverUrl = stored.serverUrl
    document.getElementById("server-url-input").value = serverUrl
  }

  // Load current tab info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab) {
    document.getElementById("current-url").textContent = tab.url || "Unknown URL"
    document.getElementById("current-title").textContent = tab.title || "Unknown Page"
  }

  loadHistory()
})

// ── Tab switching ─────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"))
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"))
  event.target.classList.add("active")
  document.getElementById(`tab-${name}`).classList.add("active")
  if (name === "history") loadHistory()
}

// ── Mode switching (text/url) ─────────────────────────────────────────────
function setMode(mode) {
  currentMode = mode
  document.getElementById("manual-text").style.display = mode === "text" ? "block" : "none"
  document.getElementById("manual-url").style.display  = mode === "url"  ? "block" : "none"
  document.getElementById("mode-text").style.cssText += mode === "text"
    ? ";border-color:rgba(59,130,246,0.5);background:rgba(59,130,246,0.1);color:#3b82f6;"
    : ";border-color:rgba(255,255,255,0.1);background:transparent;color:#666;"
  document.getElementById("mode-url").style.cssText += mode === "url"
    ? ";border-color:rgba(59,130,246,0.5);background:rgba(59,130,246,0.1);color:#3b82f6;"
    : ";border-color:rgba(255,255,255,0.1);background:transparent;color:#666;"
}

// ── Analyze current page ──────────────────────────────────────────────────
async function analyzeCurrentPage() {
  const btn = document.getElementById("analyze-page-btn")
  const resultEl = document.getElementById("page-result")
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (!tab?.url?.startsWith("http")) {
    resultEl.innerHTML = `<div class="error-box">Cannot analyze this page. Navigate to a news article first.</div>`
    return
  }

  btn.disabled = true
  btn.textContent = "Analyzing..."
  resultEl.innerHTML = renderLoading()

  try {
    const data = await callAnalyzeAPI(tab.url, "url")
    resultEl.innerHTML = renderResult(data, tab.url)
    saveToHistory({ content: tab.url, type: "url", title: tab.title, ...data })
  } catch (err) {
    resultEl.innerHTML = `<div class="error-box">Error: ${err.message}</div>`
  } finally {
    btn.disabled = false
    btn.textContent = "Analyze This Page"
  }
}

// ── Analyze manual input ──────────────────────────────────────────────────
async function analyzeManual() {
  const content = currentMode === "text"
    ? document.getElementById("manual-text").value.trim()
    : document.getElementById("manual-url").value.trim()
  const resultEl = document.getElementById("manual-result")

  if (!content) {
    resultEl.innerHTML = `<div class="error-box">Please enter content to analyze.</div>`
    return
  }

  resultEl.innerHTML = renderLoading()

  try {
    const data = await callAnalyzeAPI(content, currentMode)
    resultEl.innerHTML = renderResult(data, content)
    saveToHistory({ content: content.substring(0, 200), type: currentMode, ...data })
  } catch (err) {
    resultEl.innerHTML = `<div class="error-box">Error: ${err.message}</div>`
  }
}

// ── API Call ──────────────────────────────────────────────────────────────
async function callAnalyzeAPI(content, type) {
  const res = await fetch(`${serverUrl}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, type }),
  })
  if (!res.ok) throw new Error(`Server error: ${res.status}`)
  return res.json()
}

// ── Render helpers ────────────────────────────────────────────────────────
function renderLoading() {
  return `<div class="loading">
    <div class="spinner"></div>
    <div class="loading-text">Analyzing credibility...</div>
  </div>`
}

function renderResult(data, originalInput) {
  if (data.verdict === "ERROR") {
    return `<div class="error-box">${data.explanation}</div>`
  }

  const labels = { REAL: "Credible", FAKE: "Likely False", UNVERIFIED: "Unverified" }
  const conf   = data.confidence_score ?? 50
  const label  = labels[data.verdict] ?? data.verdict
  const fullUrl = `${serverUrl}/detector`

  return `<div class="result-card">
    <div class="verdict-row">
      <span class="verdict-badge verdict-${data.verdict}">${label}</span>
      <span class="confidence">${conf}% confidence</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill fill-${data.verdict}" style="width:${conf}%"></div>
    </div>
    <div class="result-explanation">${(data.explanation || "").substring(0, 200)}...</div>
    <a class="open-full-btn" href="${fullUrl}" target="_blank">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
      Open full analysis
    </a>
  </div>`
}

// ── History ───────────────────────────────────────────────────────────────
async function saveToHistory(item) {
  const { history = [] } = await chrome.storage.local.get("history")
  history.unshift({ ...item, id: Date.now(), created_at: new Date().toISOString() })
  await chrome.storage.local.set({ history: history.slice(0, 30) })
}

async function loadHistory() {
  const { history = [] } = await chrome.storage.local.get("history")
  const el = document.getElementById("history-list")
  if (!history.length) {
    el.innerHTML = `<div class="empty-state">No analyses yet.<br>Start by analyzing a news article.</div>`
    return
  }
  const labels = { REAL: "Credible", FAKE: "Likely False", UNVERIFIED: "Unverified" }
  el.innerHTML = history.map(item => `
    <div class="history-item">
      <div class="history-row">
        <span class="verdict-badge verdict-${item.verdict}" style="font-size:10px;padding:2px 8px;">
          ${labels[item.verdict] ?? item.verdict}
        </span>
        <span class="history-time">${new Date(item.created_at).toLocaleDateString()}</span>
      </div>
      <div class="history-preview">${item.content || item.title || "Unknown"}</div>
    </div>
  `).join("")
}

// ── Settings ──────────────────────────────────────────────────────────────
async function saveSettings() {
  const url = document.getElementById("server-url-input").value.trim()
  if (url) {
    serverUrl = url
    await chrome.storage.local.set({ serverUrl: url })
    alert("Settings saved!")
  }
}
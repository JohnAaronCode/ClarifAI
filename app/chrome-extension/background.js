const WEB_APP_URL = "https://clarif-ai-beta.vercel.app"

// ── Context menu setup ────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id:       "clarifai-analyze-selection",
    title:    "Analyze selected text with ClarifAI",
    contexts: ["selection"],
  })
  chrome.contextMenus.create({
    id:       "clarifai-analyze-link",
    title:    "Analyze this link with ClarifAI",
    contexts: ["link"],
  })
  chrome.contextMenus.create({
    id:       "clarifai-analyze-page",
    title:    "Analyze this page with ClarifAI",
    contexts: ["page"],
  })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  let content = ""
  let type    = "url"

  if (info.menuItemId === "clarifai-analyze-selection" && info.selectionText) {
    content = info.selectionText
    type    = "text"
  } else if (info.menuItemId === "clarifai-analyze-link" && info.linkUrl) {
    content = info.linkUrl
    type    = "url"
  } else if (info.menuItemId === "clarifai-analyze-page" && tab?.url) {
    content = tab.url
    type    = "url"
  }

  if (!content) return

  chrome.storage.local.set({ pendingAnalysis: { content, type } })

  try {
    
    if (chrome.action?.openPopup) {
      chrome.action.openPopup().catch(() => openWebAppTab(content, type))
    } else {
      openWebAppTab(content, type)
    }
  } catch {
    openWebAppTab(content, type)
  }
})

// ── Messages from content script ─────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "analyze" && message.url) {
    chrome.storage.local.set({
      pendingAnalysis: { content: message.url, type: "url" },
    })
    
    sendResponse({ ok: true })
  }
})

function openWebAppTab(content, type) {
  const url = type === "url"
    ? `${WEB_APP_URL}?analyze=${encodeURIComponent(content)}`
    : `${WEB_APP_URL}`
  chrome.tabs.create({ url })
}
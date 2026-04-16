// Handle messages from content script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "analyze") {
    // Open popup with the URL pre-filled
    chrome.action.openPopup()
  }
})

// Context menu: right-click to analyze selected text
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "clarifai-analyze",
    title: "Analyze with ClarifAI",
    contexts: ["selection", "page", "link"],
  })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  chrome.storage.local.set({
    pendingAnalysis: {
      content: info.selectionText || info.linkUrl || tab.url,
      type: info.selectionText ? "text" : "url",
    }
  })
  chrome.action.openPopup()
})
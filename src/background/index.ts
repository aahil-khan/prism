// Background service worker to relay messages from sidepanel to content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SIDEPANEL_CLOSED") {
    // Broadcast to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {
            // Ignore errors for tabs without content scripts
          })
        }
      })
    })
  }
  
  if (message.type === "OPEN_SIDEPANEL") {
    console.log("🔵 Background received OPEN_SIDEPANEL message from tab:", sender.tab?.id)
    // Get the active tab's window and open side panel
    if (sender.tab?.windowId) {
      chrome.sidePanel.open({ windowId: sender.tab.windowId }).then(() => {
        console.log("✅ Side panel opened successfully")
        sendResponse({ success: true })
      }).catch((error) => {
        console.error("❌ Error opening side panel:", error)
        sendResponse({ success: false, error: error.message })
      })
      return true // Required for async sendResponse
    } else {
      console.error("❌ No tab windowId found")
      sendResponse({ success: false, error: "No window ID" })
    }
  }
})

// Listen for consent granted message to store consent
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "CONSENT_GRANTED") {
    chrome.storage.local.set({ "aegis-consent": true })
  }
})


export {}

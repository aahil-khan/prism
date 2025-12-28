import {
  setupPageVisitListener,
} from "./page-event-listeners"
import {
  setupSidepanelClosedListener,
  setupOpenSidepanelListener
} from "./sidepanel-listeners"
import { setupConsentListener } from "./consent-listener"
import { getSessions, initializeSessions } from "./sessionManager"
import { executeSearch } from "./search-coordinator"
import { logSearchResults } from "~/lib/search-explainer"
import {
  incrementTabSwitch,
  updateScrollDepth,
  incrementScrollBurst,
  getBehaviorState
} from "./ephemeralBehavior"

// Initialize sessions from IndexedDB on startup
initializeSessions().then(() => {
  console.log("✅ Sessions initialized from IndexedDB")
})

// Initialize all listeners
setupPageVisitListener()
setupConsentListener()
setupSidepanelClosedListener()
setupOpenSidepanelListener()

// Track tab switches
chrome.tabs.onActivated.addListener(() => {
  incrementTabSwitch()
})

// Track window focus changes (also counts as tab switch)
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    incrementTabSwitch()
  }
})

// Listen for GET_SESSIONS requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_SESSIONS") {
    const sessions = getSessions()
    sendResponse({ sessions })
    return true
  }

  if (message.type === "SEARCH_QUERY") {
    const query = message.payload?.query ?? ""
    const sessions = getSessions()
    const start = performance.now()

    executeSearch(query, sessions)
      .then((results) => {
        const elapsed = performance.now() - start
        logSearchResults(query, results, elapsed)
        sendResponse({ results })
      })
      .catch((error) => {
        console.error("SEARCH_QUERY failed:", error)
        sendResponse({ results: [] })
      })

    return true
  }

  if (message.type === "GET_BEHAVIOR_STATE") {
    const state = getBehaviorState()
    sendResponse({ state })
    return true
  }

  if (message.type === "SCROLL_DEPTH_UPDATE") {
    updateScrollDepth(message.payload.bucket)
  }

  if (message.type === "SCROLL_BURST_DETECTED") {
    incrementScrollBurst()
  }
})

export {}

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
import { computePageCoi, computeSessionCoi, loadCoiWeights } from "~/lib/coi"

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
  broadcastCoiUpdate()
})

// Track window focus changes (also counts as tab switch)
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    incrementTabSwitch()
    broadcastCoiUpdate()
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
    broadcastCoiUpdate()
  }

  if (message.type === "SCROLL_BURST_DETECTED") {
    incrementScrollBurst()
    broadcastCoiUpdate()
  }
})

// Periodic broadcaster to capture dwell/idle changes
setInterval(() => {
  broadcastCoiUpdate()
}, 5000)

async function broadcastCoiUpdate() {
  try {
    const sessions = getSessions()
    const latest = sessions[sessions.length - 1]
    const behavior = getBehaviorState()
    if (!latest) return

    const weights = await loadCoiWeights()
    const sessionCoi = computeSessionCoi(latest, behavior, weights)
    const pageIndex = Math.max(0, latest.pages.length - 1)
    const pageCoi = computePageCoi(latest, pageIndex, behavior, weights)

    chrome.runtime.sendMessage({
      type: "COI_UPDATE",
      payload: {
        session: sessionCoi,
        page: pageCoi,
        pageTitle: latest.pages[pageIndex]?.title,
        pageIndex,
      },
    })
  } catch (err) {
    console.warn("Failed to broadcast COI update", err)
  }
}

export {}

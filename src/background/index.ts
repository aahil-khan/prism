import {
  setupPageVisitListener,
} from "./page-event-listeners"
import {
  setupSidepanelClosedListener,
  setupOpenSidepanelListener
} from "./sidepanel-listeners"
import { setupConsentListener } from "./consent-listener"
import { getSessions, initializeSessions, updateSessionLabel } from "./sessionManager"
import { executeSearch } from "./search-coordinator"
import { loadLabels, addLabel, deleteLabel } from "./labelsStore"
import { logSearchResults } from "~/lib/search-explainer"
import {
  incrementTabSwitch,
  updateScrollDepth,
  incrementScrollBurst,
  getBehaviorState
} from "./ephemeralBehavior"
import { computePageCoi, computeSessionCoi, loadCoiWeights } from "~/lib/coi"
import { buildKnowledgeGraph, type KnowledgeGraph } from "~/lib/knowledge-graph"
import type { PageEvent } from "~/types/page-event"

// Track registered session listeners (sidepanel tabs)
const sessionListeners = new Set<number>()

// Graph state
let knowledgeGraph: KnowledgeGraph | null = null
let graphNeedsRebuild = true

// Initialize sessions from IndexedDB on startup
initializeSessions().then(() => {
  console.log("[Background] Sessions initialized from IndexedDB")
  rebuildGraphIfNeeded()
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

  if (message.type === "LISTEN_FOR_SESSIONS") {
    // Store the sender tab ID to broadcast updates
    const tabId = sender.tab?.id
    if (tabId && !sessionListeners.has(tabId)) {
      sessionListeners.add(tabId)
      console.log("[Background] Session listener registered for tab", tabId)
    }
    sendResponse({ success: true })
    return true
  }

  if (message.type === "GET_GRAPH") {
    rebuildGraphIfNeeded()
    sendResponse({ graph: knowledgeGraph })
    return true
  }

  if (message.type === "REFRESH_GRAPH") {
    graphNeedsRebuild = true
    rebuildGraphIfNeeded()
    sendResponse({ graph: knowledgeGraph })
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

  if (message.type === "GET_LABELS") {
    loadLabels()
      .then((labels) => {
        sendResponse({ labels })
      })
      .catch((error) => {
        console.error("GET_LABELS failed:", error)
        sendResponse({ labels: [] })
      })
    return true
  }

  if (message.type === "UPDATE_SESSION_LABEL") {
    const { sessionId, labelId } = message.payload
    updateSessionLabel(sessionId, labelId)
      .then(() => {
        sendResponse({ success: true })
        broadcastSessionUpdate()
      })
      .catch((error) => {
        console.error("UPDATE_SESSION_LABEL failed:", error)
        sendResponse({ success: false })
      })
    return true
  }

  if (message.type === "ADD_LABEL") {
    const { name, color } = message.payload
    addLabel({ name, color })
      .then((newLabel) => {
        sendResponse({ label: newLabel })
      })
      .catch((error) => {
        console.error("ADD_LABEL failed:", error)
        sendResponse({ error: error.message })
      })
    return true
  }

  if (message.type === "DELETE_LABEL") {
    const { labelId } = message.payload
    deleteLabel(labelId)
      .then(() => {
        sendResponse({ success: true })
      })
      .catch((error) => {
        console.error("DELETE_LABEL failed:", error)
        sendResponse({ success: false })
      })
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

    const message = {
      type: "COI_UPDATE",
      payload: {
        session: sessionCoi,
        page: pageCoi,
        pageTitle: latest.pages[pageIndex]?.title,
        pageIndex,
      },
    }

    // Broadcast to all registered listeners
    for (const tabId of sessionListeners) {
      chrome.tabs.sendMessage(tabId, message).catch(() => {
        // Tab closed or not responding, remove from listeners
        sessionListeners.delete(tabId)
      })
    }
  } catch (err) {
    console.warn("[Background] Failed to broadcast COI update", err)
  }
}

export function broadcastSessionUpdate() {
  // Sessions are already persisted to IndexedDB by sessionManager
  // PopulatedState will poll for updates
  console.log("[Background] Session updated, count:", getSessions().length)
}

function rebuildGraphIfNeeded() {
  if (!graphNeedsRebuild && knowledgeGraph !== null) {
    return
  }

  try {
    const sessions = getSessions()
    const allPages: PageEvent[] = []
    
    for (const session of sessions) {
      allPages.push(...session.pages)
    }

    console.log("[Background] Rebuilding knowledge graph from pages:", allPages.length)
    
    knowledgeGraph = buildKnowledgeGraph(allPages, {
      similarityThreshold: 0.35,
      maxEdgesPerNode: 8,
      maxNodes: 500
    })
    
    graphNeedsRebuild = false
    
    console.log("[Background] Graph rebuilt with nodes:", knowledgeGraph.nodes.length, "edges:", knowledgeGraph.edges.length)
  } catch (err) {
    console.error("[Background] Failed to rebuild knowledge graph:", err)
    knowledgeGraph = { nodes: [], edges: [], lastUpdated: Date.now() }
  }
}

// Mark graph for rebuild when new page visits occur
export function markGraphForRebuild() {
  graphNeedsRebuild = true
}

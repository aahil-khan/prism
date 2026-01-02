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
import { loadLabels, addLabel, deleteLabel, getLabelById } from "./labelsStore"
import { loadLearnedAssociations, learnFromSession } from "./contextLearning"
import { 
  detectProjects, 
  loadProjects, 
  addProject, 
  updateProject, 
  deleteProject 
} from "./projectManager"
import { 
  getReadyCandidates,
  dismissCandidate,
  promoteCandidateToProject,
  createTestCandidate,
  clearAllCandidates,
  loadCandidates,
  saveCandidates
} from "./candidateDetector"
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
import {
  initializeFocusMode,
  toggleFocusMode,
  toggleCategory,
  setEnabledCategories,
  getFocusModeState,
  refreshBlockingRules
} from "./focusModeManager"
import {
  loadBlocklist,
  saveBlocklist,
  addBlocklistEntry,
  updateBlocklistEntry,
  deleteBlocklistEntry,
  updateCategoryStates,
  importBlocklist,
  exportBlocklist
} from "./blocklistStore"
import type { BlocklistEntry, BlocklistCategory } from "~/types/focus-mode"

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

// Initialize learned context associations
loadLearnedAssociations().then(() => {
  console.log("[Background] Context learning initialized")
})

// Initialize focus mode on startup
initializeFocusMode().then(() => {
  console.log("[Background] Focus mode initialized")
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
      .then(async () => {
        // Learn from this labeling behavior if a label was assigned
        if (labelId) {
          const session = getSessions().find(s => s.id === sessionId)
          const label = await getLabelById(labelId)
          if (session && label) {
            await learnFromSession(session, label.name)
          }
        }
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

  if (message.type === "GET_PROJECTS") {
    loadProjects()
      .then((projects) => {
        sendResponse({ projects })
      })
      .catch((error) => {
        console.error("GET_PROJECTS failed:", error)
        sendResponse({ projects: [] })
      })
    return true
  }

  if (message.type === "DETECT_PROJECTS") {
    try {
      const sessions = getSessions()
      const projects = detectProjects(sessions)
      sendResponse({ projects })
    } catch (error) {
      console.error("DETECT_PROJECTS failed:", error)
      sendResponse({ projects: [] })
    }
    return true
  }

  if (message.type === "CREATE_PROJECT") {
    const { name, description, sessionIds } = message.payload
    const sessions = getSessions()
    const projectSessions = sessions.filter(s => sessionIds.includes(s.id))
    
    addProject({
      name,
      description,
      startDate: Math.min(...projectSessions.map(s => s.startTime)),
      endDate: Math.max(...projectSessions.map(s => s.endTime)),
      sessionIds,
      keywords: [],
      topDomains: [],
      sites: [], // Manual projects start with no sites
      status: 'active',
      autoDetected: false,
      score: 100 // Manual projects get perfect score
    })
      .then((newProject) => {
        sendResponse({ project: newProject })
      })
      .catch((error) => {
        console.error("CREATE_PROJECT failed:", error)
        sendResponse({ error: error.message })
      })
    return true
  }

  if (message.type === "UPDATE_PROJECT") {
    const { projectId, updates } = message.payload
    updateProject(projectId, updates)
      .then(() => {
        sendResponse({ success: true })
      })
      .catch((error) => {
        console.error("UPDATE_PROJECT failed:", error)
        sendResponse({ success: false })
      })
    return true
  }

  if (message.type === "DELETE_PROJECT") {
    const { projectId } = message.payload
    deleteProject(projectId)
      .then(() => {
        sendResponse({ success: true })
      })
      .catch((error) => {
        console.error("DELETE_PROJECT failed:", error)
        sendResponse({ success: false })
      })
    return true
  }

  if (message.type === "ADD_SITE_TO_PROJECT") {
    const { projectId, siteUrl, siteTitle, addedBy = 'user' } = message.payload
    console.log("[ADD_SITE_TO_PROJECT]", { projectId, siteUrl, siteTitle })
    
    loadProjects()
      .then(async (projects) => {
        const project = projects.find(p => p.id === projectId)
        if (!project) {
          sendResponse({ success: false, error: "Project not found" })
          return
        }
        
        // Check if site already exists IN THIS PROJECT
        // Note: Sites CAN belong to multiple projects, so we only check this project
        if (project.sites.some(s => s.url === siteUrl)) {
          sendResponse({ success: false, error: "Site already in this project", alreadyAdded: true })
          return
        }
        
        // Add new site
        const newSite = {
          url: siteUrl,
          title: siteTitle,
          addedAt: Date.now(),
          addedBy: addedBy as 'auto' | 'user',
          visitCount: 0 // Will be calculated from sessions
        }
        project.sites.push(newSite)
        
        // Save updated projects
        const otherProjects = projects.filter(p => p.id !== projectId)
        await chrome.storage.local.set({ "aegis-projects": [...otherProjects, project] })
        
        console.log("[ADD_SITE_TO_PROJECT] Site added successfully to project:", project.name)
        console.log(`  → Site can now belong to multiple projects`)
        sendResponse({ success: true, project })
      })
      .catch((error) => {
        console.error("ADD_SITE_TO_PROJECT failed:", error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message.type === "DISMISS_PROJECT_SUGGESTION") {
    const { projectId, url } = message.payload
    console.log("[DISMISS_PROJECT_SUGGESTION]", { projectId, url })
    
    loadProjects()
      .then(async (projects) => {
        const project = projects.find(p => p.id === projectId)
        if (!project) {
          sendResponse({ success: false, error: "Project not found" })
          return
        }
        
        // Initialize dismissedSuggestions if not present
        if (!project.dismissedSuggestions) {
          project.dismissedSuggestions = []
        }
        
        // Add dismissal record
        project.dismissedSuggestions.push({
          url,
          timestamp: Date.now()
        })
        
        // Save updated projects
        const otherProjects = projects.filter(p => p.id !== projectId)
        await chrome.storage.local.set({ "aegis-projects": [...otherProjects, project] })
        
        console.log("[DISMISS_PROJECT_SUGGESTION] Dismissal recorded, will not suggest again for 24 hours")
        sendResponse({ success: true })
      })
      .catch((error) => {
        console.error("DISMISS_PROJECT_SUGGESTION failed:", error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  // Project candidate operations
  if (message.type === "GET_READY_CANDIDATES") {
    getReadyCandidates()
      .then((candidates) => {
        sendResponse({ candidates })
      })
      .catch((error) => {
        console.error("GET_READY_CANDIDATES failed:", error)
        sendResponse({ candidates: [] })
      })
    return true
  }

  if (message.type === "DISMISS_CANDIDATE") {
    const { candidateId } = message.payload
    dismissCandidate(candidateId)
      .then(() => {
        sendResponse({ success: true })
      })
      .catch((error) => {
        console.error("DISMISS_CANDIDATE failed:", error)
        sendResponse({ success: false })
      })
    return true
  }

  if (message.type === "SNOOZE_CANDIDATE") {
    const { candidateId } = message.payload
    // Snooze = increase snoozeCount and reset status to 'watching'
    // This requires 2 more visits per snooze to trigger notification again
    loadCandidates()
      .then(async (candidates) => {
        const candidate = candidates.find(c => c.id === candidateId)
        if (candidate) {
          candidate.snoozeCount = (candidate.snoozeCount || 0) + 1
          candidate.status = 'watching'
          candidate.notificationShown = false
          console.log(`[Snooze] Candidate snoozed. Will need ${2 * candidate.snoozeCount} more visits`)
          await saveCandidates(candidates)
          sendResponse({ success: true })
        } else {
          sendResponse({ success: false, error: "Candidate not found" })
        }
      })
      .catch((error) => {
        console.error("SNOOZE_CANDIDATE failed:", error)
        sendResponse({ success: false })
      })
    return true
  }

  if (message.type === "PROMOTE_CANDIDATE") {
    const { candidateId } = message.payload
    console.log("[PROMOTE_CANDIDATE] Processing candidateId:", candidateId)
    
    // Get all candidates (not just ready ones) to find the one to promote
    loadCandidates()
      .then(async (candidates) => {
        console.log("[PROMOTE_CANDIDATE] Found", candidates.length, "total candidates")
        const candidate = candidates.find(c => c.id === candidateId)
        console.log("[PROMOTE_CANDIDATE] Target candidate found:", !!candidate)
        if (!candidate) {
          console.error("[PROMOTE_CANDIDATE] Candidate not found:", candidateId)
          sendResponse({ success: false, error: "Candidate not found" })
          return
        }

        const sessions = getSessions()
        const projectSessions = sessions.filter(s => candidate.sessionIds.includes(s.id))
        
        // Create initial site from the most visited specific resource
        const primarySite = candidate.specificResources[0] // The resource that triggered detection
        const initialSites = [{
          url: primarySite,
          title: candidate.keywords.length > 0 
            ? candidate.keywords.slice(0, 3).join(' ')
            : candidate.primaryDomain,
          addedAt: Date.now(),
          addedBy: 'auto' as const,
          visitCount: candidate.visitCount
        }]
        
        // Create project from candidate
        const newProject = await addProject({
          name: candidate.keywords.length > 0 
            ? candidate.keywords.slice(0, 3).join(' ') 
            : candidate.primaryDomain,
          description: `Auto-detected project on ${candidate.primaryDomain}`,
          startDate: candidate.firstSeen,
          endDate: candidate.lastSeen,
          sessionIds: candidate.sessionIds,
          keywords: candidate.keywords,
          topDomains: [candidate.primaryDomain, ...candidate.relatedDomains.slice(1, 3)],
          sites: initialSites,
          status: 'active',
          autoDetected: true,
          score: candidate.score
        })

        // Remove candidate from storage
        await promoteCandidateToProject(candidateId)

        sendResponse({ success: true, project: newProject })
      })
      .catch((error) => {
        console.error("PROMOTE_CANDIDATE failed:", error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  // Dev testing helpers
  if (message.type === "CREATE_TEST_CANDIDATE") {
    const { domain, keywords, score } = message.payload
    createTestCandidate(domain, keywords, score)
      .then((candidate) => {
        sendResponse({ success: true, candidate })
      })
      .catch((error) => {
        console.error("CREATE_TEST_CANDIDATE failed:", error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message.type === "CLEAR_ALL_CANDIDATES") {
    clearAllCandidates()
      .then(() => {
        sendResponse({ success: true })
      })
      .catch((error) => {
        console.error("CLEAR_ALL_CANDIDATES failed:", error)
        sendResponse({ success: false })
      })
    return true
  }

  if (message.type === "OPEN_SIDEPANEL_TO_PROJECTS") {
    // Open sidepanel and notify it to switch to projects tab
    console.log("[Background] Opening sidepanel to projects tab")
    
    // Store the preferred tab in chrome storage so sidepanel can read it
    chrome.storage.local.set({ "sidepanel-active-tab": "projects" }, () => {
      console.log("[Background] Set sidepanel tab preference to 'projects'")
    })
    
    // Get the active tab and open sidepanel for it
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.sidePanel.open({ tabId: tabs[0].id }, () => {
          if (chrome.runtime.lastError) {
            console.error("[Background] Failed to open sidepanel:", chrome.runtime.lastError)
            sendResponse({ success: false, error: chrome.runtime.lastError.message })
          } else {
            console.log("[Background] Sidepanel opened successfully")
            sendResponse({ success: true })
          }
        })
      } else {
        console.error("[Background] No active tab found")
        sendResponse({ success: false, error: "No active tab" })
      }
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

  // Focus Mode message handlers
  if (message.type === "TOGGLE_FOCUS_MODE") {
    toggleFocusMode()
      .then((state) => {
        sendResponse({ state })
      })
      .catch((error) => {
        console.error("TOGGLE_FOCUS_MODE failed:", error)
        sendResponse({ error: error.message })
      })
    return true
  }

  if (message.type === "GET_FOCUS_STATE") {
    const state = getFocusModeState()
    sendResponse({ state })
    return true
  }

  if (message.type === "TOGGLE_CATEGORY") {
    const { category } = message.payload
    toggleCategory(category as BlocklistCategory)
      .then((state) => {
        sendResponse({ state })
      })
      .catch((error) => {
        console.error("TOGGLE_CATEGORY failed:", error)
        sendResponse({ error: error.message })
      })
    return true
  }

  if (message.type === "SET_ENABLED_CATEGORIES") {
    const { categories } = message.payload
    setEnabledCategories(categories as BlocklistCategory[])
      .then((state) => {
        sendResponse({ state })
      })
      .catch((error) => {
        console.error("SET_ENABLED_CATEGORIES failed:", error)
        sendResponse({ error: error.message })
      })
    return true
  }

  if (message.type === "GET_BLOCKLIST") {
    console.log("[Background] GET_BLOCKLIST request received")
    loadBlocklist()
      .then((blocklist) => {
        console.log("[Background] Sending blocklist with", blocklist.entries.length, "entries")
        sendResponse({ blocklist })
      })
      .catch((error) => {
        console.error("GET_BLOCKLIST failed:", error)
        sendResponse({ error: error.message })
      })
    return true
  }

  if (message.type === "ADD_BLOCKLIST_ENTRY") {
    const { entry } = message.payload
    addBlocklistEntry(entry as BlocklistEntry)
      .then(async () => {
        await refreshBlockingRules()
        const blocklist = await loadBlocklist()
        sendResponse({ success: true, blocklist })
      })
      .catch((error) => {
        console.error("ADD_BLOCKLIST_ENTRY failed:", error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message.type === "UPDATE_BLOCKLIST_ENTRY") {
    const { index, entry } = message.payload
    updateBlocklistEntry(index, entry as BlocklistEntry)
      .then(async () => {
        await refreshBlockingRules()
        const blocklist = await loadBlocklist()
        sendResponse({ success: true, blocklist })
      })
      .catch((error) => {
        console.error("UPDATE_BLOCKLIST_ENTRY failed:", error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message.type === "DELETE_BLOCKLIST_ENTRY") {
    const { index } = message.payload
    deleteBlocklistEntry(index)
      .then(async () => {
        await refreshBlockingRules()
        const blocklist = await loadBlocklist()
        sendResponse({ success: true, blocklist })
      })
      .catch((error) => {
        console.error("DELETE_BLOCKLIST_ENTRY failed:", error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message.type === "UPDATE_CATEGORY_STATES") {
    const { categoryStates } = message.payload
    updateCategoryStates(categoryStates)
      .then(async () => {
        await refreshBlockingRules()
        const blocklist = await loadBlocklist()
        sendResponse({ success: true, blocklist })
      })
      .catch((error) => {
        console.error("UPDATE_CATEGORY_STATES failed:", error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message.type === "IMPORT_BLOCKLIST") {
    const { blocklist, mergeStrategy } = message.payload
    importBlocklist(blocklist, mergeStrategy)
      .then(async () => {
        await refreshBlockingRules()
        const updatedBlocklist = await loadBlocklist()
        sendResponse({ success: true, blocklist: updatedBlocklist })
      })
      .catch((error) => {
        console.error("IMPORT_BLOCKLIST failed:", error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (message.type === "EXPORT_BLOCKLIST") {
    exportBlocklist()
      .then((blocklist) => {
        sendResponse({ blocklist })
      })
      .catch((error) => {
        console.error("EXPORT_BLOCKLIST failed:", error)
        sendResponse({ error: error.message })
      })
    return true
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

// DEV ONLY: Export test helpers to window for console access
if (typeof globalThis !== 'undefined') {
  import("./testHelpers").then((module) => {
    (globalThis as any).testHelpers = {
      testNewProjectDetection: module.testNewProjectDetection,
      testMultiProjectPerDomain: module.testMultiProjectPerDomain,
      testSmartSuggestions: module.testSmartSuggestions,
      testIdempotentNotifications: module.testIdempotentNotifications,
      testSnooze: module.testSnooze,
      testFullWorkflow: module.testFullWorkflow,
      runAllTests: module.runAllTests,
      interactiveTest: module.interactiveTest,
      // Also expose direct utilities
      createTestCandidate,
      clearAllCandidates,
      loadCandidates,
      loadProjects
    }
    console.log("%c🧪 Test helpers loaded!", "background: #4CAF50; color: white; padding: 4px 8px; font-weight: bold")
    console.log("%cQuick start: testHelpers.runAllTests()", "color: #2196F3; font-weight: bold")
    console.log("%cInteractive: testHelpers.interactiveTest()", "color: #FF9800; font-weight: bold")
  })
}

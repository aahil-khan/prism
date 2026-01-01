import type { PageEvent } from "~/types/page-event"
import type { Session } from "~/types/session"
import { loadSessions, saveSessions } from "./sessionStore"
import { checkSessionChange } from "./ephemeralBehavior"
import { inferSessionTitle } from "~/lib/session-title-inference"
import { classifyPageContext, isSameContext } from "~/lib/context-classifier"
import { learnFromSession } from "./contextLearning"

// Sessionization thresholds
const SESSION_GAP_MS = 30 * 60 * 1000 // 30 minutes - inactivity creates new session
const MAX_SESSION_DURATION_MS = 2 * 60 * 60 * 1000 // 2 hours - force split after this duration
const CONTEXT_SWITCH_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes - context change with short gap

let sessions: Session[] = []
let isInitialized = false

/**
 * Backfill missing inferred titles for sessions loaded from storage
 */
function backfillInferredTitles(sessions: Session[]): Session[] {
  return sessions.map((session) => {
    if (!session.inferredTitle || session.inferredTitle.trim() === "") {
      return {
        ...session,
        inferredTitle: inferSessionTitle(session)
      }
    }
    return session
  })
}

/**
 * Initialize sessions from persistent storage
 */
export async function initializeSessions(): Promise<void> {
  if (isInitialized) return
  try {
    sessions = await loadSessions()
    
    // Re-sessionize all existing sessions with new hybrid logic
    // This ensures old sessions stored with 30-min gap only are now split intelligently
    sessions = reSessionizeAll(sessions)
    
    // Backfill missing inferred titles for existing sessions
    sessions = backfillInferredTitles(sessions)
    // Merge single-page sessions after loading
    sessions = mergeSinglePageSessions(sessions)
    isInitialized = true
    
    // Initialize ephemeral tracking for last session if exists
    const lastSession = getLastSession()
    if (lastSession) {
      checkSessionChange(lastSession.id)
    }
  } catch (error) {
    console.error("Failed to initialize sessions:", error)
    sessions = []
    isInitialized = true
  }
}

/**
 * Generate a unique session ID (timestamp-based)
 */
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Get the last session if it exists
 */
function getLastSession(): Session | undefined {
  return sessions[sessions.length - 1]
}

/**
 * Determine if a new session should be started based on hybrid criteria:
 * 1. Time gap exceeds 30 minutes (inactivity)
 * 2. Session duration exceeds 2 hours (force split for manageability)
 * 3. Context switch detected (different activity type after 5+ minute gap)
 */
function shouldStartNewSession(
  lastSession: Session,
  newPageEvent: PageEvent
): boolean {
  const timeSinceLastEvent = newPageEvent.timestamp - lastSession.endTime
  const sessionDuration = lastSession.endTime - lastSession.startTime

  // Criterion 1: Long inactivity gap (30+ minutes)
  if (timeSinceLastEvent > SESSION_GAP_MS) {
    return true
  }

  // Criterion 2: Maximum session duration exceeded (2+ hours)
  if (sessionDuration > MAX_SESSION_DURATION_MS) {
    return true
  }

  // Criterion 3: Context switch with moderate gap (5+ minutes)
  if (timeSinceLastEvent > CONTEXT_SWITCH_THRESHOLD_MS) {
    const lastPage = lastSession.pages[lastSession.pages.length - 1]
    if (lastPage && !isSameContext(lastPage, newPageEvent)) {
      return true
    }
  }

  return false
}

/**
 * Process a page event and add it to a session
 * Uses hybrid sessionization: time gaps, duration limits, and context switching
 */
export async function processPageEvent(pageEvent: PageEvent): Promise<void> {
  const lastSession = getLastSession()

  if (!lastSession) {
    // Create first session
    const newSession = {
      id: generateSessionId(),
      startTime: pageEvent.timestamp,
      endTime: pageEvent.timestamp,
      pages: [pageEvent],
      inferredTitle: "" // Will be set after pages are added
    }
    sessions.push(newSession)
    checkSessionChange(newSession.id)
  } else {
    // Check if we need to create a new session using hybrid criteria
    if (shouldStartNewSession(lastSession, pageEvent)) {
      // Create new session
      const newSession = {
        id: generateSessionId(),
        startTime: pageEvent.timestamp,
        endTime: pageEvent.timestamp,
        pages: [pageEvent]
      }
      sessions.push(newSession)
      checkSessionChange(newSession.id)
    } else {
      // Deduplicate by URL within the current session: update existing entry instead of adding
      const existingIndex = lastSession.pages.findIndex((p) => p.url === pageEvent.url)
      if (existingIndex !== -1) {
        const existing = lastSession.pages[existingIndex]
        existing.title = pageEvent.title || existing.title
        existing.timestamp = pageEvent.timestamp
        existing.visitCount = (existing.visitCount ?? 1) + 1
        // Prefer keeping the earliest openedAt
        existing.openedAt = Math.min(existing.openedAt || pageEvent.openedAt, pageEvent.openedAt)
        // If the new event has an embedding and existing doesn't, adopt it
        if (!existing.titleEmbedding && pageEvent.titleEmbedding) {
          existing.titleEmbedding = pageEvent.titleEmbedding
        }
        // Move the updated page to the end to reflect recency
        lastSession.pages.splice(existingIndex, 1)
        lastSession.pages.push(existing)
        lastSession.endTime = pageEvent.timestamp
        // Recalculate inferred title after updating pages
        lastSession.inferredTitle = inferSessionTitle(lastSession)
      } else {
        // Append as new entry, initialize visitCount
        lastSession.pages.push({ ...pageEvent, visitCount: 1 })
        lastSession.endTime = pageEvent.timestamp
        // Recalculate inferred title after adding page
        lastSession.inferredTitle = inferSessionTitle(lastSession)
      }
    }
  }

  // Persist sessions
  try {
    // Ensure all sessions have inferred titles before saving
    sessions = sessions.map((s) => ({
      ...s,
      inferredTitle: s.inferredTitle || inferSessionTitle(s)
    }))
    await saveSessions(sessions)
    // Merge single-page sessions after persistence
    sessions = mergeSinglePageSessions(sessions)
  } catch (error) {
    console.error("Failed to persist sessions:", error)
    // Sessions remain in memory even if persistence fails
  }
}

/**
 * Re-sessionize all existing sessions using the new hybrid logic
 * Flattens all pages from old sessions and re-chunks them based on:
 * 1. Time gaps (30 minutes)
 * 2. Maximum duration (2 hours)
 * 3. Context switching (5+ min gap + activity type change)
 */
function reSessionizeAll(oldSessions: Session[]): Session[] {
  if (oldSessions.length === 0) return []

  // Flatten all pages and sort by timestamp
  const allPages = oldSessions
    .flatMap((s) => s.pages)
    .sort((a, b) => a.timestamp - b.timestamp)

  const newSessions: Session[] = []
  let currentSession: Session | null = null

  allPages.forEach((page) => {
    if (!currentSession) {
      // Start first session
      currentSession = {
        id: generateSessionId(),
        startTime: page.timestamp,
        endTime: page.timestamp,
        pages: [page],
        inferredTitle: "",
      }
    } else if (shouldStartNewSession(currentSession, page)) {
      // Save current session and start a new one
      newSessions.push(currentSession)
      currentSession = {
        id: generateSessionId(),
        startTime: page.timestamp,
        endTime: page.timestamp,
        pages: [page],
        inferredTitle: "",
      }
    } else {
      // Add to current session
      currentSession.pages.push(page)
      currentSession.endTime = page.timestamp
    }
  })

  // Push the last session
  if (currentSession) {
    newSessions.push(currentSession)
  }

  console.log(
    `[Sessionization] Re-sessionized ${oldSessions.length} old sessions into ${newSessions.length} new sessions`
  )

  return newSessions
}

/**
 * Merge single-page sessions with the next session to maintain minimum 2-page sessions
 * Deduplicates URLs when merging to keep sessions clean
 */
function mergeSinglePageSessions(sessions: Session[]): Session[] {
  if (sessions.length <= 1) return sessions

  const merged: Session[] = []

  for (let i = 0; i < sessions.length; i++) {
    const current = sessions[i]
    const next = sessions[i + 1]

    // If current session has only 1 page and there's a next session
    if (current.pages.length === 1 && next) {
      // Create a new merged session
      const pageUrl = current.pages[0].url

      // Check if this URL already exists in the next session
      const urlExistsInNext = next.pages.some((p) => p.url === pageUrl)

      if (!urlExistsInNext) {
        // URL doesn't exist in next session, add it to the front
        next.pages.unshift(current.pages[0])
      }
      // If URL already exists, skip adding it (deduplicate)

      // Update next session's start time to be earlier
      next.startTime = Math.min(current.startTime, next.startTime)

      // Recalculate inferred title after merging
      next.inferredTitle = inferSessionTitle(next)

      // Skip the current session, merge is complete
      i++ // Skip next iteration to avoid re-processing the merged session
      continue
    }

    // If current session has 2+ pages or no next session, keep it as is
    merged.push(current)
  }

  return merged
}

/**
 * Get all sessions in memory
 */
export function getSessions(): Session[] {
  return sessions
}

/**
 * Get current session ID (the most recent session)
 */
export function getCurrentSessionId(): string | null {
  const lastSession = getLastSession()
  return lastSession?.id || null
}

/**
 * Update a session's label
 */
export async function updateSessionLabel(sessionId: string, labelId: string | undefined): Promise<void> {
  const session = sessions.find((s) => s.id === sessionId)
  if (!session) return

  session.labelId = labelId

  try {
    await saveSessions(sessions)
  } catch (error) {
    console.error("Failed to persist session label update:", error)
  }
}

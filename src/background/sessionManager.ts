import type { PageEvent } from "~/types/page-event"
import type { Session } from "~/types/session"
import { loadSessions, saveSessions } from "./sessionStore"

const SESSION_GAP_MS = 30 * 60 * 1000 // 30 minutes

let sessions: Session[] = []
let isInitialized = false

/**
 * Initialize sessions from persistent storage
 */
export async function initializeSessions(): Promise<void> {
  if (isInitialized) return
  try {
    sessions = await loadSessions()
    isInitialized = true
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
 * Process a page event and add it to a session
 * Creates a new session if the gap from the last event exceeds SESSION_GAP_MS
 */
export async function processPageEvent(pageEvent: PageEvent): Promise<void> {
  const lastSession = getLastSession()

  if (!lastSession) {
    // Create first session
    sessions.push({
      id: generateSessionId(),
      startTime: pageEvent.timestamp,
      endTime: pageEvent.timestamp,
      pages: [pageEvent]
    })
  } else {
    // Check if we need to create a new session
    const timeSinceLastEvent = pageEvent.timestamp - lastSession.endTime
    if (timeSinceLastEvent > SESSION_GAP_MS) {
      // Create new session
      sessions.push({
        id: generateSessionId(),
        startTime: pageEvent.timestamp,
        endTime: pageEvent.timestamp,
        pages: [pageEvent]
      })
    } else {
      // Append to existing session
      lastSession.pages.push(pageEvent)
      lastSession.endTime = pageEvent.timestamp
    }
  }

  // Persist sessions
  try {
    await saveSessions(sessions)
  } catch (error) {
    console.error("Failed to persist sessions:", error)
    // Sessions remain in memory even if persistence fails
  }
}

/**
 * Get all sessions in memory
 */
export function getSessions(): Session[] {
  return sessions
}

import type { EphemeralBehaviorState, ScrollDepthBucket } from "~/types/ephemeral-behavior"

let behaviorState: EphemeralBehaviorState | null = null
let idleTimer: NodeJS.Timeout | null = null
let lastActivityTime: number = Date.now()
let isCurrentlyIdle: boolean = false

const IDLE_TIMEOUT_MS = 30 * 1000 // 30 seconds

/**
 * Initialize behavior tracking for a new session
 */
export function initBehaviorTracking(sessionId: string): void {
  behaviorState = {
    sessionId,
    tabSwitchCount: 0,
    idleTransitions: 0,
    scroll: {
      maxDepthBucket: "top",
      burstCount: 0
    }
  }
  lastActivityTime = Date.now()
  isCurrentlyIdle = false
  startIdleTracking()
}

/**
 * Reset behavior state (called when session changes)
 */
export function resetBehaviorState(): void {
  behaviorState = null
  stopIdleTracking()
  isCurrentlyIdle = false
}

/**
 * Increment tab switch count
 */
export function incrementTabSwitch(): void {
  if (behaviorState) {
    behaviorState.tabSwitchCount++
  }
  recordActivity()
}

/**
 * Update scroll depth if new bucket is deeper than current max
 */
export function updateScrollDepth(bucket: ScrollDepthBucket): void {
  if (!behaviorState) return

  const depthOrder: ScrollDepthBucket[] = ["top", "middle", "bottom"]
  const currentIndex = depthOrder.indexOf(behaviorState.scroll.maxDepthBucket)
  const newIndex = depthOrder.indexOf(bucket)

  if (newIndex > currentIndex) {
    behaviorState.scroll.maxDepthBucket = bucket
  }
  recordActivity()
}

/**
 * Increment scroll burst count
 */
export function incrementScrollBurst(): void {
  if (behaviorState) {
    behaviorState.scroll.burstCount++
  }
  recordActivity()
}

/**
 * Get current behavior state (read-only)
 */
export function getBehaviorState(): EphemeralBehaviorState | undefined {
  return behaviorState ? { ...behaviorState } : undefined
}

/**
 * Record user activity (resets idle timer)
 */
function recordActivity(): void {
  lastActivityTime = Date.now()
  
  // If was idle, record transition back to active
  if (isCurrentlyIdle && behaviorState) {
    behaviorState.idleTransitions++
    isCurrentlyIdle = false
  }
}

/**
 * Start idle detection timer
 */
function startIdleTracking(): void {
  stopIdleTracking()
  
  idleTimer = setInterval(() => {
    const timeSinceActivity = Date.now() - lastActivityTime
    
    if (timeSinceActivity > IDLE_TIMEOUT_MS && !isCurrentlyIdle) {
      // Transitioned to idle
      isCurrentlyIdle = true
    }
  }, 5000) // Check every 5 seconds
}

/**
 * Stop idle detection timer
 */
function stopIdleTracking(): void {
  if (idleTimer) {
    clearInterval(idleTimer)
    idleTimer = null
  }
}

/**
 * Check if session ID changed and reset if needed
 */
export function checkSessionChange(newSessionId: string): void {
  if (!behaviorState || behaviorState.sessionId !== newSessionId) {
    initBehaviorTracking(newSessionId)
  }
}

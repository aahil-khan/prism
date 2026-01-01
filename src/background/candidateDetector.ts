/**
 * Real-time incremental project detection.
 * Runs on every page visit to update project candidates.
 */

import type { Session } from "~/types/session"
import type { PageEvent } from "~/types/page-event"
import type { ProjectCandidate, CANDIDATE_THRESHOLDS } from "~/types/project-candidate"
import { extractResourceIdentifier, type ResourceIdentifier } from "~/lib/resource-extractor"


// Dev mode flag - set to true to use lower thresholds for faster testing
const DEV_MODE = false // Set to true to test with lower thresholds

// There are tunable thresholds for candidate qualification
const THRESHOLDS = DEV_MODE ? {
  MIN_VISITS: 1,        // Lower for testing
  MIN_SESSIONS: 1,      // Lower for testing
  MIN_SCORE: 40,        // Lower for testing (easier to reach)
  MAX_AGE_DAYS: 7,
  MIN_DURATION_HOURS: 0, // Lower for testing
} : {
  MIN_VISITS: 3,        // Production
  MIN_SESSIONS: 2,      // Production
  MIN_SCORE: 50,        // Production //changed from 60 to 50 
  MAX_AGE_DAYS: 7,
  MIN_DURATION_HOURS: 1, // Production
}

const STORAGE_KEY = "aegis-project-candidates"

/**
 * Load all project candidates from storage
 */
export async function loadCandidates(): Promise<ProjectCandidate[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return result[STORAGE_KEY] || []
}

/**
 * Save project candidates to storage
 */
export async function saveCandidates(candidates: ProjectCandidate[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: candidates })
}

/**
 * Check if a page visit should update or create a candidate.
 * Returns the candidate that should trigger a notification (if any).
 */
export async function checkPageForCandidate(
  page: PageEvent,
  sessionId: string,
  allSessions: Session[]
): Promise<ProjectCandidate | null> {
  // Extract resource from page
  const resource = extractResourceIdentifier(page.url)
  console.log("[ProjectDetection] Checking page:", page.url, "Resource:", resource)

  // Load existing candidates
  const candidates = await loadCandidates()
  
  // Clean up expired candidates
  const now = Date.now()
  const maxAge = THRESHOLDS.MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  const activeCandidates = candidates.filter(c => 
    c.status !== 'dismissed' && (now - c.lastSeen) < maxAge
  )

  // Find existing candidate for this SPECIFIC resource (not domain-level)
  // This allows multiple projects per domain (e.g., github.com/repo-a and github.com/repo-b)
  let candidate = activeCandidates.find(c => 
    c.specificResources.includes(resource.identifier)
  )

  // Skip homepage/category resources - only track specific/deep resources
  if (resource.specificity === "homepage" || resource.specificity === "category") {
    console.log("[ProjectDetection] Skipping homepage/category resource")
    return null
  }

  if (candidate) {
    // Update existing candidate
    if (!candidate.specificResources.includes(resource.identifier)) {
      candidate.specificResources.push(resource.identifier)
    }
    if (!candidate.sessionIds.includes(sessionId)) {
      candidate.sessionIds.push(sessionId)
    }
    candidate.visitCount++
    candidate.lastSeen = now
    
    // Extract keyword from page title
    if (page.title) {
      const words = page.title.toLowerCase().split(/\s+/)
        .filter(w => w.length > 3 && !isStopWord(w))
      words.forEach(word => {
        if (!candidate!.keywords.includes(word)) {
          candidate!.keywords.push(word)
        }
      })
    }

    // Recalculate score
    candidate.score = calculateCandidateScore(candidate)

    // Update status - account for snooze count (each snooze requires 2 more visits)
    const snoozeBonus = (candidate.snoozeCount || 0) * 2
    const effectiveVisitThreshold = THRESHOLDS.MIN_VISITS + snoozeBonus
    
    if (candidate.score >= THRESHOLDS.MIN_SCORE && 
        candidate.visitCount >= effectiveVisitThreshold &&
        candidate.status === 'watching' &&
        !candidate.notificationShown) {
      candidate.status = 'ready'
    }
  } else {
    // Create new candidate
    candidate = {
      id: `candidate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      primaryDomain: resource.domain,
      specificResources: [resource.identifier],
      sessionIds: [sessionId],
      visitCount: 1,
      firstSeen: now,
      lastSeen: now,
      keywords: page.title ? extractKeywordsFromTitle(page.title) : [],
      relatedDomains: [resource.domain],
      score: 0,
      status: 'watching',
      notificationShown: false,
      notificationHistory: []
    }
    candidate.score = calculateCandidateScore(candidate)
  }

  // Save updated candidates
  const otherCandidates = activeCandidates.filter(c => c.id !== candidate!.id)
  await saveCandidates([...otherCandidates, candidate])

  // Return candidate if ready to notify
  // Check: (1) status is ready, (2) not already notified in this session
  const alreadyNotifiedInSession = candidate.notificationHistory?.some(
    h => h.sessionId === sessionId && h.action === 'shown'
  )
  
  console.log("[ProjectDetection] Candidate status:", candidate.status, "Score:", candidate.score, "Already notified in session:", alreadyNotifiedInSession)
  if (candidate.status === 'ready' && !candidate.notificationShown && !alreadyNotifiedInSession) {
    console.log("[ProjectDetection] ✅ Ready to notify!")
    return candidate
  }

  console.log("[ProjectDetection] Not ready yet (status must be 'ready', currently:", candidate.status + ")")
  return null
}

/**
 * Calculate confidence score for a candidate (0-100)
 * Uses square root scaling to reward early visits more generously
 * Returns both total score and breakdown for visualization
 */
function calculateCandidateScore(candidate: ProjectCandidate): number {
  // Visit frequency (40 points max)
  // Uses sqrt scaling: 3 visits = 22pts, 5 visits = 28pts, 10 visits = 40pts
  const visitRatio = Math.min(1, candidate.visitCount / 10)
  const visitScore = Math.sqrt(visitRatio) * 40

  // Session consistency (30 points max)
  // Uses sqrt scaling: 2 sessions = 19pts, 3 sessions = 23pts, 5 sessions = 30pts
  const sessionRatio = Math.min(1, candidate.sessionIds.length / 5)
  const sessionScore = Math.sqrt(sessionRatio) * 30

  // Resource specificity (20 points max)
  // Uses sqrt scaling: 1 resource = 11.5pts, 2 resources = 16pts, 3 resources = 20pts
  const resourceRatio = Math.min(1, candidate.specificResources.length / 3)
  const resourceScore = Math.sqrt(resourceRatio) * 20

  // Time span (10 points max)
  // Linear: 1 hour = 0.4pts, 6 hours = 2.5pts, 24 hours = 10pts
  const duration = candidate.lastSeen - candidate.firstSeen
  const hoursDuration = duration / (1000 * 60 * 60)
  const timeScore = Math.min(10, (hoursDuration / 24) * 10)

  const totalScore = visitScore + sessionScore + resourceScore + timeScore
  
  // Store breakdown in candidate for later use
  candidate.scoreBreakdown = {
    visits: Math.round(visitScore),
    sessions: Math.round(sessionScore),
    resources: Math.round(resourceScore),
    timeSpan: Math.round(timeScore),
    total: Math.round(totalScore)
  }
  
  return Math.round(totalScore)
}

/**
 * Extract keywords from page title
 */
function extractKeywordsFromTitle(title: string): string[] {
  return title
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3 && !isStopWord(w))
    .slice(0, 5)
}

/**
 * Stop words to filter out
 */
function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'been',
    'will', 'your', 'what', 'when', 'where', 'which', 'their', 'there',
    'would', 'could', 'should', 'about', 'other', 'more', 'than', 'into'
  ])
  return stopWords.has(word)
}

/**
 * Mark candidate as dismissed (user said no)
 */
export async function dismissCandidate(candidateId: string): Promise<void> {
  const candidates = await loadCandidates()
  const candidate = candidates.find(c => c.id === candidateId)
  if (candidate) {
    candidate.status = 'dismissed'
    await saveCandidates(candidates)
  }
}

/**
 * Mark candidate as notified
 */
export async function markCandidateNotified(candidateId: string, sessionId: string): Promise<void> {
  const candidates = await loadCandidates()
  const candidate = candidates.find(c => c.id === candidateId)
  if (candidate) {
    candidate.notificationShown = true // Keep legacy flag for backwards compatibility
    
    // Add to notification history
    if (!candidate.notificationHistory) {
      candidate.notificationHistory = []
    }
    candidate.notificationHistory.push({
      sessionId,
      timestamp: Date.now(),
      action: 'shown'
    })
    
    await saveCandidates(candidates)
  }
}

/**
 * Promote candidate to full project
 */
export async function promoteCandidateToProject(candidateId: string): Promise<void> {
  const candidates = await loadCandidates()
  const updatedCandidates = candidates.filter(c => c.id !== candidateId)
  await saveCandidates(updatedCandidates)
}

/**
 * Get all ready candidates (for UI display)
 */
export async function getReadyCandidates(): Promise<ProjectCandidate[]> {
  const candidates = await loadCandidates()
  return candidates.filter(c => c.status === 'ready' && !c.notificationShown)
}

/**
 * DEV HELPER: Create a test candidate for rapid testing
 * Bypasses the waiting for multiple sessions/visits
 * Defaults to one less visit than needed so manual visit will trigger notification
 */
export async function createTestCandidate(
  domain: string,
  keywords: string[],
  visitCount: number = THRESHOLDS.MIN_VISITS,
  score: number = 50
): Promise<ProjectCandidate> {
  const now = Date.now()
  const candidate: ProjectCandidate = {
    id: `test-candidate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    primaryDomain: domain,
    specificResources: [`https://${domain}/test-resource-1`, `https://${domain}/test-resource-2`],
    sessionIds: ["test-session-1", "test-session-2"],
    visitCount,
    firstSeen: now - 2 * 60 * 60 * 1000, // 2 hours ago
    lastSeen: now,
    keywords,
    relatedDomains: [domain],
    status: 'watching',
    notificationShown: false,
    score: Math.min(100, Math.max(0, score))
  }

  const candidates = await loadCandidates()
  candidates.push(candidate)
  await saveCandidates(candidates)

  console.log("[TestHelper] Created test candidate with", visitCount, "visits:", candidate)
  return candidate
}

/**
 * DEV HELPER: Clear all candidates (for clean testing)
 */
export async function clearAllCandidates(): Promise<void> {
  await saveCandidates([])
  console.log("[TestHelper] Cleared all candidates")
}

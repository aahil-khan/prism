/**
 * A ProjectCandidate represents a potential project that's being tracked
 * in real-time as the user browses. When confidence reaches threshold,
 * we notify the user to confirm if it should become a full Project.
 */
export interface ProjectCandidate {
  id: string
  
  // Core identification
  primaryDomain: string
  specificResources: string[] // Specific URLs visited multiple times
  
  // Tracking data
  sessionIds: string[]
  visitCount: number // Total visits to specific resources
  firstSeen: number // Timestamp
  lastSeen: number // Timestamp
  
  // Metadata
  keywords: string[] // Extracted from page titles
  relatedDomains: string[] // Other domains visited in same sessions
  
  // Confidence scoring (0-100)
  score: number
  
  // State
  status: 'watching' | 'ready' | 'dismissed' // ready = ready to notify
  notificationShown: boolean
  snoozeCount?: number // Number of times user clicked "Not Now" - requires 2-3 more visits per snooze
}

/**
 * Thresholds for promoting candidates
 */
export const CANDIDATE_THRESHOLDS = {
  MIN_VISITS: 3, // Visit specific resource at least 3 times
  MIN_SESSIONS: 2, // Across at least 2 sessions
  MIN_SCORE: 60, // Confidence score threshold to notify
  MAX_AGE_DAYS: 7, // Expire old candidates after 7 days
  MIN_DURATION_HOURS: 1, // Minimum time span between first and last visit
}

/**
 * Page-level derived metrics within a session
 */
export type DerivedPageMetrics = {
  dwellTimeMs?: number
  positionInSession: number
  isEntryPage: boolean
  isExitPage: boolean
  revisitCount: number
}

/**
 * Session-level derived metrics
 */
export type DerivedSessionMetrics = {
  sessionDurationMs: number
  pageCount: number
  uniqueDomainCount: number
  foregroundRatio?: number
}

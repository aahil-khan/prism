import type { Session } from "~/types/session"
import type { DerivedPageMetrics, DerivedSessionMetrics } from "./types"

const MAX_DWELL_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Compute page-level derived metrics for all pages in a session
 */
export function derivePageMetrics(session: Session): DerivedPageMetrics[] {
  const { pages } = session
  if (pages.length === 0) return []

  return pages.map((page, index) => {
    // Compute dwell time: gap to next page, or cap at MAX_DWELL_MS for last page
    let dwellTimeMs: number | undefined
    if (index < pages.length - 1) {
      dwellTimeMs = pages[index + 1].timestamp - page.timestamp
    } else {
      // Last page: cap at MAX_DWELL_MS
      dwellTimeMs = MAX_DWELL_MS
    }

    // Position in session: normalized to [0, 1]
    const positionInSession = pages.length === 1 ? 0 : index / (pages.length - 1)

    // Entry page: first page in session
    const isEntryPage = index === 0

    // Exit page: last page in session
    const isExitPage = index === pages.length - 1

    // Revisit count: count of same URL before this index
    const revisitCount = pages.slice(0, index).filter((p) => p.url === page.url).length

    return {
      dwellTimeMs,
      positionInSession,
      isEntryPage,
      isExitPage,
      revisitCount
    }
  })
}

/**
 * Compute session-level derived metrics
 */
export function deriveSessionMetrics(session: Session): DerivedSessionMetrics {
  const { startTime, endTime, pages } = session

  // Session duration
  const sessionDurationMs = endTime - startTime

  // Page count
  const pageCount = pages.length

  // Unique domain count
  const uniqueDomains = new Set(pages.map((p) => p.domain))
  const uniqueDomainCount = uniqueDomains.size

  // Foreground ratio: only compute if at least one page has wasForeground
  let foregroundRatio: number | undefined
  const pagesWithForeground = pages.filter((p) => p.wasForeground !== undefined)
  if (pagesWithForeground.length > 0) {
    const foregroundPages = pagesWithForeground.filter((p) => p.wasForeground === true).length
    foregroundRatio = foregroundPages / pageCount
  }

  return {
    sessionDurationMs,
    pageCount,
    uniqueDomainCount,
    foregroundRatio
  }
}

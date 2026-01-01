import type { PageEvent } from "~/types/page-event"

/**
 * Resource specificity levels determine how meaningful a URL is as a project signal
 */
export type ResourceSpecificity = 'homepage' | 'category' | 'specific' | 'deep'

/**
 * A resource identifier represents a specific content/page that can be tracked across sessions
 */
export type ResourceIdentifier = {
  domain: string          // e.g., "github.com", "youtube.com"
  specificity: ResourceSpecificity
  identifier: string      // Unique identifier for the resource
  visitCount: number
  firstVisit: number      // Timestamp
  lastVisit: number       // Timestamp
  sessionIds: Set<string> // Sessions that visited this resource
  pageEvents: PageEvent[] // All page events for this resource
}

/**
 * Extract a unique resource identifier from a URL using universal patterns
 * Works for ANY site without hardcoding specific domains
 */
export function extractResourceIdentifier(url: string): {
  domain: string
  specificity: ResourceSpecificity
  identifier: string
} | null {
  try {
    const urlObj = new URL(url)
    const domain = urlObj.hostname.replace(/^www\./, '')
    const path = urlObj.pathname
    const params = urlObj.searchParams

    // HOMEPAGE: Just domain root, no meaningful path
    if (path === '/' || path === '' || path === '/index.html') {
      return { domain, specificity: 'homepage', identifier: `${domain}/` }
    }

    // Split path into segments
    const pathSegments = path.split('/').filter(Boolean)

    // CATEGORY: Single path segment (e.g., youtube.com/trending, github.com/explore)
    if (pathSegments.length === 1) {
      return {
        domain,
        specificity: 'category',
        identifier: `${domain}/${pathSegments[0]}`
      }
    }

    // SPECIFIC: Look for query params with meaningful IDs first
    const idParams = ['v', 'id', 'q', 'p', 'post', 'article', 'list', 'playlist']
    const meaningfulParam = idParams.find(p => params.has(p))

    if (meaningfulParam) {
      const paramValue = params.get(meaningfulParam)
      // Use first path segment + param for identifier
      const firstSegment = pathSegments[0] || 'page'
      return {
        domain,
        specificity: 'specific',
        identifier: `${domain}/${firstSegment}?${meaningfulParam}=${paramValue}`
      }
    }

    // DEEP: 4+ path segments indicates very specific content
    if (pathSegments.length >= 4) {
      const keyPath = pathSegments.slice(0, 4).join('/')
      return {
        domain,
        specificity: 'deep',
        identifier: `${domain}/${keyPath}`
      }
    }

    // SPECIFIC: 2-3 path segments
    if (pathSegments.length >= 2) {
      const keyPath = pathSegments.slice(0, 3).join('/')
      return {
        domain,
        specificity: 'specific',
        identifier: `${domain}/${keyPath}`
      }
    }

    // Default: treat as category
    return {
      domain,
      specificity: 'category',
      identifier: `${domain}${path}`
    }
  } catch (error) {
    // Invalid URL
    return null
  }
}

/**
 * Build a map of resources from page events
 * Groups identical resources and tracks visit patterns
 */
export function buildResourceMap(pageEvents: PageEvent[], sessionId: string): Map<string, ResourceIdentifier> {
  const resourceMap = new Map<string, ResourceIdentifier>()

  pageEvents.forEach(page => {
    const extracted = extractResourceIdentifier(page.url)
    if (!extracted) return

    const { identifier, domain, specificity } = extracted

    if (resourceMap.has(identifier)) {
      // Update existing resource
      const resource = resourceMap.get(identifier)!
      resource.visitCount++
      resource.lastVisit = Math.max(resource.lastVisit, page.timestamp)
      resource.sessionIds.add(sessionId)
      resource.pageEvents.push(page)
    } else {
      // Create new resource
      resourceMap.set(identifier, {
        domain,
        specificity,
        identifier,
        visitCount: 1,
        firstVisit: page.timestamp,
        lastVisit: page.timestamp,
        sessionIds: new Set([sessionId]),
        pageEvents: [page]
      })
    }
  })

  return resourceMap
}

/**
 * Aggregate resources across multiple sessions
 */
export function aggregateResourcesAcrossSessions(
  sessions: Array<{ id: string; pages: PageEvent[] }>
): ResourceIdentifier[] {
  const globalResourceMap = new Map<string, ResourceIdentifier>()

  sessions.forEach(session => {
    const sessionResources = buildResourceMap(session.pages, session.id)

    sessionResources.forEach((resource, identifier) => {
      if (globalResourceMap.has(identifier)) {
        // Merge with existing
        const existing = globalResourceMap.get(identifier)!
        existing.visitCount += resource.visitCount
        existing.firstVisit = Math.min(existing.firstVisit, resource.firstVisit)
        existing.lastVisit = Math.max(existing.lastVisit, resource.lastVisit)
        resource.sessionIds.forEach(sid => existing.sessionIds.add(sid))
        existing.pageEvents.push(...resource.pageEvents)
      } else {
        // Add new
        globalResourceMap.set(identifier, resource)
      }
    })
  })

  return Array.from(globalResourceMap.values())
}

/**
 * Filter resources that are meaningful for project detection
 * Excludes:
 * - Homepage visits (too generic)
 * - Single-visit resources (not enough signal)
 * - Resources visited in only one session (no cross-session pattern)
 */
export function filterMeaningfulResources(
  resources: ResourceIdentifier[],
  minVisits: number = 2,
  minSessions: number = 2
): ResourceIdentifier[] {
  return resources.filter(resource => {
    // Exclude homepages
    if (resource.specificity === 'homepage') return false

    // Must be visited minimum number of times
    if (resource.visitCount < minVisits) return false

    // Must appear in minimum number of sessions
    if (resource.sessionIds.size < minSessions) return false

    return true
  })
}

/**
 * Check if a resource is routine/habitual (visited very frequently)
 * Routine resources (like daily email checks) should not be project signals
 */
export function isRoutineResource(resource: ResourceIdentifier): boolean {
  const durationMs = resource.lastVisit - resource.firstVisit
  const durationDays = durationMs / (24 * 60 * 60 * 1000)

  // If duration is less than 1 day, can't determine routine
  if (durationDays < 1) return false

  const visitsPerDay = resource.visitCount / durationDays

  // More than 10 visits per day = routine (email, social media checks, etc.)
  return visitsPerDay > 10
}

import type { Session } from "~/types/session"
import type { PageContext } from "~/lib/context-classifier"

/**
 * Learning system that maps domains to contexts based on user labeling behavior
 * This allows the system to improve context classification over time
 */

// Map of domain → label name associations (learned from user behavior)
const domainToLabelMap = new Map<string, Map<string, number>>()

// Storage key for persisting learned associations
const STORAGE_KEY = "aegis-context-learning"

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname
    // Remove www prefix
    return hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * Load learned associations from storage
 */
export async function loadLearnedAssociations(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY)
    if (result[STORAGE_KEY]) {
      const data = JSON.parse(result[STORAGE_KEY])
      // Reconstruct the nested Map structure
      Object.entries(data).forEach(([domain, labels]) => {
        domainToLabelMap.set(domain, new Map(Object.entries(labels as Record<string, number>)))
      })
    }
  } catch (error) {
    console.error("Failed to load learned associations:", error)
  }
}

/**
 * Save learned associations to storage
 */
async function saveLearnedAssociations(): Promise<void> {
  try {
    // Convert nested Map to plain object for JSON serialization
    const data: Record<string, Record<string, number>> = {}
    domainToLabelMap.forEach((labels, domain) => {
      data[domain] = Object.fromEntries(labels)
    })
    await chrome.storage.local.set({ [STORAGE_KEY]: JSON.stringify(data) })
  } catch (error) {
    console.error("Failed to save learned associations:", error)
  }
}

/**
 * Learn from user's labeling behavior
 * Call this whenever a user assigns a label to a session
 */
export async function learnFromSession(session: Session, labelName: string): Promise<void> {
  if (!labelName || !session.pages.length) return

  // Extract all unique domains from the session
  const domains = new Set(
    session.pages
      .map(page => extractDomain(page.url))
      .filter(domain => domain !== '')
  )

  // Increment association count for each domain → label pair
  domains.forEach(domain => {
    if (!domainToLabelMap.has(domain)) {
      domainToLabelMap.set(domain, new Map())
    }
    const labelCounts = domainToLabelMap.get(domain)!
    labelCounts.set(labelName, (labelCounts.get(labelName) || 0) + 1)
  })

  // Persist the updated associations
  await saveLearnedAssociations()
}

/**
 * Predict label for a domain based on learned associations
 * Returns the most frequently associated label, or null if no associations exist
 */
export function predictLabelForDomain(domain: string): string | null {
  const cleanDomain = domain.replace(/^www\./, '')
  const labelCounts = domainToLabelMap.get(cleanDomain)
  
  if (!labelCounts || labelCounts.size === 0) {
    return null
  }

  // Find the label with the highest count
  let maxLabel: string | null = null
  let maxCount = 0

  labelCounts.forEach((count, label) => {
    if (count > maxCount) {
      maxCount = count
      maxLabel = label
    }
  })

  return maxLabel
}

/**
 * Get predicted context based on learned associations for a URL
 */
export function getLearnedContext(url: string): string | null {
  const domain = extractDomain(url)
  return predictLabelForDomain(domain)
}

/**
 * Get statistics about learned associations (for debugging/insights)
 */
export function getLearnedStats(): {
  totalDomains: number
  totalAssociations: number
  topDomains: Array<{ domain: string; label: string; count: number }>
} {
  let totalAssociations = 0
  const domainStats: Array<{ domain: string; label: string; count: number }> = []

  domainToLabelMap.forEach((labels, domain) => {
    labels.forEach((count, label) => {
      totalAssociations += count
      domainStats.push({ domain, label, count })
    })
  })

  // Sort by count descending and take top 20
  const topDomains = domainStats
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  return {
    totalDomains: domainToLabelMap.size,
    totalAssociations,
    topDomains
  }
}

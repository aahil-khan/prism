/**
 * Suggests adding current site to existing projects based on similarity
 */

import type { PageEvent } from "~/types/page-event"
import type { Project } from "~/types/project"
import { loadProjects } from "./projectManager"

const SUGGESTION_THRESHOLD = 0.7 // 70% similarity required (conservative - false positives are annoying)
const DISMISSAL_COOLDOWN = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Normalize URL for comparison (remove protocol, trailing slash, query params)
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
    return urlObj.hostname + urlObj.pathname.replace(/\/$/, '')
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '').split('?')[0]
  }
}

/**
 * Check if URL is too generic to suggest (profile pages, org pages, etc.)
 */
function isGenericPage(url: string): boolean {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
    const pathParts = urlObj.pathname.split('/').filter(Boolean)
    
    // GitHub: Skip if not a repo page (profiles, orgs, explore, etc.)
    if (urlObj.hostname.includes('github.com')) {
      // Need at least owner/repo structure (2 parts)
      if (pathParts.length < 2) return true
      
      // Skip GitHub meta pages
      const genericPages = ['explore', 'trending', 'topics', 'collections', 'events', 'sponsors']
      if (genericPages.includes(pathParts[0])) return true
    }
    
    // Skip homepage/root paths
    if (pathParts.length === 0) return true
    
    return false
  } catch {
    return false
  }
}

/**
 * Check if current page is related to any existing projects
 * Returns project suggestion if similarity is high enough
 */
export async function checkForProjectSuggestion(
  page: PageEvent,
  currentUrl: string
): Promise<{ project: Project; score: number } | null> {
  const projects = await loadProjects()
  
  // Filter to active projects only
  const activeProjects = projects.filter(p => p.status === 'active')
  if (activeProjects.length === 0) return null
  
  const normalizedCurrentUrl = normalizeUrl(currentUrl)
  
  // Skip generic pages (profile pages, org pages, homepages)
  if (isGenericPage(currentUrl)) {
    console.log("[ProjectSuggestion] Skipping generic page:", currentUrl)
    return null
  }
  
  // Check if current URL is already in any project
  const alreadyAdded = activeProjects.some(p => 
    p.sites.some(s => normalizeUrl(s.url) === normalizedCurrentUrl)
  )
  if (alreadyAdded) {
    console.log("[ProjectSuggestion] URL already in a project, skipping")
    return null
  }
  
  // Check if user recently dismissed this URL for any project
  const now = Date.now()
  const recentlyDismissed = activeProjects.some(p => 
    p.dismissedSuggestions?.some(d => 
      normalizeUrl(d.url) === normalizedCurrentUrl &&
      (now - d.timestamp) < DISMISSAL_COOLDOWN
    )
  )
  if (recentlyDismissed) {
    console.log("[ProjectSuggestion] URL recently dismissed, skipping")
    return null
  }
  
  // Calculate similarity scores for each project
  const suggestions = activeProjects.map(project => ({
    project,
    score: calculateSimilarity(page, project)
  }))
  
  // Get highest scoring project
  const bestMatch = suggestions.reduce((best, curr) => 
    curr.score > best.score ? curr : best
  )
  
  // Return if above threshold
  if (bestMatch.score >= SUGGESTION_THRESHOLD) {
    return bestMatch
  }
  
  return null
}

/**
 * Calculate similarity between page and project (0-1)
 * Conservative scoring - false positives are more annoying than false negatives
 */
function calculateSimilarity(page: PageEvent, project: Project): number {
  let score = 0
  
  // Factor 1: Domain + Path similarity (30% weight)
  const pageDomain = new URL(page.url).hostname.replace('www.', '')
  const pageUrl = new URL(page.url)
  
  // Special case: GitHub repos MUST match exact repo path
  if (pageDomain === 'github.com') {
    const pagePathParts = pageUrl.pathname.split('/').filter(Boolean)
    if (pagePathParts.length < 2) {
      // Not a repo page (profile, org, etc.) - give 0 score
      console.log("[ProjectSuggestion] GitHub page not a repo, skipping")
      return 0
    }
    
    const pageRepo = pagePathParts.slice(0, 2).join('/') // Extract owner/repo
    const projectRepos = project.sites
      .filter(s => s.url.includes('github.com'))
      .map(s => {
        try {
          const url = new URL(s.url.startsWith('http') ? s.url : `https://${s.url}`)
          const parts = url.pathname.split('/').filter(Boolean)
          return parts.slice(0, 2).join('/') // Extract owner/repo
        } catch {
          return ''
        }
      })
    
    // Must be exact same repo
    if (projectRepos.includes(pageRepo)) {
      score += 0.3
    } else {
      // Different repo on GitHub = 0 score, don't suggest
      console.log("[ProjectSuggestion] Different GitHub repo, returning 0")
      return 0
    }
  } else {
    // For non-GitHub, domain match gives partial credit
    const projectDomains = project.sites.map(s => {
      try {
        return new URL(s.url.startsWith('http') ? s.url : `https://${s.url}`).hostname.replace('www.', '')
      } catch {
        return s.url.split('/')[0]
      }
    })
    
    if (projectDomains.includes(pageDomain)) {
      score += 0.3
    }
  }
  
  // Factor 2: Keyword overlap (40% weight) - must have strong keyword match
  const pageWords = extractWords(page.title || '')
  const projectWords = new Set([
    ...project.keywords,
    ...project.sites.flatMap(s => extractWords(s.title))
  ])
  
  // Require at least 2 matching keywords for non-zero score
  const overlap = pageWords.filter(w => projectWords.has(w)).length
  if (overlap < 2) {
    console.log("[ProjectSuggestion] Less than 2 keyword matches, returning 0")
    return 0
  }
  
  const keywordScore = pageWords.length > 0 
    ? Math.min(1, overlap / Math.min(pageWords.length, 3)) 
    : 0
  score += keywordScore * 0.4
  
  // Factor 3: URL path similarity (30% weight)
  // Must have at least one keyword in URL
  const urlLower = page.url.toLowerCase()
  const matchingKeywords = project.keywords.filter(k => 
    urlLower.includes(k.toLowerCase())
  ).length
  
  if (matchingKeywords === 0) {
    console.log("[ProjectSuggestion] No keywords in URL, returning 0")
    return 0
  }
  
  const pathScore = project.keywords.length > 0
    ? matchingKeywords / project.keywords.length
    : 0
  score += pathScore * 0.3
  
  console.log("[ProjectSuggestion] Final score:", score, "for", page.url)
  return score
}

/**
 * Extract significant words from text
 */
function extractWords(text: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can'])
  
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
}

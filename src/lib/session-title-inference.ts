import type { Session } from "~/types/session"

// Common stopwords to filter out from keyword extraction
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further',
  'then', 'once', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'would',
  'could', 'ought', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'what', 'which', 'who', 'when', 'where', 'why', 'how',
  'html', 'page', 'results', 'search', 'google', 'youtube', 'reddit',
])

/**
 * Clean domain name for display
 * Example: "www.github.com" -> "GitHub"
 */
function cleanDomain(hostname: string): string {
  let domain = hostname.replace(/^www\./, '')
  
  // Special case mappings for popular domains
  const specialNames: Record<string, string> = {
    'github.com': 'GitHub',
    'stackoverflow.com': 'Stack Overflow',
    'wikipedia.org': 'Wikipedia',
    'medium.com': 'Medium',
    'dev.to': 'Dev.to',
    'hashnode.com': 'Hashnode',
    'twitter.com': 'Twitter',
    'x.com': 'X',
    'linkedin.com': 'LinkedIn',
    'facebook.com': 'Facebook',
    'instagram.com': 'Instagram',
  }
  
  if (specialNames[hostname] || specialNames[domain]) {
    return specialNames[hostname] || specialNames[domain]
  }
  
  // Capitalize first letter of domain
  return domain.charAt(0).toUpperCase() + domain.slice(1).split('.')[0]
}

/**
 * Tier 1: Domain-based clustering
 * If multiple pages are from the same domain, use domain as title
 */
function inferFromDomainClustering(session: Session): string | null {
  const domains = session.pages.map((p) => {
    try {
      return new URL(p.url).hostname
    } catch {
      return null
    }
  }).filter((d): d is string => d !== null)

  const domainCounts = domains.reduce((acc, d) => {
    acc[d] = (acc[d] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const topDomain = Object.entries(domainCounts).sort((a, b) => b[1] - a[1])[0]

  // If top domain has 2+ pages, use it as title
  if (topDomain && topDomain[1] >= 2) {
    return `${cleanDomain(topDomain[0])} browsing`
  }

  return null
}

/**
 * Tier 2: Keyword extraction from titles
 * Extract common words appearing 2+ times across page titles
 */
function inferFromKeywords(session: Session): string | null {
  // Extract all words from page titles
  const words = session.pages
    .map((p) => p.title?.toLowerCase().split(/\s+|[-_]/) || [])
    .flat()
    .filter((w): w is string => {
      if (!w) return false
      // Filter: length > 3, not a stopword, not just numbers
      return w.length > 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w)
    })

  // Count word frequencies
  const wordCounts = words.reduce((acc, w) => {
    acc[w] = (acc[w] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Find words appearing 2+ times, sorted by frequency
  const topWords = Object.entries(wordCounts)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([word]) => word)

  if (topWords.length > 0) {
    // Capitalize first letter of each keyword
    const capitalizedWords = topWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    return capitalizedWords.join(' & ')
  }

  return null
}

/**
 * Tier 3: Fallback
 * Use first page title or default message
 */
function getFallbackTitle(session: Session): string {
  if (session.pages.length > 0) {
    const firstPageTitle = session.pages[0]?.title
    if (firstPageTitle) {
      // Truncate if too long
      return firstPageTitle.length > 50
        ? firstPageTitle.substring(0, 47) + '...'
        : firstPageTitle
    }
  }
  return 'Browsing session'
}

/**
 * Main inference function
 * Applies tiers in order: Domain Clustering → Keywords → Fallback
 */
export function inferSessionTitle(session: Session): string {
  // Tier 1: Domain clustering
  const domainTitle = inferFromDomainClustering(session)
  if (domainTitle) return domainTitle

  // Tier 2: Keyword extraction
  const keywordTitle = inferFromKeywords(session)
  if (keywordTitle) return keywordTitle

  // Tier 3: Fallback
  return getFallbackTitle(session)
}

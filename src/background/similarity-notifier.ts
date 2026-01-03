import type { PageEvent } from "~/types/page-event"
import { getSessions } from "./sessionManager"

// Common utility domains that shouldn't trigger notifications
const EXCLUDED_DOMAINS = new Set([
  'google.com', 'www.google.com',
  'google.co.uk', 'www.google.co.uk',
  'youtube.com', 'www.youtube.com',
  'reddit.com', 'www.reddit.com',
  'github.com', 'www.github.com',
  'stackoverflow.com', 'www.stackoverflow.com',
  'twitter.com', 'x.com',
  'facebook.com', 'www.facebook.com',
  'linkedin.com', 'www.linkedin.com',
  'wikipedia.org', 'www.wikipedia.org',
  'gmail.com', 'mail.google.com',
])

// Time-decay similarity parameters
const LAMBDA = 0.00115 // Decay rate (10-minute half-life)
const DECAY_THRESHOLD = 0.35 // Minimum decayed score to trigger
const WINDOW_MS = 20 * 60 * 1000 // 20-minute lookback window
const MAX_VISIT_COUNT_FOR_NOTIFICATION = 5
const COOLDOWN_MS = 5 * 60 * 1000 // 5-minute cooldown between notifications

// Recommended URL cache (prevents re-showing same pages)
const RECOMMENDED_URL_CACHE_KEY = "recommendedUrlCache"
const RECOMMENDED_CACHE_TTL = 6 * 60 * 60 * 1000 // 6 hours

function cosineSimilarity(vecA: number[] | undefined, vecB: number[] | undefined): number {
  if (!vecA || !vecB) return 0
  let sum = 0
  const len = Math.min(vecA.length, vecB.length)
  for (let i = 0; i < len; i++) {
    sum += vecA[i] * vecB[i]
  }
  return sum
}

// Calculate time-decayed similarity score
// Score = cosine_similarity * exp(-λ * time_delta_seconds)
function calculateDecayedScore(
  currentPage: PageEvent,
  candidatePage: PageEvent,
  now: number
): number {
  const rawSimilarity = cosineSimilarity(
    currentPage.titleEmbedding,
    candidatePage.titleEmbedding
  )
  
  const timeDeltaSeconds = (now - candidatePage.timestamp) / 1000
  const decayFactor = Math.exp(-LAMBDA * timeDeltaSeconds)
  
  return rawSimilarity * decayFactor
}

// Normalize URL to prevent duplicate detection of same content
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    
    // Remove common tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'ref', 'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid',
      '_ga', '_gl', 'source', 'campaign'
    ]
    trackingParams.forEach(param => parsed.searchParams.delete(param))
    
    // Remove hash fragments
    parsed.hash = ''
    
    // Remove trailing slash for consistency
    const normalized = parsed.toString().replace(/\/$/, '')
    return normalized
  } catch {
    return url
  }
}

// Validate embedding quality to prevent false matches
function isValidEmbedding(embedding: number[] | undefined): boolean {
  if (!embedding || embedding.length === 0) return false
  
  // Check for NaN or Infinity values
  if (embedding.some(v => !isFinite(v))) return false
  
  // Check for zero vector (failed embedding generation)
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0))
  if (norm < 0.01) return false
  
  return true
}

// Score title quality to filter generic/low-quality pages
function titleQualityScore(title: string): number {
  if (!title || title.length < 5) return 0
  
  // Filter out common low-quality titles
  const lowQualityPatterns = /^(home|untitled|404|error|loading|page not found|access denied)/i
  if (lowQualityPatterns.test(title.trim())) return 0
  
  // Count informative words
  const words = title.toLowerCase().split(/\s+/)
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'])
  const informativeWords = words.filter(w => !stopWords.has(w) && w.length > 2)
  
  if (informativeWords.length < 2) return 0.3
  if (informativeWords.length < 4) return 0.7
  return 1.0
}

// Calculate domain penalty to encourage diversity
function calculateDomainPenalty(url1: string, url2: string): number {
  try {
    const domain1 = new URL(url1).hostname.replace(/^www\./, '')
    const domain2 = new URL(url2).hostname.replace(/^www\./, '')
    
    // 15% penalty for same-domain recommendations
    return domain1 === domain2 ? 0.85 : 1.0
  } catch {
    return 1.0
  }
}

function isExcludedDomain(url: string): boolean {
  try {
    const domain = new URL(url).hostname.toLowerCase()
    return EXCLUDED_DOMAINS.has(domain)
  } catch {
    return false
  }
}

// Track last notification time for cooldown
let lastNotificationTime = 0

// In-memory cache for recently notified pairs (prevents race conditions)
const recentlyNotifiedCache = new Map<string, number>()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

// Clean expired entries from memory cache
function cleanCache() {
  const now = Date.now()
  for (const [key, timestamp] of recentlyNotifiedCache.entries()) {
    if (now - timestamp > CACHE_TTL_MS) {
      recentlyNotifiedCache.delete(key)
    }
  }
}

// Check if pair was recently notified (synchronous check for race condition prevention)
function isInMemoryCache(url1: string, url2: string): boolean {
  const key = [url1, url2].sort().join('|')
  return recentlyNotifiedCache.has(key)
}

// Add to memory cache immediately
function addToMemoryCache(url1: string, url2: string): void {
  const key = [url1, url2].sort().join('|')
  recentlyNotifiedCache.set(key, Date.now())
}

// Check if this URL pair was recently notified
async function wasRecentlyNotified(url1: string, url2: string): Promise<boolean> {
  // Check memory cache first (synchronous, prevents race conditions)
  if (isInMemoryCache(url1, url2)) {
    return true
  }
  
  try {
    const key = [url1, url2].sort().join('|')
    const result = await chrome.storage.local.get('notificationHistory')
    
    if (!result.notificationHistory) return false
    
    const history = result.notificationHistory
    const pairs = new Set(history.pairs || [])
    
    // Cleanup old entries if needed (older than 24 hours)
    const now = Date.now()
    if (history.lastCleanup && now - history.lastCleanup > 24 * 60 * 60 * 1000) {
      await chrome.storage.local.set({
        notificationHistory: { pairs: [], lastCleanup: now }
      })
      return false
    }
    
    return pairs.has(key)
  } catch (error) {
    console.error('[SimilarityNotifier] Error checking notification history:', error)
    return false
  }
}

// Add URLs to recommended cache (prevents re-showing them)
async function addToRecommendedCache(urls: string[]): Promise<void> {
  try {
    const result = await chrome.storage.local.get(RECOMMENDED_URL_CACHE_KEY)
    const cache = result[RECOMMENDED_URL_CACHE_KEY] || { urls: [], ts: Date.now() }
    
    const merged = new Set([...cache.urls, ...urls.map(normalizeUrl)])
    
    await chrome.storage.local.set({
      [RECOMMENDED_URL_CACHE_KEY]: {
        urls: Array.from(merged).slice(-300), // Keep last 300 URLs
        ts: Date.now()
      }
    })
  } catch (error) {
    console.error('[SimilarityNotifier] Error adding to recommended cache:', error)
  }
}

// Check if URL was previously recommended
async function wasPreviouslyRecommended(url: string): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(RECOMMENDED_URL_CACHE_KEY)
    const cache = result[RECOMMENDED_URL_CACHE_KEY]
    if (!cache) return false
    
    // Auto-expire old cache
    if (Date.now() - cache.ts > RECOMMENDED_CACHE_TTL) {
      await chrome.storage.local.remove(RECOMMENDED_URL_CACHE_KEY)
      return false
    }
    
    return new Set(cache.urls).has(normalizeUrl(url))
  } catch (error) {
    console.error('[SimilarityNotifier] Error checking recommended cache:', error)
    return false
  }
}

// Mark URL pair as notified to prevent duplicates
async function markAsNotified(url1: string, url2: string): Promise<void> {
  try {
    const key = [url1, url2].sort().join('|')
    const result = await chrome.storage.local.get('notificationHistory')
    
    const history = result.notificationHistory || { pairs: [], lastCleanup: Date.now() }
    const pairs = new Set(history.pairs || [])
    pairs.add(key)
    
    // Limit storage size (keep last 100 pairs)
    const pairsArray = Array.from(pairs)
    const limitedPairs = pairsArray.slice(-100)
    
    await chrome.storage.local.set({
      notificationHistory: {
        pairs: limitedPairs,
        lastCleanup: history.lastCleanup || Date.now()
      }
    })
  } catch (error) {
    console.error('[SimilarityNotifier] Error marking as notified:', error)
  }
}

// Mark all pairs in a batch (current + all similar pages) to prevent cascade notifications
async function markBatchAsNotified(currentUrl: string, similarUrls: string[]): Promise<void> {
  // Add to memory cache IMMEDIATELY (synchronous, prevents race conditions)
  for (const similarUrl of similarUrls) {
    addToMemoryCache(currentUrl, similarUrl)
  }
  
  // Mark similar → similar pairs
  for (let i = 0; i < similarUrls.length; i++) {
    for (let j = i + 1; j < similarUrls.length; j++) {
      addToMemoryCache(similarUrls[i], similarUrls[j])
    }
  }
  
  // Then persist to storage (async, can be slower)
  try {
    const result = await chrome.storage.local.get('notificationHistory')
    const history = result.notificationHistory || { pairs: [], lastCleanup: Date.now() }
    const pairs = new Set(history.pairs || [])
    
    // Mark current → each similar
    for (const similarUrl of similarUrls) {
      const key = [currentUrl, similarUrl].sort().join('|')
      pairs.add(key)
    }
    
    // CRITICAL: Mark similar → similar (prevent cascade when "Open all" is clicked)
    for (let i = 0; i < similarUrls.length; i++) {
      for (let j = i + 1; j < similarUrls.length; j++) {
        const key = [similarUrls[i], similarUrls[j]].sort().join('|')
        pairs.add(key)
      }
    }
    
    // Limit storage size
    const pairsArray = Array.from(pairs)
    const limitedPairs = pairsArray.slice(-150) // Increased from 100 to handle batch
    
    await chrome.storage.local.set({
      notificationHistory: {
        pairs: limitedPairs,
        lastCleanup: history.lastCleanup || Date.now()
      }
    })
    
    console.log(`[SimilarityNotifier] Marked ${similarUrls.length} pages + ${similarUrls.length * (similarUrls.length - 1) / 2} cross-pairs as notified`)
  } catch (error) {
    console.error('[SimilarityNotifier] Error marking batch as notified:', error)
  }
}

export async function checkAndNotifySimilarPages(currentPage: PageEvent, tabId?: number): Promise<void> {
  if (!currentPage.titleEmbedding) return

  console.log("checkAndNotifySimilarPages invoked for", currentPage.url, "tabId:", tabId)

  const now = Date.now()
  
  // Periodic cache cleanup
  if (Math.random() < 0.1) { // 10% chance to clean on each call
    cleanCache()
  }
  
  // Cooldown check: prevent notification spam
  if (now - lastNotificationTime < COOLDOWN_MS) {
    console.log(`⏸️ Cooldown active, skipping notification (${Math.round((COOLDOWN_MS - (now - lastNotificationTime)) / 1000)}s remaining)`)
    return
  }

  const sessions = getSessions()
  const allPages = sessions.flatMap((s) => s.pages)

  // Filter pages within temporal window
  // 1. Different URL than current page
  // 2. Has embedding
  // 3. Not from excluded domains
  // 4. Within lookback window (20 minutes)
  // 5. Visited less than 5 times (low visit count = more interesting)
  const candidatePages = allPages.filter((p) => {
    if (p.url === currentPage.url) return false
    if (!p.titleEmbedding) return false
    if (isExcludedDomain(p.url)) return false
    
    const pageAge = now - p.timestamp
    if (pageAge > WINDOW_MS) return false // Only within 20-minute window
    
    const visitCount = p.visitCount ?? 1
    if (visitCount >= MAX_VISIT_COUNT_FOR_NOTIFICATION) return false
    
    return true
  })

  // Calculate time-decayed similarity scores with smart filtering
  const similar = []
  
  for (const p of candidatePages) {
    // 🚫 Skip if already recommended earlier (prevents repeat suggestions)
    if (await wasPreviouslyRecommended(p.url)) {
      console.log(`  ⏭️  Skipping "${p.title}" - already recommended`)
      continue
    }
    
    // 🚫 Skip same-domain as current page (prevents ChatGPT → ChatGPT cascade)
    const domainPenalty = calculateDomainPenalty(currentPage.url, p.url)
    if (domainPenalty < 1.0) {
      console.log(`  ⏭️  Skipping "${p.title}" - same domain as current page`)
      continue
    }
    
    const score = calculateDecayedScore(currentPage, p, now)
    if (score >= DECAY_THRESHOLD) {
      similar.push({
        page: p,
        score,
        rawSimilarity: cosineSimilarity(currentPage.titleEmbedding, p.titleEmbedding),
        age: Math.round((now - p.timestamp) / 1000 / 60) // minutes
      })
    }
  }
  
  // Sort by score and take top 5
  similar.sort((a, b) => b.score - a.score)
  const topSimilar = similar.slice(0, 5)

  if (topSimilar.length === 0) {
    console.log(`No similar pages found for: ${currentPage.title}`)
    return
  }

  console.log(`Found ${topSimilar.length} similar pages for: ${currentPage.title}`)
  topSimilar.forEach(s => {
    console.log(`  - ${s.page.title} (score: ${s.score.toFixed(3)}, raw: ${s.rawSimilarity.toFixed(3)}, age: ${s.age}min)`)
  })

  // Update cooldown timestamp
  lastNotificationTime = now
  
  // Mark all pairs (including similar → similar) as notified to prevent cascade notifications
  const similarUrls = topSimilar.map(s => s.page.url)
  await markBatchAsNotified(currentPage.url, similarUrls)
  
  // 🎯 Add to recommended cache to prevent re-showing these URLs
  await addToRecommendedCache(similarUrls)

  try {
    // Prepare pages data
    const pages = topSimilar.map((r) => ({
      title: r.page.title || r.page.url,
      url: r.page.url,
    }))

    const notificationData = {
      timestamp: Date.now(),
      pages,
      count: pages.length,
    }

    // 1. Store in chrome.storage as persistent notification (fallback for cached sidepanel)
    await chrome.storage.local.set({ pendingNotification: notificationData })
    console.log("✅ Notification stored in storage")

    // 2. Try to send message to sidepanel directly (if open and active)
    chrome.runtime.sendMessage(
      {
        type: "similar-pages-found",
        pages,
      },
      () => {
        if (chrome.runtime.lastError) {
          console.warn("Direct message to sidepanel failed, using storage fallback:", chrome.runtime.lastError.message)
        } else {
          console.log("✅ Notification sent to sidepanel via message")
        }
      }
    )

    // 3. Send message to indicator hub content script
    if (tabId) {
      chrome.tabs.sendMessage(
        tabId,
        {
          type: "SHOW_SIMILAR_PAGES",
          payload: notificationData,
        },
        () => {
          if (chrome.runtime.lastError) {
            console.warn("Could not send message to indicator hub:", chrome.runtime.lastError.message)
          } else {
            console.log("✅ Notification sent to indicator hub on tab", tabId)
          }
        }
      )
    } else {
      console.warn("No tab ID provided, cannot send notification to indicator")
    }
  } catch (error) {
    console.error('[SimilarityNotifier] Failed to send notification:', error)
    // Graceful degradation - don't block page load
  }
}


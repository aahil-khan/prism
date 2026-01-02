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

const ONE_HOUR_MS = 60 * 60 * 1000
const MAX_VISIT_COUNT_FOR_NOTIFICATION = 5

function cosineSimilarity(vecA: number[] | undefined, vecB: number[] | undefined): number {
  if (!vecA || !vecB) return 0
  let sum = 0
  const len = Math.min(vecA.length, vecB.length)
  for (let i = 0; i < len; i++) {
    sum += vecA[i] * vecB[i]
  }
  return sum
}

function isExcludedDomain(url: string): boolean {
  try {
    const domain = new URL(url).hostname.toLowerCase()
    return EXCLUDED_DOMAINS.has(domain)
  } catch {
    return false
  }
}

export async function checkAndNotifySimilarPages(currentPage: PageEvent, tabId?: number): Promise<void> {
  if (!currentPage.titleEmbedding) return

  console.log("checkAndNotifySimilarPages invoked for", currentPage.url, "tabId:", tabId)

  const sessions = getSessions()
  const allPages = sessions.flatMap((s) => s.pages)
  const now = Date.now()

  // Filter pages to only include:
  // 1. Different URL than current page
  // 2. Has embedding
  // 3. Not from excluded domains
  // 4. Older than 1 hour (don't notify about recent pages)
  // 5. Visited less than 5 times (low visit count = more interesting to revisit)
  const candidatePages = allPages.filter((p) => {
    if (p.url === currentPage.url) return false
    if (!p.titleEmbedding) return false
    if (isExcludedDomain(p.url)) return false
    
    const pageAge = now - p.timestamp
    if (pageAge < ONE_HOUR_MS) return false
    
    const visitCount = p.visitCount ?? 1
    if (visitCount >= MAX_VISIT_COUNT_FOR_NOTIFICATION) return false
    
    return true
  })

  // Find similar pages among candidates
  const similar = candidatePages
    .map((p) => ({
      page: p,
      score: cosineSimilarity(currentPage.titleEmbedding, p.titleEmbedding),
    }))
    .filter((r) => r.score >= 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  if (similar.length === 0) {
    console.log(`No similar pages found for: ${currentPage.title}`)
    return
  }

  console.log(`Found ${similar.length} similar pages for: ${currentPage.title}`)

  try {
    // Prepare pages data
    const pages = similar.map((r) => ({
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
    console.error("Failed to send notification:", error)
  }
}


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

    // 3. Send message to content script on the tab where page was visited
    if (tabId) {
      // Add a small delay to ensure content script is loaded
      setTimeout(() => {
        console.log("Attempting to send page notification to tab", tabId)
        chrome.tabs.sendMessage(
          tabId,
          {
            type: "show-page-notification",
            data: notificationData,
          },
          () => {
            if (chrome.runtime.lastError) {
              console.warn("Could not send message to content script:", chrome.runtime.lastError.message)
              // Fallback: inject toast directly via scripting API (only if available)
              try {
                if (!chrome.scripting?.executeScript) {
                  console.warn("chrome.scripting.executeScript not available")
                  return
                }
                chrome.scripting.executeScript({
                  target: { tabId },
                  func: (payload) => {
                    const existing = document.getElementById("prism-notification-container")
                    if (existing) existing.remove()

                    const container = document.createElement("div")
                    container.id = "prism-notification-container"
                    container.style.cssText = `position: fixed; top: 60px; right: 10px; z-index: 2147483647; font-family: system-ui, -apple-system, sans-serif;`

                    const toast = document.createElement("div")
                    toast.style.cssText = `background: white; color: #202124; padding: 0; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.1); width: 360px; overflow: hidden;`

                    const header = document.createElement("div")
                    header.style.cssText = `display: flex; align-items: center; gap: 12px; padding: 16px 16px 12px 16px; background: linear-gradient(135deg,#0072de 0%,#0056b3 100%); color: white;`

                    const icon = document.createElement("div")
                    icon.style.cssText = `width: 24px; height: 24px; background: white; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;`
                    icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 2L3 6H6V14H10V6H13L8 2Z" fill="#0072de"/></svg>`

                    const titleEl = document.createElement("div")
                    titleEl.style.cssText = `font-size: 14px; font-weight: 600; flex: 1;`
                    titleEl.textContent = "Similar pages found"

                    const closeBtn = document.createElement("button")
                    closeBtn.textContent = "✕"
                    closeBtn.style.cssText = `background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: background 0.2s;`
                    closeBtn.onmouseover = () => (closeBtn.style.background = "rgba(255,255,255,0.2)")
                    closeBtn.onmouseout = () => (closeBtn.style.background = "none")
                    closeBtn.onclick = () => dismiss()

                    header.appendChild(icon)
                    header.appendChild(titleEl)
                    header.appendChild(closeBtn)

                    const content = document.createElement("div")
                    content.style.cssText = `padding: 16px;`

                    const countBadge = document.createElement("div")
                    countBadge.style.cssText = `display: inline-block; background: #e3f2fd; color: #0072de; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-bottom: 12px;`
                    countBadge.textContent = `${payload.count} similar page${payload.count > 1 ? "s" : ""}`

                    const message = document.createElement("div")
                    message.style.cssText = `font-size: 13px; line-height: 1.5; margin-bottom: 16px; color: #5f6368;`
                    const titles = payload.pages.map((p) => p.title || p.url).join(" • ").substring(0, 120)
                    message.textContent = titles + (titles.length > 120 ? "..." : "")

                    const buttons = document.createElement("div")
                    buttons.style.cssText = `display: flex; gap: 8px;`

                    const openAll = document.createElement("button")
                    openAll.textContent = "Open all"
                    openAll.style.cssText = `flex: 1; background: #0072de; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.2s;`
                    openAll.onmouseover = () => (openAll.style.background = "#0056b3")
                    openAll.onmouseout = () => (openAll.style.background = "#0072de")
                    openAll.onclick = () => {
                      payload.pages.forEach(({ url }) => {
                        const fullUrl = url.startsWith("http") ? url : `https://${url}`
                        window.open(fullUrl, "_blank")
                      })
                      dismiss()
                    }

                    const dismissBtn = document.createElement("button")
                    dismissBtn.textContent = "Dismiss"
                    dismissBtn.style.cssText = `background: #f1f3f4; color: #5f6368; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.2s;`
                    dismissBtn.onmouseover = () => (dismissBtn.style.background = "#e8eaed")
                    dismissBtn.onmouseout = () => (dismissBtn.style.background = "#f1f3f4")
                    dismissBtn.onclick = () => dismiss()

                    buttons.appendChild(openAll)
                    buttons.appendChild(dismissBtn)

                    content.appendChild(countBadge)
                    content.appendChild(message)
                    content.appendChild(buttons)

                    toast.appendChild(header)
                    toast.appendChild(content)
                    container.appendChild(toast)
                    document.body.appendChild(container)

                    function dismiss() {
                      container.remove()
                    }

                    setTimeout(dismiss, 10000)
                  },
                  args: [notificationData]
                })
              } catch (err) {
                console.error("Scripting injection failed:", err)
              }
            } else {
              console.log("✅ Notification sent to content script on tab", tabId)
            }
          }
        )
      }, 500) // Wait 500ms for content script to initialize
    } else {
      console.warn("No tab ID provided, cannot send page notification")
    }
  } catch (error) {
    console.error("Failed to send notification:", error)
  }
}


import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_idle"
}

let lastScrollTime = 0
let scrollEventCount = 0
const SCROLL_BURST_THRESHOLD = 3 // 3 scrolls within window
const SCROLL_BURST_WINDOW = 1000 // 1 second

/**
 * Calculate scroll depth bucket
 */
function getScrollDepthBucket(): "top" | "middle" | "bottom" {
  const scrollTop = window.scrollY
  const docHeight = document.documentElement.scrollHeight - window.innerHeight
  
  if (docHeight <= 0) return "top"
  
  const scrollPercent = scrollTop / docHeight
  
  if (scrollPercent < 0.33) return "top"
  if (scrollPercent < 0.66) return "middle"
  return "bottom"
}

/**
 * Handle scroll events
 */
function handleScroll(): void {
  const now = Date.now()
  const bucket = getScrollDepthBucket()
  
  // Send scroll depth update
  chrome.runtime.sendMessage({
    type: "SCROLL_DEPTH_UPDATE",
    payload: { bucket }
  }).catch(() => {
    // Silently ignore - page may be in bfcache
  })
  
  // Detect scroll burst
  if (now - lastScrollTime < SCROLL_BURST_WINDOW) {
    scrollEventCount++
    if (scrollEventCount >= SCROLL_BURST_THRESHOLD) {
      chrome.runtime.sendMessage({
        type: "SCROLL_BURST_DETECTED"
      }).catch(() => {
        // Silently ignore - page may be in bfcache
      })
      scrollEventCount = 0 // Reset after burst detected
    }
  } else {
    scrollEventCount = 1
  }
  
  lastScrollTime = now
}

// Throttled scroll handler
let scrollTimeout: NodeJS.Timeout | null = null
window.addEventListener("scroll", () => {
  if (scrollTimeout) return
  
  scrollTimeout = setTimeout(() => {
    handleScroll()
    scrollTimeout = null
  }, 200) // Throttle to max 5 times per second
}, { passive: true })

export {}

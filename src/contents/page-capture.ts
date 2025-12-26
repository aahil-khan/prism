import type { PlasmoCSConfig } from "plasmo"
import type { PageEvent } from "~/types/page-event"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_start"
}

// Capture page visit data and send to background script
const capturePageVisit = () => {
  const pageEvent: PageEvent = {
    url: location.href,
    title: document.title,
    domain: location.hostname,
    timestamp: Date.now(),
    wasForeground: document.visibilityState === "visible",
    referrer: document.referrer || undefined
  }

  chrome.runtime.sendMessage({
    type: "PAGE_VISITED",
    payload: pageEvent
  })
}

// Capture on page load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", capturePageVisit)
} else {
  capturePageVisit()
}

export {}

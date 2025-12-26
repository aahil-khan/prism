import { processPageEvent } from "./sessionManager"

// Listen for PAGE_VISITED events from content script
export const setupPageVisitListener = () => {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "PAGE_VISITED") {
      console.log("📍 PAGE_VISITED:", message.payload)
      processPageEvent(message.payload).catch((error) => {
        console.error("Failed to process page event:", error)
      })
    }
  })
}

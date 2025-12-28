import { processPageEvent, getSessions } from "./sessionManager"
import { getBehaviorState } from "./ephemeralBehavior"
import { generateEmbedding } from "./embedding-engine"

// Listen for PAGE_VISITED events from content script
export const setupPageVisitListener = () => {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "PAGE_VISITED") {
      const baseEvent = {
        ...message.payload,
        openedAt: message.payload.openedAt ?? message.payload.timestamp
      }

      console.log("PAGE_VISITED:", baseEvent)
      console.log("Behavior State:", getBehaviorState())

      ;(async () => {
        try {
          // Reuse existing embedding for this URL if already computed in past sessions
          const sessions = getSessions()
          const existingWithEmbedding = (() => {
            for (let i = sessions.length - 1; i >= 0; i--) {
              const s = sessions[i]
              for (let j = s.pages.length - 1; j >= 0; j--) {
                const p = s.pages[j]
                if (p.url === baseEvent.url && p.titleEmbedding) return p
              }
            }
            return null
          })()

          if (existingWithEmbedding?.titleEmbedding) {
            baseEvent.titleEmbedding = existingWithEmbedding.titleEmbedding
          } else {
            const titleEmbedding = await generateEmbedding(baseEvent.title)
            if (titleEmbedding) {
              baseEvent.titleEmbedding = titleEmbedding
              console.log("Embedding generated for title:", baseEvent.title)
            }
          }

          await processPageEvent(baseEvent)
        } catch (error) {
          console.error("Failed to process page event:", error)
        }
      })()
    }
  })
}

import { processPageEvent, getSessions, getCurrentSessionId } from "./sessionManager"
import { getBehaviorState } from "./ephemeralBehavior"
import { generateEmbedding } from "./embedding-engine"
import { checkAndNotifySimilarPages } from "./similarity-notifier"
import { markGraphForRebuild, broadcastSessionUpdate } from "./index"
import { checkPageForCandidate, markCandidateNotified } from "./candidateDetector"

// Listen for PAGE_VISITED events from content script
export const setupPageVisitListener = () => {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "PAGE_VISITED") {
      const baseEvent = {
        ...message.payload,
        openedAt: message.payload.openedAt ?? message.payload.timestamp
      }

      console.log("[PageEvent] PAGE_VISITED:", baseEvent)
      console.log("[PageEvent] Behavior State:", getBehaviorState())

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
              console.log("[PageEvent] Embedding generated for title:", baseEvent.title)
            }
          }

          await processPageEvent(baseEvent)

          // Broadcast updated sessions to all registered sidepanel listeners
          broadcastSessionUpdate()

          // Mark graph for rebuild after page event is processed
          markGraphForRebuild()

          // Check for and notify about similar pages (pass sender tab ID)
          const tabId = sender.tab?.id
          await checkAndNotifySimilarPages(baseEvent, tabId)

          // Check if this page should create/update a project candidate
          const allSessions = getSessions()
          const currentSessionId = getCurrentSessionId()
          if (currentSessionId) {
            const candidate = await checkPageForCandidate(baseEvent, currentSessionId, allSessions)
            if (candidate) {
              console.log("[ProjectDetection] Candidate ready to notify:", candidate)
              
              // Send notification to content script (will show subtle banner)
              if (tabId) {
                chrome.tabs.sendMessage(tabId, {
                  type: "PROJECT_CANDIDATE_READY",
                  payload: {
                    candidateId: candidate.id,
                    primaryDomain: candidate.primaryDomain,
                    keywords: candidate.keywords,
                    visitCount: candidate.visitCount,
                    score: candidate.score
                  }
                }).then(() => {
                  // Only mark as notified if message sent successfully
                  markCandidateNotified(candidate.id)
                }).catch((err) => {
                  console.log("[CandidateDetector] Could not send notification to tab:", err)
                })
              }
            }
          }
        } catch (error) {
          console.error("[PageEvent] Failed to process page event:", error)
        }
      })()

      // Keep the message channel open for async work to avoid back/forward cache warnings
      return true
    }
  })
}

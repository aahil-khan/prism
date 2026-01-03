import { processPageEvent, getSessions, getCurrentSessionId } from "./sessionManager"
import { getBehaviorState } from "./ephemeralBehavior"
import { generateEmbedding } from "./embedding-engine"
import { markGraphForRebuild, broadcastSessionUpdate } from "./index"
import { checkPageForCandidate, markCandidateNotified } from "./candidateDetector"
import { checkForProjectSuggestion } from "./projectSuggestions"
import { loadProjects } from "./projectManager"

// Track recently shown project main site notifications to prevent loops
const recentMainSiteNotifications = new Map<string, number>()
const NOTIFICATION_COOLDOWN_MS = 30000 // 30 seconds

// Track manually opened sites from sidepanel to prevent notifications
const manuallyOpenedSites = new Map<string, number>()
const MANUAL_OPEN_COOLDOWN_MS = 5000 // 5 seconds

// Extract search query from search engine URLs
function extractSearchQuery(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()
    
    // Google Search
    if (hostname.includes('google.com') && urlObj.pathname.includes('/search')) {
      return urlObj.searchParams.get('q')
    }
    
    // Bing Search
    if (hostname.includes('bing.com') && urlObj.pathname.includes('/search')) {
      return urlObj.searchParams.get('q')
    }
    
    // DuckDuckGo
    if (hostname.includes('duckduckgo.com')) {
      return urlObj.searchParams.get('q')
    }
    
    return null
  } catch (e) {
    return null
  }
}

// Listen for PAGE_VISITED events from content script
export const setupPageVisitListener = () => {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SITE_OPENED_FROM_SIDEPANEL") {
      // Track that this site was manually opened from the sidepanel
      const url = message.payload?.url
      if (url) {
        manuallyOpenedSites.set(url, Date.now())
        console.log('[ManualOpen] Tracking site opened from sidepanel:', url)
      }
      return
    }
    
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

          // Extract search query if this is a search engine result page
          const searchQuery = extractSearchQuery(baseEvent.url)
          if (searchQuery) {
            baseEvent.searchQuery = searchQuery
          }

          // For search URLs, skip cache and regenerate embedding with search query
          // For other URLs, reuse existing embedding if available
          if (searchQuery) {
            // Always generate fresh embedding for search queries
            const titleEmbedding = await generateEmbedding(searchQuery)
            if (titleEmbedding) {
              baseEvent.titleEmbedding = titleEmbedding
              console.log("[PageEvent] Embedding generated for search query:", searchQuery)
            }
          } else if (existingWithEmbedding?.titleEmbedding) {
            baseEvent.titleEmbedding = existingWithEmbedding.titleEmbedding
          } else {
            // Use search query for embedding if available, otherwise use title
            const textForEmbedding = searchQuery || baseEvent.title
            const titleEmbedding = await generateEmbedding(textForEmbedding)
            if (titleEmbedding) {
              baseEvent.titleEmbedding = titleEmbedding
              console.log("[PageEvent] Embedding generated for:", searchQuery ? `search query "${searchQuery}"` : `title "${baseEvent.title}"`)
            }
          }

          await processPageEvent(baseEvent)

          // Broadcast updated sessions to all registered sidepanel listeners
          broadcastSessionUpdate()

          // Mark graph for rebuild after page event is processed
          markGraphForRebuild()

          // Check if current URL is the main site (first site) of any project
          const tabId = sender.tab?.id
          const projects = await loadProjects()
          
          const matchingProject = projects.find(p => {
            if (!p.sites || p.sites.length === 0) return false
            
            // Find the earliest added site (main site) based on addedAt timestamp
            const mainSite = [...p.sites].sort((a, b) => a.addedAt - b.addedAt)[0]
            
            // Get the main site URL and normalize it
            let mainSiteUrl = mainSite.url.toLowerCase()
            const currentUrl = baseEvent.url.toLowerCase()
            
            // Ensure both have protocols for proper comparison
            if (!mainSiteUrl.startsWith('http')) {
              mainSiteUrl = 'https://' + mainSiteUrl
            }
            
            // Extract the base URLs without query params or fragments
            try {
              const firstUrl = new URL(mainSiteUrl)
              const currUrl = new URL(currentUrl)
              
              // Match if hostname and pathname match (ignoring query/hash)
              return firstUrl.hostname === currUrl.hostname && 
                     currUrl.pathname.startsWith(firstUrl.pathname)
            } catch {
              // Fallback to simple string matching if URL parsing fails
              return currentUrl.includes(mainSiteUrl) || mainSiteUrl.includes(currentUrl)
            }
          })

          if (matchingProject && tabId) {
            // Check if this site was manually opened from sidepanel
            const now = Date.now()
            const manuallyOpened = manuallyOpenedSites.get(baseEvent.url)
            if (manuallyOpened && (now - manuallyOpened) < MANUAL_OPEN_COOLDOWN_MS) {
              console.log('[MainSiteNotification] Skipping notification - site was manually opened from sidepanel')
              return
            }
            
            // Check cooldown to prevent notification loops
            const lastShown = recentMainSiteNotifications.get(matchingProject.id)
            
            if (!lastShown || (now - lastShown) > NOTIFICATION_COOLDOWN_MS) {
              console.log("[ProjectMainSite] ✅ Detected visit to main site of project:", matchingProject.name)
              recentMainSiteNotifications.set(matchingProject.id, now)
              
              chrome.tabs.sendMessage(tabId, {
                type: "PROJECT_MAIN_SITE_VISIT",
                payload: {
                  projectId: matchingProject.id,
                  projectName: matchingProject.name,
                  currentUrl: baseEvent.url
                }
              }).catch((err) => {
                console.log("[ProjectMainSite] Could not send notification:", err)
              })
            } else {
              console.log("[ProjectMainSite] ⏸️ Skipping notification (cooldown active):", matchingProject.name)
            }
          } else {
            console.log("[ProjectMainSite] No matching project for:", baseEvent.url)
          }

          // Check if this page should create/update a project candidate
          const allSessions = getSessions()
          const currentSessionId = getCurrentSessionId()
          if (currentSessionId) {
            const candidate = await checkPageForCandidate(baseEvent, currentSessionId, allSessions)
            if (candidate) {
              console.log("[ProjectDetection] Candidate ready to notify:", candidate)
              
              // Mark as notified FIRST before sending message (to prevent duplicates)
              await markCandidateNotified(candidate.id, currentSessionId)
              
              // Send notification to content script (will show subtle banner)
              if (tabId) {
                chrome.tabs.sendMessage(tabId, {
                  type: "PROJECT_CANDIDATE_READY",
                  payload: {
                    candidateId: candidate.id,
                    primaryDomain: candidate.primaryDomain,
                    keywords: candidate.keywords,
                    visitCount: candidate.visitCount,
                    score: candidate.score,
                    scoreBreakdown: candidate.scoreBreakdown,
                    sessionId: currentSessionId
                  }
                }).catch((err) => {
                  console.log("[CandidateDetector] Could not send notification to tab:", err)
                })
              }
            }
            
            // Also check for project suggestions (add to existing project)
            const suggestion = await checkForProjectSuggestion(baseEvent, baseEvent.url)
            if (suggestion) {
              console.log("[ProjectSuggestion] ✅ Suggestion valid, sending notification:", suggestion.project.name, "score:", suggestion.score)
              if (tabId) {
                chrome.tabs.sendMessage(tabId, {
                  type: "PROJECT_SUGGESTION_READY",
                  payload: {
                    projectId: suggestion.project.id,
                    projectName: suggestion.project.name,
                    currentUrl: baseEvent.url,
                    currentTitle: baseEvent.title,
                    score: suggestion.score
                  }
                }).catch((err) => {
                  console.log("[ProjectSuggestion] Could not send notification:", err)
                })
              }
            } else {
              console.log("[ProjectSuggestion] ⚠️ No valid suggestion (already in project or dismissed)")
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

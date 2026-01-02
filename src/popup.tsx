import { useEffect, useState } from "react"
import "./style.css"
import { WelcomeModal } from "@/components/onboarding/WelcomeModal"
import { WelcomeBackModal } from "@/components/onboarding/WelcomeBackModal"

function IndexPopup() {
  const [phase, setPhase] = useState<"welcome" | "welcomeback">("welcome")

  const openSidePanel = async () => {
    try {
      const win = await chrome.windows.getCurrent()
      await chrome.sidePanel.open({ windowId: win.id })
      return true
    } catch (error) {
      console.error("Error opening side panel:", error)
      return false
    }
  }

  useEffect(() => {
    chrome.storage.local.get(["aegis-consent"], (result) => {
      if (result["aegis-consent"] === true) {
        setPhase("welcomeback")
      }
    })
  }, [])

  const handleWelcomeAccept = () => {
    // Get active tab to check if it's a new tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0]
      if (!activeTab?.id || !activeTab?.url) return

      // Check if we're on a new tab or chrome page
      const isNewTab = activeTab.url.startsWith('chrome://') || 
                       activeTab.url.startsWith('about:') ||
                       activeTab.url === ''

      if (isNewTab) {
        // Store flag to show consent on next page load
        chrome.storage.local.set({ 'show-consent-on-load': true })
        
        // Navigate to google.com first to get content script injected
        chrome.tabs.update(activeTab.id, { url: 'https://www.google.com' }, (updatedTab) => {
          if (updatedTab?.id) {
            // Retry sending message multiple times as fallback
            const retryCount = 6 // Try 6 times (every 500ms for 3 seconds total)
            let attempt = 0
            
            const retryMessage = () => {
              chrome.tabs.sendMessage(updatedTab.id, { type: "SHOW_CONSENT" }).catch(() => {
                attempt++
                if (attempt < retryCount) {
                  setTimeout(retryMessage, 500)
                }
              })
            }
            
            setTimeout(retryMessage, 500)
          }
        })
      } else {
        // Regular page, show consent directly
        chrome.tabs.sendMessage(activeTab.id, { type: "SHOW_CONSENT" })
      }
    })
    window.close()
  }

  const handleOpenPopulated = async () => {
    // Store preference to show populated state in sidepanel
    chrome.storage.local.set({ "sidepanel-active-tab": "sessions" })
    await openSidePanel()
    window.close()
  }

  return (
    <div className="bg-white flex items-center justify-center p-4 min-w-[400px] min-h-[300px]">
      <WelcomeModal 
        open={phase === "welcome"} 
        onOpenChange={() => {}} 
        onAccept={handleWelcomeAccept}
      />
      <WelcomeBackModal
        open={phase === "welcomeback"}
        onOpenChange={() => {}}
        onOpenPopulated={handleOpenPopulated}
      />
    </div>
  )
}

export default IndexPopup

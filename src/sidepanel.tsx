import "./style.css"
import { useState, useEffect } from "react"
import { EmptyState } from "@/components/sidepanel/EmptyState"
import { PopulatedState } from "@/components/sidepanel/PopulatedState"

function IndexSidePanel() {
  const [showPopulated, setShowPopulated] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("sessions") // Track active tab
  const [isOnboarding, setIsOnboarding] = useState(false) // Track if in onboarding mode

  useEffect(() => {
    // Check if there's a preferred tab stored
    chrome.storage.local.get(["sidepanel-active-tab", "sidepanel-onboarding"], (result) => {
      if (result["sidepanel-active-tab"]) {
        const tab = result["sidepanel-active-tab"]
        console.log("[Sidepanel] Setting active tab from storage:", tab)
        setShowPopulated(true)
        setActiveTab(tab as "sessions" | "graph" | "projects")
        // Clear the preference after using it
        chrome.storage.local.remove("sidepanel-active-tab")
      }
      
      // Check if opened during onboarding
      if (result["sidepanel-onboarding"] === true) {
        console.log("[Sidepanel] Opened in onboarding mode")
        setIsOnboarding(true)
        // Clear the flag after using it
        chrome.storage.local.remove("sidepanel-onboarding")
      }
    })

    // Listen for messages from background script
    const messageListener = (
      message: { type: "SWITCH_TO_TAB"; payload: { tab: string } },
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      if (message.type === "SWITCH_TO_TAB") {
        setShowPopulated(true) // Ensure populated state is showing
        setActiveTab(message.payload.tab)
      }
      sendResponse()
    }

    chrome.runtime.onMessage.addListener(messageListener)

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener)
    }
  }, [])

  return (
    <div className="h-screen w-full bg-white">
      {showPopulated ? (
        <PopulatedState 
          onShowEmpty={() => setShowPopulated(false)} 
          initialTab={activeTab}
        />
      ) : (
        <EmptyState 
          onShowPopulated={() => setShowPopulated(true)}
          isOnboarding={isOnboarding}
        />
      )}
    </div>
  )
}

export default IndexSidePanel

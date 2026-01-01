import "./style.css"
import { useState, useEffect } from "react"
import { EmptyState } from "@/components/sidepanel/EmptyState"
import { PopulatedState } from "@/components/sidepanel/PopulatedState"
import { NotificationToast } from "@/components/NotificationToast"

interface SimilarPagesMessage {
  type: "similar-pages-found"
  pages: Array<{
    title: string
    url: string
  }>
}

function IndexSidePanel() {
  const [showPopulated, setShowPopulated] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("sessions") // Track active tab
  const [notification, setNotification] = useState<{
    message: string
    pages: Array<{ title: string; url: string }>
  } | null>(null)

  useEffect(() => {
    // Check if there's a preferred tab stored
    chrome.storage.local.get("sidepanel-active-tab", (result) => {
      if (result["sidepanel-active-tab"]) {
        const tab = result["sidepanel-active-tab"]
        console.log("[Sidepanel] Setting active tab from storage:", tab)
        setShowPopulated(true)
        setActiveTab(tab as "sessions" | "graph" | "projects")
        // Clear the preference after using it
        chrome.storage.local.remove("sidepanel-active-tab")
      }
    })

    // Listen for messages from background script
    const messageListener = (
      message: SimilarPagesMessage | { type: "SWITCH_TO_TAB"; payload: { tab: string } },
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      if (message.type === "similar-pages-found") {
        const titles = message.pages
          .map((p) => p.title || p.url)
          .join(" | ")
          .substring(0, 100)
        setNotification({
          message: `You've visited ${message.pages.length} similar page(s): ${titles}${titles.length > 100 ? "..." : ""}`,
          pages: message.pages,
        })
      }
      if (message.type === "SWITCH_TO_TAB") {
        setShowPopulated(true) // Ensure populated state is showing
        setActiveTab(message.payload.tab)
      }
      sendResponse()
    }

    // Listen for storage changes (fallback for when sidepanel is cached)
    const storageListener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.pendingNotification) {
        const notificationData = changes.pendingNotification.newValue
        if (notificationData && notificationData.pages) {
          const titles = notificationData.pages
            .map((p: any) => p.title || p.url)
            .join(" | ")
            .substring(0, 100)
          setNotification({
            message: `You've visited ${notificationData.count} similar page(s): ${titles}${titles.length > 100 ? "..." : ""}`,
            pages: notificationData.pages,
          })
          // Clear the storage after showing notification
          chrome.storage.local.remove("pendingNotification")
        }
      }
    }

    // Check for pending notification on mount
    chrome.storage.local.get("pendingNotification", (result) => {
      if (result.pendingNotification) {
        const notificationData = result.pendingNotification
        if (notificationData && notificationData.pages) {
          const titles = notificationData.pages
            .map((p: any) => p.title || p.url)
            .join(" | ")
            .substring(0, 100)
          setNotification({
            message: `You've visited ${notificationData.count} similar page(s): ${titles}${titles.length > 100 ? "..." : ""}`,
            pages: notificationData.pages,
          })
          // Clear the storage after showing notification
          chrome.storage.local.remove("pendingNotification")
        }
      }
    })

    chrome.runtime.onMessage.addListener(messageListener)
    chrome.storage.onChanged.addListener(storageListener)

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener)
      chrome.storage.onChanged.removeListener(storageListener)
    }
  }, [])

  const handleOpenAll = () => {
    if (notification) {
      notification.pages.forEach(({ url }) => {
        const fullUrl = url.startsWith("http") ? url : `https://${url}`
        chrome.tabs.create({ url: fullUrl })
      })
    }
    setNotification(null)
  }

  return (
    <div className="h-screen w-full bg-white">
      {notification && (
        <NotificationToast
          message={notification.message}
          onOpenAll={handleOpenAll}
          onDismiss={() => setNotification(null)}
          duration={10000}
        />
      )}
      {showPopulated ? (
        <PopulatedState 
          onShowEmpty={() => setShowPopulated(false)} 
          initialTab={activeTab}
        />
      ) : (
        <EmptyState onShowPopulated={() => setShowPopulated(true)} />
      )}
    </div>
  )
}

export default IndexSidePanel

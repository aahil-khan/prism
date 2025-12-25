import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

export const getShadowHostId = () => "aegis-indicator"

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = `
    @keyframes slideInPeek {
      from { transform: translateX(100%); }
      to { transform: translateX(-8px); }
    }
    
    @keyframes slideInFull {
      from { transform: translateX(-8px); }
      to { transform: translateX(-48px); }
    }
  `
  return style
}

const AegisIndicator = () => {
  const [isVisible, setIsVisible] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    console.log("🟢 Aegis content script loaded and running!")
    
    // Listen for message from sidepanel when it closes
    const handleMessage = (message: any) => {
      console.log("Indicator received message:", message)
      if (message.type === "SIDEPANEL_CLOSED") {
        console.log("Showing indicator")
        setIsVisible(true)
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    
    // Also check localStorage as fallback
    const checkSidebarClosed = () => {
      const sidebarClosed = localStorage.getItem("aegis-sidebar-closed")
      if (sidebarClosed === "true") {
        console.log("Showing indicator from localStorage")
        setIsVisible(true)
        localStorage.removeItem("aegis-sidebar-closed")
      }
    }
    
    checkSidebarClosed()
    const interval = setInterval(checkSidebarClosed, 1000)

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
      clearInterval(interval)
    }
  }, [])

  const handleClose = () => {
    setIsVisible(false)
  }

  const handleClick = async () => {
    // Send message to background to open side panel
    console.log("📤 Sending OPEN_SIDEPANEL message to background")
    chrome.runtime.sendMessage({ type: "OPEN_SIDEPANEL" }, (response) => {
      console.log("📨 Response from background:", response)
    })
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div
      style={{
        position: "fixed",
        top: "200px",
        right: "0",
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        animation: "slideInPeek 0.3s ease-out forwards",
        transform: isHovered ? "translateX(-48px)" : "translateX(-8px)",
        transition: "transform 0.3s ease-out"
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}>
      
      {/* Tooltip - shown on hover */}
      {isHovered && (
        <div
          style={{
            position: "absolute",
            right: "48px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "white",
            padding: "12px 16px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontFamily: "'Breeze Sans', sans-serif",
            fontSize: "14px",
            color: "#080A0B"
          }}>
          <span>Aegis is learning this session</span>
          <button
            onClick={handleClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0",
              display: "flex",
              alignItems: "center",
              color: "#9A9FA6",
              fontSize: "18px",
              lineHeight: "1"
            }}>
            ×
          </button>
        </div>
      )}

      {/* Gradient Indicator Square */}
      <div
        onClick={handleClick}
        style={{
          width: "40px",
          height: "40px",
          background: "linear-gradient(135deg, #0072de 0%, #E91E63 100%)",
          borderRadius: "8px 0 0 8px",
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)"
        }}
      />
    </div>
  )
}

export default AegisIndicator

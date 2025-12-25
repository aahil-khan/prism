import { X } from "lucide-react"
import { useEffect, useRef } from "react"
import lottie from "lottie-web"

export function EmptyState() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Load and render Lottie animation
    const loadLottie = async () => {
      if (!containerRef.current) return

      try {
        const assetUrl = chrome.runtime.getURL("assets/Ambient-Motion.json")
        const response = await fetch(assetUrl)
        const animationData = await response.json()

        lottie.loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData: animationData
        })
      } catch (error) {
        console.error("Failed to load Lottie animation:", error)
      }
    }

    loadLottie()
  }, [])

  const handleClose = () => {
    // Send message to content scripts before closing
    console.log("Sidepanel sending SIDEPANEL_CLOSED message")
    chrome.runtime.sendMessage({ type: "SIDEPANEL_CLOSED" })
    // Also set localStorage as fallback
    localStorage.setItem("aegis-sidebar-closed", "true")
    window.close()
  }

  const handleReset = () => {
    chrome.storage.local.remove("aegis-consent")
    alert("Onboarding state reset. Re-open popup to see Welcome & Consent.")
  }

  return (
    <div className="relative h-full flex flex-col items-center justify-center p-6 bg-white">
      {/* Close Button */}
      <button
        onClick={handleClose}
        className="absolute right-6 top-6 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none"
        style={{ color: 'var(--gray)' }}>
        <X className="h-5 w-5" />
        <span className="sr-only">Close</span>
      </button>

      {/* Content */}
      <div className="flex flex-col items-center max-w-sm text-center">
        {/* Ambient Motion */}
        <div
          ref={containerRef}
          className="w-64 h-64 mb-8"
        />

        <h2
          className="text-2xl font-semibold mb-4"
          style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
          Your Memory Timeline
        </h2>

        <p
          className="text-sm leading-relaxed"
          style={{ color: 'var(--gray)', fontFamily: "'Breeze Sans'" }}>
          As you browse, Aegis will remember the pages you visit. Your timeline will appear here, organized by session.
        </p>

        <p
          className="text-sm leading-relaxed mt-4"
          style={{ color: 'var(--gray)', fontFamily: "'Breeze Sans'" }}>
          Everything stays on your device. Nothing leaves unless you decide to share it.
        </p>

        <button
          onClick={handleReset}
          className="mt-6 text-xs underline underline-offset-4 opacity-70 transition-opacity hover:opacity-100"
          style={{ color: 'var(--gray)', fontFamily: "'Breeze Sans'" }}>
          Reset onboarding (dev)
        </button>
      </div>
    </div>
  )
}

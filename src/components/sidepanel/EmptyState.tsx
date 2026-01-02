import { X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import lottie from "lottie-web"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  onShowPopulated?: () => void
  isOnboarding?: boolean
}

export function EmptyState({ onShowPopulated, isOnboarding = false }: EmptyStateProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [timeRemaining, setTimeRemaining] = useState(10)

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
    
    // If closing during onboarding, trigger the "Konta is live!" notification
    if (isOnboarding) {
      console.log("Closing during onboarding, triggering Konta is live notification")
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: "SHOW_ONBOARDING_COMPLETE",
            title: "Konta is live!",
            message: "Your intelligent browsing assistant is now active and learning your context."
          })
        }
      })
    }
    
    // Also set localStorage as fallback
    localStorage.setItem("aegis-sidebar-closed", "true")
    window.close()
  }

  // Auto-close sidebar after 10 seconds during onboarding
  useEffect(() => {
    if (!isOnboarding) return

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          handleClose()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isOnboarding, handleClose])

  const handleReset = () => {
    chrome.storage.local.remove(["aegis-consent", "onboarding-complete"])
    alert("Onboarding state reset. Re-open popup to see Welcome & Consent.")
  }

  return (
    <div className="relative h-full flex flex-col bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b bg-white" style={{ borderColor: '#E5E5E5' }}>
        <div className="flex items-center gap-3">
          <img src={chrome.runtime.getURL('assets/konta_logo.svg')} alt="Konta" className="w-8 h-8" />
          <h1 
            className="text-xl font"
            style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
            Konta
          </h1>
        </div>
        
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none"
          style={{ color: 'var(--gray)' }}>
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-between p-6 pt-4">
        <div className="flex flex-col items-center max-w-sm text-center">
        {/* Ambient Motion */}
        <div
          ref={containerRef}
          className="w-64 h-64 mb-8"
        />

        {isOnboarding ? (
          // Onboarding completion message
          <>
            <h2
              className="text-2xl font mb-6"
              style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
              You're all set!
            </h2>

            <p
              className="text-lg mb-4"
              style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
              Close the sidebar and continue browsing
            </p>

            <p
              className="text-xs leading-relaxed mb-4"
              style={{ color: 'var(--gray)', fontFamily: "'Breeze Sans'" }}>
              Konta will quietly learn from your browsing context. You can always come back here to view your sessions and projects.
            </p>
          </>
        ) : (
          // Normal empty state message
          <>
            <h2
              className="text-2xl font mb-6"
              style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
              Your Memory Timeline
            </h2>

            <p
              className="text-lg mb-4"
              style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
              Your browsing memory lives here!
            </p>

            <p
              className="text-xs leading-relaxed"
              style={{ color: 'var(--gray)', fontFamily: "'Breeze Sans'" }}>
              As you browse, Aegis will remember the pages you visit. Your timeline will appear here, organized by session.
            </p>

            <p
              className="text-xs leading-relaxed "
              style={{ color: 'var(--gray)', fontFamily: "'Breeze Sans'" }}>
              Everything stays on your device. Nothing leaves unless you decide to share it.
            </p>
          </>
        )}
        </div>

        {/* Bottom section with demo button and dev buttons */}
        <div className="flex flex-col items-center gap-2 pb-4">
          {isOnboarding ? (
            // Onboarding completion button
            <Button
              onClick={handleClose}
              className="h-[46px] px-8 font text-base rounded-full"
              style={{
                backgroundColor: '#0072de',
                color: 'white'
              }}>
              Let's go!
            </Button>
          ) : (
            // Normal empty state buttons
            <>
              <p
                className="text-sm leading-relaxed mb-1"
                style={{ color: '#0072de', fontFamily: "'Breeze Sans'" }}>
                Want to see an example?
              </p>

              <div className="flex justify-center mb-2">
                <Button
                  onClick={() => {}}
                  className="h-[46px] font text-base rounded-full"
                  style={{
                    backgroundColor: '#0072de',
                    color: 'white'
                  }}>
                  Enable Demo History
                </Button>
              </div>

              <p
                className="text-xs leading-relaxed"
                style={{ color: 'var(--gray)', fontFamily: "'Breeze Sans'" }}>
                Try a short demo timeline.
              </p>

              <button
                onClick={handleReset}
                className="text-xs underline underline-offset-4 opacity-70 transition-opacity hover:opacity-100"
                style={{ color: 'var(--gray)', fontFamily: "'Breeze Sans'" }}>
                Reset onboarding (dev)
              </button>

              <button
                onClick={onShowPopulated}
                className="text-xs underline underline-offset-4 opacity-70 transition-opacity hover:opacity-100"
                style={{ color: 'var(--gray)', fontFamily: "'Breeze Sans'" }}>
                Show populated state (dev)
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress Bar at bottom - Only show during onboarding */}
      {isOnboarding && (
        <div className="fixed bottom-0 left-0 right-0 h-1 z-50" style={{ backgroundColor: '#F0F0F0' }}>
          <div 
            className="h-full transition-all duration-1000 ease-linear"
            style={{ 
              width: `${(timeRemaining / 10) * 100}%`,
              backgroundColor: '#0072de'
            }}
          />
        </div>
      )}
    </div>
  )
}

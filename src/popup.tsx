import { useState } from "react"
import "./style.css"
import { WelcomeModal } from "@/components/onboarding/WelcomeModal"
import { ConsentModal } from "@/components/onboarding/ConsentModal"

function IndexPopup() {
  const [phase, setPhase] = useState<"welcome" | "consent">("welcome")

  const handleWelcomeAccept = () => {
    setPhase("consent")
  }

  const handleConsentAccept = async () => {
    // Open side panel on consent
    try {
      const window = await chrome.windows.getCurrent()
      await chrome.sidePanel.open({ windowId: window.id })
      console.log("Side panel opened successfully")
    } catch (error) {
      console.error("Error opening side panel:", error)
    }
  }

  return (
    <div className="bg-white flex items-center justify-center p-4 min-w-[400px] min-h-[430px]">
      <WelcomeModal 
        open={phase === "welcome"} 
        onOpenChange={() => {}} 
        onAccept={handleWelcomeAccept}
      />
      <ConsentModal 
        open={phase === "consent"} 
        onOpenChange={() => {}}
        onAccept={handleConsentAccept}
      />
    </div>
  )
}

export default IndexPopup

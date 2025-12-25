import { useEffect, useState } from "react"
import "./style.css"
import { WelcomeModal } from "@/components/onboarding/WelcomeModal"
import { ConsentModal } from "@/components/onboarding/ConsentModal"
import { WelcomeBackModal } from "@/components/onboarding/WelcomeBackModal"

function IndexPopup() {
  const [phase, setPhase] = useState<"welcome" | "consent" | "welcomeback">("welcome")

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
    const hasConsented = localStorage.getItem("aegis-consent") === "true"
    if (hasConsented) {
      setPhase("welcomeback")
    }
  }, [])

  const handleWelcomeAccept = () => {
    setPhase("consent")
  }

  const handleConsentAccept = async () => {
    localStorage.setItem("aegis-consent", "true")
    await openSidePanel()
    window.close()
  }

  const handleOpenPanel = async () => {
    await openSidePanel()
    window.close()
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
      <WelcomeBackModal
        open={phase === "welcomeback"}
        onOpenChange={() => {}}
        onOpenPanel={handleOpenPanel}
      />
    </div>
  )
}

export default IndexPopup

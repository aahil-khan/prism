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
    console.log("Popup mounted, checking consent...")
    chrome.storage.local.get(["aegis-consent"], (result) => {
      console.log("Consent result:", result)
      if (result["aegis-consent"] === true) {
        console.log("Setting phase to welcomeback")
        setPhase("welcomeback")
      } else {
        console.log("No consent found, staying on welcome")
      }
    })
  }, [])

  const handleWelcomeAccept = () => {
    // Send message to content script to show consent overlay
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "SHOW_CONSENT" })
      }
    })
    window.close()
  }

  const handleOpenPanel = async () => {
    await openSidePanel()
    window.close()
  }

  return (
    <div className="bg-white flex items-center justify-center p-4 min-w-[400px] min-h-[430px]">
      <div style={{ position: 'absolute', top: 10, left: 10, fontSize: 10 }}>
        Phase: {phase}
      </div>
      <WelcomeModal 
        open={phase === "welcome"} 
        onOpenChange={() => {}} 
        onAccept={handleWelcomeAccept}
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

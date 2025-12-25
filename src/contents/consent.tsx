import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

import styleText from "data-text:~/style.css"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = styleText
  return style
}

export const getShadowHostId = () => "aegis-consent-modal"

const ConsentOverlay = () => {
  const [isVisible, setIsVisible] = useState(false)
  const [agreed, setAgreed] = useState(false)

  useEffect(() => {
    // Listen for message to show consent
    const handleMessage = (message: any) => {
      console.log("Consent overlay received message:", message)
      if (message.type === "SHOW_CONSENT") {
        setIsVisible(true)
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [])

  const handleAccept = () => {
    if (agreed) {
      chrome.storage.local.set({ "aegis-consent": true })
      setIsVisible(false)
      
      // Send message to background to open sidebar
      console.log("📤 Sending OPEN_SIDEPANEL from consent")
      chrome.runtime.sendMessage({ type: "OPEN_SIDEPANEL" }, (response) => {
        console.log("📨 Response:", response)
      })
    }
  }

  const handleDecline = () => {
    // Don't set consent, just close the overlay
    // Next time user opens extension, they'll see Welcome modal again
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-[999998] flex items-center justify-center bg-black/50 font-[Breeze_Sans]">
      <div className="w-[500px] bg-white rounded-2xl shadow-2xl relative" style={{ padding: '28px 32px' }}>
        {/* Close Button */}
        <button
          onClick={handleDecline}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-xl rounded hover:bg-gray-100 transition-colors border-none bg-transparent cursor-pointer"
          style={{ color: '#9A9FA6' }}>
          ×
        </button>

        <h1 className="text-[26px] font-semibold text-center mb-1.5" style={{ color: '#080A0B' }}>
          Welcome to Aegis!
        </h1>

        <p className="text-[15px] text-center mb-5 leading-normal" style={{ color: '#9A9FA6' }}>
          Aegis stores browsing context locally so you can resume work later.
        </p>

        {/* Privacy Features List */}
        <div className="mb-[18px]">
          {[
            "Stores browsing context locally",
            "No cloud sync",
            "No account required"
          ].map((feature, idx) => (
            <div key={idx} className="flex items-center gap-2.5 mb-2.5">
              <span className="text-sm flex-shrink-0" style={{ color: '#9A9FA6' }}>•</span>
              <p className="text-[15px] m-0" style={{ color: '#080A0B' }}>
                {feature}
              </p>
            </div>
          ))}
        </div>

        {/* Consent Checkbox */}
        <div className="flex items-start gap-2.5 mb-3 p-3.5 rounded-lg border" style={{ backgroundColor: '#F8F8F8', borderColor: '#E5E5E5' }}>
          <input
            type="checkbox"
            id="consent"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 w-[18px] h-[18px] cursor-pointer flex-shrink-0 bg-white border-2 rounded"
            style={{ accentColor: '#2138DF' }}
          />
          <label htmlFor="consent" className="text-sm cursor-pointer leading-normal" style={{ color: '#080A0B' }}>
            I understand that browsing context is stored locally on this device
          </label>
        </div>

        {/* Learn More Link */}
        <div className="mb-[18px]">
          <button className="text-[13px] font-medium bg-transparent border-none cursor-pointer underline p-0" style={{ color: '#2138DF' }}>
            Learn More
          </button>
        </div>

        {/* Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleAccept}
            disabled={!agreed}
            className="w-[280px] h-[46px] font-semibold text-base rounded-full"
            style={{
              backgroundColor: agreed ? '#2138DF' : '#CCCCCC',
              color: 'white'
            }}>
            Start Context Learning
          </Button>
        </div>

        {/* Helper text */}
        <p className="text-center mt-3.5 text-xs mb-0.5" style={{ color: '#9A9FA6' }}>
          What happens next?
        </p>
        <p className="text-center text-xs leading-snug" style={{ color: '#9A9FA6' }}>
          Aegis will quietly learn this session in the background.
        </p>
      </div>
    </div>
  )
}

export default ConsentOverlay

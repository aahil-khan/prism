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
  const [showLearnMore, setShowLearnMore] = useState(false)

  useEffect(() => {
    // Check if we should show consent on page load
    chrome.storage.local.get(['show-consent-on-load'], (result) => {
      if (result['show-consent-on-load'] === true) {
        console.log("📋 Auto-showing consent from storage flag")
        setIsVisible(true)
        // Clear the flag after using it
        chrome.storage.local.remove('show-consent-on-load')
      }
    })

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
      // chrome.storage.local.set({ "aegis-consent": true })
      chrome.runtime.sendMessage({ type: "CONSENT_GRANTED" })
      setIsVisible(false)
      
      // Send message to background to open sidebar with onboarding flag
      console.log("📤 Sending OPEN_SIDEPANEL from consent with onboarding flag")
      chrome.runtime.sendMessage({ 
        type: "OPEN_SIDEPANEL",
        isOnboarding: true 
      }, (response) => {
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
      <div 
        className="w-[600px] bg-white rounded-2xl shadow-2xl relative overflow-hidden" 
        style={{ padding: '24px 32px' }}
        onClick={() => showLearnMore && setShowLearnMore(false)}>
        {/* Close Button */}
        {!showLearnMore && (
          <button
            onClick={handleDecline}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-xl rounded hover:bg-gray-100 transition-colors border-none bg-transparent cursor-pointer z-10"
            style={{ color: '#9A9FA6' }}>
            ×
          </button>
        )}

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
            className="mt-0.5 w-[18px] h-[18px] cursor-pointer flex-shrink-0 bg-white border-2 rounded appearance-none checked:bg-[#0072de] checked:border-[#0072de]"
            style={{ 
              backgroundImage: agreed ? 'url("data:image/svg+xml,%3csvg viewBox=\'0 0 16 16\' fill=\'white\' xmlns=\'http://www.w3.org/2000/svg\'%3e%3cpath d=\'M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z\'/%3e%3c/svg%3e")' : 'none',
              backgroundSize: '100% 100%',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          />
          <label htmlFor="consent" className="text-sm cursor-pointer leading-normal" style={{ color: '#080A0B' }}>
            I understand that browsing context is stored locally on this device
          </label>
        </div>

        {/* Learn More Link */}
        <div className="mb-[18px]">
          <button 
            onClick={() => setShowLearnMore(true)}
            className="text-[13px] font-medium bg-transparent border-none cursor-pointer underline p-0" 
            style={{ color: '#0072de' }}>
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
              backgroundColor: agreed ? '#0072de' : '#CCCCCC',
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

        {/* Learn More Slide-out Panel */}
        <div 
          className="absolute top-0 bottom-0 right-0 w-[400px] bg-white shadow-2xl overflow-y-auto transition-transform duration-300 ease-in-out"
          style={{ 
            padding: '32px 28px',
            transform: showLearnMore ? 'translateX(0)' : 'translateX(100%)'
          }}
          onClick={(e) => e.stopPropagation()}>
          {/* Close Button */}
          <button
            onClick={() => setShowLearnMore(false)}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-xl rounded hover:bg-gray-100 transition-colors border-none bg-transparent cursor-pointer"
            style={{ color: '#9A9FA6' }}>
            ×
          </button>

          <h2 className="text-xl font-semibold mb-6 pb-3" style={{ color: '#080A0B', borderBottom: '2px solid rgba(0, 114, 223, 0.3)' }}>
            Learn More
          </h2>

          {/* What is stored? */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-2" style={{ color: '#080A0B' }}>
              What is stored?
            </h3>
            <p className="text-sm mb-2" style={{ color: '#080A0B' }}>
              Aegis saves browsing context, not content.
            </p>
            <ul className="space-y-1 ml-4 list-disc">
              <li className="text-sm" style={{ color: '#9A9FA6' }}>Page titles and domains</li>
              <li className="text-sm" style={{ color: '#9A9FA6' }}>Time spent during a session</li>
              <li className="text-sm" style={{ color: '#9A9FA6' }}>Tab and navigation patterns</li>
            </ul>
            <p className="text-sm mt-2" style={{ color: '#0072df' }}>
              Page content and form inputs are not stored.
            </p>
          </div>

          {/* Where it lives? */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-2" style={{ color: '#080A0B' }}>
              Where it lives?
            </h3>
            <p className="text-sm mb-2" style={{ color: '#080A0B' }}>
              Stored only on this device
            </p>
            <ul className="space-y-1 ml-4 list-disc">
              <li className="text-sm" style={{ color: '#9A9FA6' }}>No cloud sync</li>
              <li className="text-sm" style={{ color: '#9A9FA6' }}>No external servers</li>
              <li className="text-sm" style={{ color: '#9A9FA6' }}>No account or sign-in</li>
            </ul>
            <p className="text-sm mt-2" style={{ color: '#0072df' }}>
            Your data never leaves this browser.
            </p>
          </div>

          {/* Your Control */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-2" style={{ color: '#080A0B' }}>
              Your Control
            </h3>
            <p className="text-sm mb-2" style={{ color: '#080A0B' }}>
              You stay in control
            </p>
            <ul className="space-y-1 ml-4 list-disc">
              <li className="text-sm" style={{ color: '#9A9FA6' }}>Pause context learning anytime</li>
              <li className="text-sm" style={{ color: '#9A9FA6' }}>Clear storage context from settings</li>
              <li className="text-sm" style={{ color: '#9A9FA6' }}>Nothing is shared automatically</li>
            </ul>
            <p className="text-sm mt-2" style={{ color: '#0072df' }}>
            This feature runs entirely locally.
            </p>
          </div>

          
        </div>
      </div>
    </div>
  )
}

export default ConsentOverlay

import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
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

  if (!isVisible) return null

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999998,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        fontFamily: "'Breeze Sans', sans-serif"
      }}>
      <div
        style={{
          width: "360px",
          backgroundColor: "white",
          padding: "20px",
          borderRadius: "8px",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.15)"
        }}>
        <h2
          style={{
            fontSize: "24px",
            fontWeight: 600,
            textAlign: "center",
            marginBottom: "12px",
            color: "#080A0B"
          }}>
          Your Privacy Matters
        </h2>

        <p
          style={{
            fontSize: "14px",
            textAlign: "center",
            marginBottom: "16px",
            color: "#9A9FA6",
            lineHeight: "1.5"
          }}>
          We take your privacy seriously. Here's how Aegis protects you:
        </p>

        {/* Privacy Features List */}
        <div style={{ marginBottom: "20px" }}>
          {[
            "All data stays on your device",
            "No cloud storage or syncing",
            "No tracking or analytics",
            "No third-party sharing",
            "Full local encryption"
          ].map((feature, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px"
              }}>
              <span style={{ color: "#2138DF", fontSize: "14px" }}>•</span>
              <p style={{ color: "#080A0B", fontSize: "14px", margin: 0 }}>
                {feature}
              </p>
            </div>
          ))}
        </div>

        {/* Consent Checkbox */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            marginBottom: "20px"
          }}>
          <Checkbox
            id="consent"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked as boolean)}
            style={{ marginTop: "4px" }}
          />
          <label
            htmlFor="consent"
            style={{
              fontSize: "14px",
              cursor: "pointer",
              color: "#080A0B"
            }}>
            I understand and agree to Aegis privacy practices
          </label>
        </div>

        {/* Button */}
        <Button
          onClick={handleAccept}
          disabled={!agreed}
          style={{
            width: "100%",
            height: "40px",
            fontWeight: 600,
            backgroundColor: agreed ? "#2138DF" : "#CCCCCC",
            color: "white",
            cursor: agreed ? "pointer" : "not-allowed",
            border: "none",
            borderRadius: "6px"
          }}>
          I Agree
        </Button>

        <div style={{ textAlign: "center", marginTop: "8px" }}>
          <button
            style={{
              fontSize: "12px",
              color: "#9A9FA6",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline"
            }}>
            Learn more about our privacy policy
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConsentOverlay

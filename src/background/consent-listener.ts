// Listen for CONSENT_GRANTED events
export const setupConsentListener = () => {
  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.type === "CONSENT_GRANTED") {
      chrome.storage.local.set({ "aegis-consent": true })
    }
  })
}
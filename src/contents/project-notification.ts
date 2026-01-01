/**
 * Content script that shows subtle notification banner when a project candidate is ready.
 * Listens for PROJECT_CANDIDATE_READY messages from background script.
 */

import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_start"  // Changed to document_start to ensure early injection
}

console.log("[ProjectNotification] Content script loaded!")

// Listener function
function handleMessage(message: any, sender: any, sendResponse: any) {
  console.log("[ProjectNotification] Message received:", message)
  if (message.type === "PROJECT_CANDIDATE_READY") {
    console.log("[ProjectNotification] Project candidate ready! Showing notification...")
    const { candidateId, primaryDomain, keywords, visitCount, score } = message.payload
    showProjectNotification(candidateId, primaryDomain, keywords, visitCount, score)
    sendResponse({ received: true })
  }
  return true
}

// Register listener
chrome.runtime.onMessage.addListener(handleMessage)

function showProjectNotification(
  candidateId: string,
  primaryDomain: string,
  keywords: string[],
  visitCount: number,
  score: number
) {
  // Check if banner already exists
  if (document.getElementById("aegis-project-notification")) {
    return
  }

  // Create notification banner
  const banner = document.createElement("div")
  banner.id = "aegis-project-notification"
  banner.style.cssText = `
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 2147483647;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 380px;
    animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    backdrop-filter: blur(10px);
  `

  const keywordsText = keywords.length > 0 
    ? keywords.slice(0, 3).join(", ") 
    : primaryDomain

  banner.innerHTML = `
    <style>
      @keyframes slideInRight {
        from {
          opacity: 0;
          transform: translateX(100px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      @keyframes slideOutRight {
        from {
          opacity: 1;
          transform: translateX(0);
        }
        to {
          opacity: 0;
          transform: translateX(100px);
        }
      }
      .aegis-notification-title {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .aegis-notification-body {
        font-size: 13px;
        opacity: 0.95;
        margin-bottom: 12px;
        line-height: 1.4;
      }
      .aegis-notification-actions {
        display: flex;
        gap: 8px;
      }
      .aegis-notification-btn {
        padding: 8px 16px;
        border-radius: 8px;
        border: none;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        font-family: inherit;
      }
      .aegis-notification-btn-primary {
        background: white;
        color: #667eea;
      }
      .aegis-notification-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(255, 255, 255, 0.3);
      }
      .aegis-notification-btn-secondary {
        background: rgba(255, 255, 255, 0.2);
        color: white;
      }
      .aegis-notification-btn-secondary:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      .aegis-notification-badge {
        display: inline-block;
        background: rgba(255, 255, 255, 0.25);
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        margin-left: auto;
      }
    </style>
    <div class="aegis-notification-title">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
      <span>Project Detected</span>
      <span class="aegis-notification-badge">${score}% confident</span>
    </div>
    <div class="aegis-notification-body">
      It looks like you're working on a project related to <strong>${keywordsText}</strong>. 
      Would you like to track it?
    </div>
    <div class="aegis-notification-actions">
      <button class="aegis-notification-btn aegis-notification-btn-primary" id="aegis-accept-project">
        Track Project
      </button>
      <button class="aegis-notification-btn aegis-notification-btn-secondary" id="aegis-dismiss-project">
        Not Now
      </button>
    </div>
  `

  document.body.appendChild(banner)

  // Handle accept - Track the project
  document.getElementById("aegis-accept-project")?.addEventListener("click", () => {
    console.log("[ProjectNotification] Track Project clicked for candidate:", candidateId)
    
    // Open sidepanel immediately (must be in response to user gesture)
    chrome.runtime.sendMessage({
      type: "OPEN_SIDEPANEL_TO_PROJECTS"
    }, (resp) => {
      console.log("[ProjectNotification] Sidepanel open response:", resp)
    })
    
    // Then promote the candidate
    chrome.runtime.sendMessage({
      type: "PROMOTE_CANDIDATE",
      payload: { candidateId }
    }, (response) => {
      console.log("[ProjectNotification] PROMOTE_CANDIDATE response:", response)
      if (response?.success) {
        console.log("[ProjectNotification] Project promoted successfully!")
        showSuccessMessage("Project tracked successfully!")
      } else {
        console.error("[ProjectNotification] Failed to promote candidate:", response?.error)
      }
    })
    removeBanner(banner)
  })

  // Handle dismiss - Snooze for 2-3 more visits
  document.getElementById("aegis-dismiss-project")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "SNOOZE_CANDIDATE",
      payload: { candidateId }
    })
    removeBanner(banner)
  })

  // Auto-dismiss after 15 seconds
  setTimeout(() => {
    if (document.getElementById("aegis-project-notification")) {
      removeBanner(banner)
    }
  }, 15000)
}

function removeBanner(banner: HTMLElement) {
  banner.style.animation = "slideOutRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
  setTimeout(() => {
    banner.remove()
  }, 300)
}

function showSuccessMessage(message: string) {
  const successBanner = document.createElement("div")
  successBanner.style.cssText = `
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 2147483647;
    background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  `
  successBanner.textContent = message
  document.body.appendChild(successBanner)

  setTimeout(() => {
    successBanner.style.animation = "slideOutRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
    setTimeout(() => successBanner.remove(), 300)
  }, 3000)
}

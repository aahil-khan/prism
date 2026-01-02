/**
 * LEGACY: Content script for project notifications
 * 
 * ⚠️ DISABLED - Migrated to unified indicator hub (indicator.tsx)
 * 
 * This content script previously showed banner notifications for:
 * - PROJECT_CANDIDATE_READY (new project detection)
 * - PROJECT_SUGGESTION_READY (add page to existing project)
 * 
 * All functionality has been moved to the unified notification hub.
 * Kept for reference only.
 */

import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_start"
}

console.log("[ProjectNotification] LEGACY content script - DISABLED")
console.log("[ProjectNotification] All notifications now handled by indicator hub")

// DISABLED: All message handlers commented out
// This file is kept for reference but no longer active

function showProjectNotification(
  candidateId: string,
  primaryDomain: string,
  keywords: string[],
  visitCount: number,
  score: number,
  scoreBreakdown?: { visits: number; sessions: number; resources: number; timeSpan: number; total: number }
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
      .aegis-score-breakdown {
        margin: 12px 0;
        padding: 8px 0;
        border-top: 1px solid rgba(255, 255, 255, 0.2);
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      }
      .aegis-score-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 4px 0;
        font-size: 11px;
        opacity: 0.9;
      }
      .aegis-score-bar {
        flex: 1;
        height: 4px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        margin: 0 8px;
        overflow: hidden;
      }
      .aegis-score-bar-fill {
        height: 100%;
        background: white;
        border-radius: 2px;
        transition: width 0.3s ease;
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
    ${scoreBreakdown ? `
      <div class="aegis-score-breakdown">
        <div class="aegis-score-item">
          <span>Visits (${visitCount})</span>
          <div class="aegis-score-bar">
            <div class="aegis-score-bar-fill" style="width: ${(scoreBreakdown.visits / 40) * 100}%"></div>
          </div>
          <span>${scoreBreakdown.visits}/40</span>
        </div>
        <div class="aegis-score-item">
          <span>Sessions</span>
          <div class="aegis-score-bar">
            <div class="aegis-score-bar-fill" style="width: ${(scoreBreakdown.sessions / 30) * 100}%"></div>
          </div>
          <span>${scoreBreakdown.sessions}/30</span>
        </div>
        <div class="aegis-score-item">
          <span>Resources</span>
          <div class="aegis-score-bar">
            <div class="aegis-score-bar-fill" style="width: ${(scoreBreakdown.resources / 20) * 100}%"></div>
          </div>
          <span>${scoreBreakdown.resources}/20</span>
        </div>
        <div class="aegis-score-item">
          <span>Time span</span>
          <div class="aegis-score-bar">
            <div class="aegis-score-bar-fill" style="width: ${(scoreBreakdown.timeSpan / 10) * 100}%"></div>
          </div>
          <span>${scoreBreakdown.timeSpan}/10</span>
        </div>
      </div>
    ` : ''}
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

function showProjectSuggestion(
  projectId: string,
  projectName: string,
  currentUrl: string,
  currentTitle: string,
  score: number
) {
  // Check if banner already exists
  if (document.getElementById("aegis-project-suggestion")) {
    return
  }

  // Create suggestion banner (green gradient to differentiate from detection)
  const banner = document.createElement("div")
  banner.id = "aegis-project-suggestion"
  banner.style.cssText = `
    position: fixed;
    top: 80px;
    right: 16px;
    z-index: 2147483647;
    background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 380px;
    animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    backdrop-filter: blur(10px);
  `

  banner.innerHTML = `
    <style>
      .aegis-suggestion-title {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .aegis-suggestion-body {
        font-size: 13px;
        opacity: 0.95;
        margin-bottom: 12px;
        line-height: 1.4;
      }
      .aegis-suggestion-actions {
        display: flex;
        gap: 8px;
      }
      .aegis-suggestion-btn {
        padding: 8px 16px;
        border-radius: 8px;
        border: none;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        font-family: inherit;
      }
      .aegis-suggestion-btn-primary {
        background: white;
        color: #10b981;
      }
      .aegis-suggestion-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(255, 255, 255, 0.3);
      }
      .aegis-suggestion-btn-secondary {
        background: rgba(255, 255, 255, 0.2);
        color: white;
      }
      .aegis-suggestion-btn-secondary:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      .aegis-suggestion-confidence {
        font-size: 11px;
        opacity: 0.8;
        margin-top: 4px;
      }
    </style>
    <div class="aegis-suggestion-title">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      </svg>
      <span>Related to ${projectName}</span>
    </div>
    <div class="aegis-suggestion-body">
      This page seems related to your <strong>${projectName}</strong> project. Add it?
      <div class="aegis-suggestion-confidence">${Math.round(score * 100)}% match confidence</div>
    </div>
    <div class="aegis-suggestion-actions">
      <button class="aegis-suggestion-btn aegis-suggestion-btn-primary" id="aegis-add-to-project">
        Add to Project
      </button>
      <button class="aegis-suggestion-btn aegis-suggestion-btn-secondary" id="aegis-dismiss-suggestion">
        Not Now
      </button>
    </div>
  `

  document.body.appendChild(banner)

  // Handle add to project
  document.getElementById("aegis-add-to-project")?.addEventListener("click", () => {
    console.log("[ProjectSuggestion] Adding site to project:", projectId, currentUrl)
    chrome.runtime.sendMessage({
      type: "ADD_SITE_TO_PROJECT",
      payload: {
        projectId,
        siteUrl: currentUrl,
        siteTitle: currentTitle,
        addedBy: 'auto'
      }
    }, (response) => {
      console.log("[ProjectSuggestion] ADD_SITE_TO_PROJECT response:", response)
      if (response?.success) {
        showSuccessMessage(`Added to ${projectName}!`)
      } else {
        console.error("[ProjectSuggestion] Failed to add site:", response?.error)
        if (response?.alreadyAdded) {
          showSuccessMessage("Site already in this project")
        }
      }
    })
    removeBanner(banner)
  })

  // Handle dismiss
  document.getElementById("aegis-dismiss-suggestion")?.addEventListener("click", () => {
    console.log("[ProjectSuggestion] Dismissed suggestion")
    
    // Record dismissal so it doesn't show again for 24 hours
    chrome.runtime.sendMessage({
      type: "DISMISS_PROJECT_SUGGESTION",
      payload: {
        projectId,
        url: currentUrl
      }
    })
    
    removeBanner(banner)
  })

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (document.getElementById("aegis-project-suggestion")) {
      removeBanner(banner)
    }
  }, 10000)
}

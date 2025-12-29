import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://*/*", "http://*/*"],
  all_frames: false,
}

interface NotificationData {
  pages: Array<{
    title: string
    url: string
  }>
  count: number
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "show-page-notification") {
    console.log("[content] show-page-notification received", message.data)
    showNotificationToast(message.data)
  }
  sendResponse()
})

console.log("[content] notification content script loaded on", window.location.href)

function showNotificationToast(data: NotificationData) {
  // Create container
  const container = document.createElement("div")
  container.id = "prism-notification-container"
  container.style.cssText = `
    position: fixed;
    top: 60px;
    right: 10px;
    z-index: 2147483647;
    font-family: system-ui, -apple-system, sans-serif;
  `

  // Create toast
  const toast = document.createElement("div")
  toast.style.cssText = `
    background: white;
    color: #202124;
    padding: 0;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.1);
    width: 360px;
    animation: slideDown 0.3s ease-out forwards;
    overflow: hidden;
  `

  // Add animation keyframes if not already present
  if (!document.getElementById("prism-notification-styles")) {
    const style = document.createElement("style")
    style.id = "prism-notification-styles"
    style.textContent = `
      @keyframes slideDown {
        from {
          transform: translateY(-20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      @keyframes slideUp {
        from {
          transform: translateY(0);
          opacity: 1;
        }
        to {
          transform: translateY(-20px);
          opacity: 0;
        }
      }
    `
    document.head.appendChild(style)
  }

  // Create header with icon and title
  const header = document.createElement("div")
  header.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 16px 12px 16px;
    background: linear-gradient(135deg, #0072de 0%, #0056b3 100%);
    color: white;
  `

  // Create icon
  const icon = document.createElement("div")
  icon.style.cssText = `
    width: 24px;
    height: 24px;
    background: white;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  `
  icon.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 2L3 6H6V14H10V6H13L8 2Z" fill="#0072de"/>
    </svg>
  `

  // Create title
  const title = document.createElement("div")
  title.style.cssText = `
    font-size: 14px;
    font-weight: 600;
    flex: 1;
  `
  title.textContent = `Similar pages found`

  // Create close button in header
  const headerCloseBtn = document.createElement("button")
  headerCloseBtn.textContent = "✕"
  headerCloseBtn.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 18px;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.2s;
  `
  headerCloseBtn.onmouseover = () => (headerCloseBtn.style.background = "rgba(255, 255, 255, 0.2)")
  headerCloseBtn.onmouseout = () => (headerCloseBtn.style.background = "none")
  headerCloseBtn.onclick = dismissToast

  header.appendChild(icon)
  header.appendChild(title)
  header.appendChild(headerCloseBtn)

  // Create content area
  const content = document.createElement("div")
  content.style.cssText = `
    padding: 16px;
  `

  // Create count badge
  const countBadge = document.createElement("div")
  countBadge.style.cssText = `
    display: inline-block;
    background: #e3f2fd;
    color: #0072de;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 12px;
  `
  countBadge.textContent = `${data.count} similar page${data.count > 1 ? 's' : ''}`

  // Create message
  const message = document.createElement("div")
  message.style.cssText = `
    font-size: 13px;
    line-height: 1.5;
    margin-bottom: 16px;
    color: #5f6368;
  `
  const titles = data.pages
    .map((p) => p.title || p.url)
    .join(" • ")
    .substring(0, 120)
  message.textContent = titles + (titles.length > 120 ? "..." : "")

  // Create buttons container
  const buttonsContainer = document.createElement("div")
  buttonsContainer.style.cssText = `
    display: flex;
    gap: 8px;
  `

  // Create "Open all" button
  const openAllBtn = document.createElement("button")
  openAllBtn.textContent = "Open all"
  openAllBtn.style.cssText = `
    flex: 1;
    background: #0072de;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  `
  openAllBtn.onmouseover = () => (openAllBtn.style.background = "#0056b3")
  openAllBtn.onmouseout = () => (openAllBtn.style.background = "#0072de")
  openAllBtn.onclick = () => {
    data.pages.forEach(({ url }) => {
      const fullUrl = url.startsWith("http") ? url : `https://${url}`
      window.open(fullUrl, "_blank")
    })
    dismissToast()
  }

  // Create "Dismiss" button
  const dismissBtn = document.createElement("button")
  dismissBtn.textContent = "Dismiss"
  dismissBtn.style.cssText = `
    background: #f1f3f4;
    color: #5f6368;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  `
  dismissBtn.onmouseover = () => (dismissBtn.style.background = "#e8eaed")
  dismissBtn.onmouseout = () => (dismissBtn.style.background = "#f1f3f4")
  dismissBtn.onclick = dismissToast

  buttonsContainer.appendChild(openAllBtn)
  buttonsContainer.appendChild(dismissBtn)

  content.appendChild(countBadge)
  content.appendChild(message)
  content.appendChild(buttonsContainer)

  toast.appendChild(header)
  toast.appendChild(content)
  container.appendChild(toast)
  document.body.appendChild(container)

  function dismissToast() {
    toast.style.animation = "slideUp 0.3s ease-out forwards"
    setTimeout(() => {
      container.remove()
    }, 300)
  }

  // Auto-dismiss after 10 seconds
  setTimeout(dismissToast, 10000)
}

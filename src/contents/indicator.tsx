import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_start"
}

export const getShadowHostId = () => "konta-notification-hub"

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = `
    @keyframes slideInFromRight {
      from { 
        opacity: 0;
        transform: translateX(20px);
      }
      to { 
        opacity: 1;
        transform: translateX(0);
      }
    }
    
    @keyframes slideInFromLeft {
      from { 
        opacity: 0;
        transform: translateX(-20px);
      }
      to { 
        opacity: 1;
        transform: translateX(0);
      }
    }
    
    @keyframes slideInFromTop {
      from {
        transform: translateY(-10px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `
  return style
}

type EdgePosition = 'left' | 'right'

type Notification = {
  id: string
  type: 'learning' | 'candidate' | 'suggestion' | 'similar-pages'
  title: string
  message?: string
  timestamp: number
  score?: number
  payload?: any // Store original payload for actions
}

const Indicator = () => {
  const [isVisible, setIsVisible] = useState(false) // Hidden until onboarding complete
  const [onboardingComplete, setOnboardingComplete] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [edgePosition, setEdgePosition] = useState<EdgePosition>('right')
  const [verticalPosition, setVerticalPosition] = useState(200) // pixels from top
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [tempPosition, setTempPosition] = useState({ x: 0, y: 0 })
  const [closeTimeout, setCloseTimeout] = useState<NodeJS.Timeout | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [mode, setMode] = useState<'normal' | 'notification'>('normal')
  const [notificationExpanded, setNotificationExpanded] = useState(false)


  // Load saved position and check onboarding status
  useEffect(() => {
    chrome.storage.local.get(['konta-position', 'onboarding-complete'], (result) => {
      // Check if onboarding is complete
      if (result['onboarding-complete'] === true) {
        console.log("✅ Onboarding complete, enabling indicator")
        setOnboardingComplete(true)
        setIsVisible(true)
      } else {
        console.log("⏳ Onboarding not complete, hiding indicator")
        setOnboardingComplete(false)
        setIsVisible(false)
      }
      if (result['konta-position']) {
        const { edge, vertical } = result['konta-position']
        setEdgePosition(edge || 'right')
        setVerticalPosition(vertical || 200)
      }
    })
  }, [])

  // Save position to storage when changed
  const savePosition = (edge: EdgePosition, vertical: number) => {
    chrome.storage.local.set({
      'konta-position': { edge, vertical }
    })
  }

  useEffect(() => {
    console.log("🟢 Konta notification hub loaded!")
    
    const handleMessage = (message: any, sender: any, sendResponse: any) => {
      console.log("Konta hub received message:", message)
      if (message.type === "SIDEPANEL_CLOSED") {
        setIsVisible(true)
      }
      
      // Handle PROJECT_CANDIDATE_READY
      if (message.type === "PROJECT_CANDIDATE_READY") {
        // Only show if onboarding is complete
        if (!onboardingComplete) {
          console.log("⏸️ Onboarding not complete, skipping PROJECT_CANDIDATE_READY notification")
          sendResponse({ received: false, reason: "onboarding_incomplete" })
          return true
        }
        
        console.log("📦 Project candidate detected:", message.payload)
        const { candidateId, primaryDomain, keywords, visitCount, score } = message.payload
        const keywordsText = keywords.length > 0 
          ? keywords.slice(0, 3).join(", ") 
          : primaryDomain
        
        const notification: Notification = {
          id: candidateId,
          type: 'candidate',
          title: 'Project Detected',
          message: `Working on project related to ${keywordsText}. Track it?`,
          timestamp: Date.now(),
          score,
          payload: message.payload // Store for actions
        }
        setNotifications((prev) => [notification, ...prev])
        setMode('notification')
        setIsExpanded(false)
        // Auto-expand after 800ms
        setTimeout(() => setNotificationExpanded(true), 800)
        sendResponse({ received: true })
      }
      
      // Handle PROJECT_SUGGESTION_READY
      if (message.type === "PROJECT_SUGGESTION_READY") {
        // Only show if onboarding is complete
        if (!onboardingComplete) {
          console.log("⏸️ Onboarding not complete, skipping PROJECT_SUGGESTION_READY notification")
          sendResponse({ received: false, reason: "onboarding_incomplete" })
          return true
        }
        
        console.log("💡 Project suggestion detected:", message.payload)
        const { projectId, projectName, currentUrl, currentTitle, score } = message.payload
        
        const notification: Notification = {
          id: `suggestion-${projectId}-${Date.now()}`,
          type: 'suggestion',
          title: `Related to ${projectName}`,
          message: `This page seems related to your ${projectName} project. Add it?`,
          timestamp: Date.now(),
          score: Math.round(score * 100), // Convert 0-1 to percentage
          payload: message.payload // Store for actions
        }
        setNotifications((prev) => [notification, ...prev])
        setMode('notification')
        setIsExpanded(false)
        // Auto-expand after 800ms
        setTimeout(() => setNotificationExpanded(true), 800)
        sendResponse({ received: true })
      }
      
      // Handle similar pages notification
      if (message.type === "show-page-notification" || message.type === "SHOW_SIMILAR_PAGES") {
        // Only show if onboarding is complete
        if (!onboardingComplete) {
          console.log("⏸️ Onboarding not complete, skipping SHOW_SIMILAR_PAGES notification")
          sendResponse({ received: false, reason: "onboarding_incomplete" })
          return true
        }
        
        console.log("🔗 Similar pages detected:", message.data || message.payload)
        const data = message.data || message.payload
        const pages = data?.pages || []
        
        if (pages.length > 0) {
          const titles = pages.map(p => p.title || p.url).slice(0, 2).join(", ")
          const notification: Notification = {
            id: `similar-${Date.now()}`,
            type: 'similar-pages',
            title: `${pages.length} similar page${pages.length > 1 ? 's' : ''} found`,
            message: titles + (pages.length > 2 ? `, and ${pages.length - 2} more` : ''),
            timestamp: Date.now(),
            payload: { pages, count: pages.length }
          }
          setNotifications((prev) => [notification, ...prev])
          setMode('notification')
          setIsExpanded(false)
          // Auto-expand after 800ms
          setTimeout(() => setNotificationExpanded(true), 800)
          sendResponse({ received: true })
        }
      }
      
      // Handle onboarding completion notification
      if (message.type === "SHOW_ONBOARDING_COMPLETE") {
        console.log("🎉 Onboarding complete, showing Konta is live notification")
        
        // Mark onboarding as complete
        chrome.storage.local.set({ 'onboarding-complete': true }, () => {
          console.log("✅ Onboarding completion flag stored")
        })
        setOnboardingComplete(true)
        
        const notification: Notification = {
          id: `onboarding-${Date.now()}`,
          type: 'learning',
          title: message.title || "Konta is live!",
          message: message.message || "Your intelligent browsing assistant is now active and learning your context.",
          timestamp: Date.now()
        }
        setNotifications((prev) => [notification, ...prev])
        setMode('notification')
        setIsExpanded(false)
        setIsVisible(true) // Make sure indicator is visible
        // Auto-expand after 800ms
        setTimeout(() => setNotificationExpanded(true), 800)
        sendResponse({ received: true })
      }
      
      if (message.type === "SHOW_NOTIFICATION") {
        const notification: Notification = {
          id: Date.now().toString(),
          type: message.payload?.type || 'learning',
          title: message.payload?.title || '',
          message: message.payload?.message,
          timestamp: Date.now()
        }
        setNotifications((prev) => [notification, ...prev])
        setMode('notification')
        setIsExpanded(false)
        // Auto-expand if there's a message
        if (notification.message) {
          setTimeout(() => setNotificationExpanded(true), 800)
        }
      }
      
      return true // Keep channel open for async responses
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    
    const checkSidebarClosed = () => {
      const sidebarClosed = localStorage.getItem("aegis-sidebar-closed")
      if (sidebarClosed === "true") {
        setIsVisible(true)
        localStorage.removeItem("aegis-sidebar-closed")
      }
    }
    
    checkSidebarClosed()
    const interval = setInterval(checkSidebarClosed, 1000)

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
      clearInterval(interval)
    }
  }, [])

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Calculate offset from mouse to component center
    const rect = e.currentTarget.getBoundingClientRect()
    const offsetX = e.clientX - (rect.left + rect.width / 2)
    const offsetY = e.clientY - (rect.top + rect.height / 2)
    
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    setDragOffset({ x: offsetX, y: offsetY })
    setTempPosition({ x: e.clientX - offsetX, y: e.clientY - offsetY })
    e.preventDefault()
    e.stopPropagation()
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      // Position component at mouse location minus offset with bounds
      const newX = Math.max(24, Math.min(window.innerWidth - 24, e.clientX - dragOffset.x))
      const newY = Math.max(24, Math.min(window.innerHeight - 80, e.clientY - dragOffset.y))
      
      setTempPosition({ x: newX, y: newY })
      
      // Determine which edge to snap to based on mouse position
      const threshold = window.innerWidth / 2
      if (e.clientX < threshold) {
        setEdgePosition('left')
      } else {
        setEdgePosition('right')
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      // Calculate final vertical position from center of component
      const finalVertical = Math.max(50, Math.min(window.innerHeight - 100, tempPosition.y))
      setVerticalPosition(finalVertical)
      savePosition(edgePosition, finalVertical)
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset, tempPosition, edgePosition])

  const handleClose = () => {
    setIsVisible(false)
    setIsExpanded(false)
  }

  const handleClick = async () => {
    if (isDragging) return
    if (mode === 'notification') {
      // In notification mode, click toggles expansion
      if (notifications[0]?.message) {
        setNotificationExpanded(!notificationExpanded)
      }
    } else {
      // In normal mode, clicking icon collapses the wheel if expanded
      if (isExpanded) {
        setIsExpanded(false)
      }
    }
  }

  const handleOpenSidebar = () => {
    console.log("📤 Opening sidebar")
    chrome.runtime.sendMessage({ type: "OPEN_SIDEPANEL" })
    setIsVisible(false)
    setIsExpanded(false)
  }

  const handleOpenSidebarWithTab = (tab: string) => {
    console.log("📤 Opening sidebar with tab:", tab)
    // Store preferred tab in storage
    chrome.storage.local.set({ "sidepanel-active-tab": tab })
    // Open the sidepanel
    chrome.runtime.sendMessage({ type: "OPEN_SIDEPANEL" })
    setIsExpanded(false)
  }

  const isNewTabUrl = (url: string) =>
    url.startsWith("chrome://newtab") ||
    url.startsWith("edge://newtab") ||
    url === "about:blank"

  const handleAddToProject = () => {
    console.log("➕ Add to project clicked")

    const currentUrl = window.location.href
    const currentTitle = document.title
    const isNewTab = isNewTabUrl(currentUrl)

    const payload: Record<string, unknown> = { "sidepanel-active-tab": "projects" }

    if (!isNewTab) {
      payload["sidepanel-add-current-page"] = {
        url: currentUrl,
        title: currentTitle
      }
    }

    chrome.storage.local.set(payload, () => {
      chrome.runtime.sendMessage({ type: "OPEN_SIDEPANEL" })
      setIsExpanded(false)
      setIsVisible(false)
    })
  }

  if (!isVisible) return null

  // Calculate positioning based on edge and state
  const getPositionStyle = () => {
    if (isDragging) {
      // During drag: position at mouse location
      return {
        position: 'fixed' as const,
        left: `${tempPosition.x - 24}px`, // Center the 48px component
        top: `${tempPosition.y - 24}px`,
        right: 'auto',
        transform: 'none',
        transition: 'none'
      }
    }
    
    // Normal positioning with edge snap and transforms
    const baseStyle: any = {
      position: 'fixed' as const,
      top: `${verticalPosition}px`,
      transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), left 0.3s, right 0.3s'
    }
    
    if (edgePosition === 'right') {
      baseStyle.right = 0
      baseStyle.left = 'auto'
      if (mode === 'notification') {
        // In notification mode, slide out completely to show icon + notification
        baseStyle.transform = 'translateX(0)'
      } else if (isExpanded) {
        baseStyle.transform = 'translateX(0)'
      } else if (isHovered) {
        baseStyle.transform = 'translateX(-8px)'
      } else {
        baseStyle.transform = 'translateX(calc(100% - 12px))' // Peek 12px
      }
    } else {
      baseStyle.left = 0
      baseStyle.right = 'auto'
      if (mode === 'notification') {
        // In notification mode, slide out completely to show icon + notification
        baseStyle.transform = 'translateX(0)'
      } else if (isExpanded) {
        baseStyle.transform = 'translateX(0)'
      } else if (isHovered) {
        baseStyle.transform = 'translateX(8px)'
      } else {
        baseStyle.transform = 'translateX(calc(-100% + 12px))' // Peek 12px
      }
    }
    
    return baseStyle
  }

  // Simple geometric Konta logo
  const KontaIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      {/* Abstract K shape - geometric style */}
      <path 
        d="M7 4 L7 20 M7 12 L17 4 M7 12 L17 20" 
        stroke="white" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  )

  // Radial menu options
  const radialOptions = [
    { 
      angle: 75, 
      label: "Timeline", 
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
      action: () => handleOpenSidebarWithTab("sessions")
    },
    { 
      angle: 40, 
      label: "Graph", 
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m-3-3h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
      action: () => handleOpenSidebarWithTab("graph")
    },
    { 
      angle: 0, 
      label: "Add to Project", 
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
      action: handleAddToProject,
      highlight: true // Center option
    },
    { 
      angle: -40, 
      label: "Projects", 
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
      action: () => handleOpenSidebarWithTab("projects")
    },
    { 
      angle: -75, 
      label: "Focus", 
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" strokeWidth="2"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
      action: () => handleOpenSidebarWithTab("focus")
    }
  ]

  return (
    <div
      style={{
        ...getPositionStyle(),
        zIndex: 2147483647,
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        userSelect: 'none'
      }}
      onMouseEnter={() => {
        if (!isDragging && mode === 'normal') {
          // Clear any pending close timeout
          if (closeTimeout) {
            clearTimeout(closeTimeout)
            setCloseTimeout(null)
          }
          setIsHovered(true)
          setIsExpanded(true)
        }
      }}
      onMouseLeave={() => {
        if (!isDragging && mode === 'normal') {
          setIsHovered(false)
          // Delay closing by 2 seconds
          const timeout = setTimeout(() => {
            setIsExpanded(false)
          }, 1000)
          setCloseTimeout(timeout)
        }
      }}>
      
      {/* Main Icon Square */}
      <div
        onClick={handleClick}
        style={{
          width: "48px",
          height: "48px",
          background: "linear-gradient(135deg, #0072de 0%, #0056b3 100%)",
          borderRadius: mode === 'notification' 
            ? (edgePosition === 'right' ? "0 0 0 0" : "0 0 0 0")
            : (edgePosition === 'right' ? "8px 0 0 8px" : "0 8px 8px 0"),
          cursor: 'pointer',
          boxShadow: "0 2px 12px rgba(0, 0, 0, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: 'box-shadow 0.2s',
          position: 'relative',
          zIndex: 1,
          order: edgePosition === 'right' ? 1 : 2
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.25)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "0 2px 12px rgba(0, 0, 0, 0.15)"
        }}>
        <KontaIcon />
      </div>

      {/* Drag Handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          width: "14px",
          height: "48px",
          background: "linear-gradient(135deg, #0072de 0%, #0056b3 100%)",
          cursor: isDragging ? 'grabbing' : 'grab',
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          userSelect: 'none',
          transition: 'opacity 0.2s',
          opacity: 0.8,
          order: edgePosition === 'right' ? 2 : 1
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.8"
        }}>
        <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
          <circle cx="2.5" cy="4.5" r="1" fill="rgba(255, 255, 255, 0.7)" />
          <circle cx="2.5" cy="9.5" r="1" fill="rgba(255, 255, 255, 0.7)" />
          <circle cx="5" cy="4.5" r="1" fill="rgba(255, 255, 255, 0.7)" />
          <circle cx="5" cy="9.5" r="1" fill="rgba(255, 255, 255, 0.7)" />
          <circle cx="7.5" cy="4.5" r="1" fill="rgba(255, 255, 255, 0.7)" />
          <circle cx="7.5" cy="9.5" r="1" fill="rgba(255, 255, 255, 0.7)" />
        </svg>
      </div>

      {/* NORMAL MODE - Radial Options Wheel */}
      {mode === 'normal' && (
        <div
          style={{
            position: 'absolute',
            [edgePosition === 'right' ? 'right' : 'left']: '16px',
            top: '50%',
            transform: `translateY(-50%) scale(${isExpanded ? 1 : 0.9})`,
            opacity: isExpanded ? 1 : 0,
            transition: 'opacity 0.2s ease 0.3s, transform 0.2s ease 0.3s',
            pointerEvents: isExpanded ? 'auto' : 'none'
          }}>
          {radialOptions.map((option, index) => {
            // Calculate position using angle
            const angleRad = (option.angle * Math.PI) / 180
            const distance = 90
            const x = Math.cos(angleRad) * distance * (edgePosition === 'right' ? -1 : 1)
            const y = Math.sin(angleRad) * distance * -1 // Negative for upward angles
            
            return (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation()
                  option.action()
                }}
                style={{
                  position: 'absolute',
                  left: edgePosition === 'right' ? 'auto' : `${x}px`,
                  right: edgePosition === 'right' ? `${Math.abs(x)}px` : 'auto',
                  top: `calc(50% + ${y}px)`,
                  transform: 'translate(-50%, -50%)',
                  width: option.highlight ? '56px' : '48px',
                  height: option.highlight ? '56px' : '48px',
                  background: option.highlight 
                    ? 'linear-gradient(135deg, #0072de 0%, #0056b3 100%)'
                    : 'white',
                  border: option.highlight ? 'none' : '2px solid #E5E5E5',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  pointerEvents: 'auto',
                  color: option.highlight ? 'white' : '#0072de',
                  fontFamily: "'Breeze Sans', sans-serif",
                  zIndex: option.highlight ? 2 : 1
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.15)'
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.25)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
                }}
                title={option.label}>
                {option.icon}
              </button>
            )
          })}
        </div>
      )}

      {/* NOTIFICATION MODE - Slide out notification */}
      {mode === 'notification' && notifications.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            order: edgePosition === 'right' ? 0 : 3,
            position: 'relative'
          }}>
          {/* Single row with title */}
          <div
            style={{
              backgroundColor: 'white',
              border: '1px solid #E5E5E5',
              borderRadius: edgePosition === 'right' ? '8px 0 0 0' : '0 8px 0 0',
              padding: '0 16px',
              minWidth: '200px',
              maxWidth: '280px',
              height: '48px',
              boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
              fontFamily: "'Breeze Sans', sans-serif",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              animation: edgePosition === 'right' ? 'slideInFromRight 0.3s ease' : 'slideInFromLeft 0.3s ease',
              cursor: notifications[0]?.message ? 'pointer' : 'default'
            }}
            onClick={() => {
              if (notifications[0]?.message) {
                setNotificationExpanded(!notificationExpanded)
              }
            }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#080A0B', flex: 1 }}>
              {notifications[0]?.title}
            </div>
            {/* Score badge */}
            {notifications[0]?.score && (
              <div style={{
                backgroundColor: 'rgba(0, 114, 222, 0.1)',
                color: '#0072de',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 600,
                marginRight: '8px'
              }}>
                {notifications[0].score}% confident
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setNotifications([])
                setMode('normal')
              }}
              style={{
                fontSize: '18px',
                color: '#9A9FA6',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
              ×
            </button>
          </div>

          {/* Expanded message content */}
          {notificationExpanded && notifications[0]?.message && (
            <div
              style={{
                backgroundColor: 'white',
                border: '1px solid #E5E5E5',
                borderTop: 'none',
                borderRadius: edgePosition === 'right' ? '0 0 8px 0' : '0 0 0 8px',
                padding: '12px 16px',
                minWidth: '200px',
                maxWidth: '280px',
                boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
                fontFamily: "'Breeze Sans', sans-serif",
                animation: 'slideInFromTop 0.2s ease',
                fontSize: '12px',
                color: '#666',
                lineHeight: 1.4,
                position: 'absolute',
                top: '48px',
                [edgePosition === 'right' ? 'right' : 'left']: '0'
              }}>
              <div style={{ marginBottom: '12px' }}>
                {notifications[0].message}
              </div>
              
              {/* Score breakdown for candidate notifications */}
              {notifications[0].type === 'candidate' && notifications[0].payload?.scoreBreakdown && (
                <div style={{
                  marginBottom: '12px',
                  paddingTop: '12px',
                  paddingBottom: '8px',
                  borderTop: '1px solid #E5E5E5',
                  borderBottom: '1px solid #E5E5E5'
                }}>
                  {(() => {
                    const breakdown = notifications[0].payload.scoreBreakdown
                    const items = [
                      { label: `Visits (${notifications[0].payload.visitCount})`, value: breakdown.visits, max: 40 },
                      { label: 'Sessions', value: breakdown.sessions, max: 30 },
                      { label: 'Resources', value: breakdown.resources, max: 20 },
                      { label: 'Time span', value: breakdown.timeSpan, max: 10 }
                    ]
                    return items.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                        fontSize: '11px',
                        color: '#666'
                      }}>
                        <span style={{ minWidth: '80px' }}>{item.label}</span>
                        <div style={{
                          flex: 1,
                          height: '4px',
                          background: 'rgba(0, 114, 222, 0.1)',
                          borderRadius: '2px',
                          margin: '0 8px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            height: '100%',
                            background: '#0072de',
                            borderRadius: '2px',
                            width: `${(item.value / item.max) * 100}%`,
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <span style={{ minWidth: '40px', textAlign: 'right' }}>
                          {item.value}/{item.max}
                        </span>
                      </div>
                    ))
                  })()}
                </div>
              )}
              
              {/* Action buttons for candidate notifications */}
              {notifications[0].type === 'candidate' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      console.log("✅ Track Project clicked for candidate:", notifications[0].id)
                      const candidateId = notifications[0].id
                      
                      // Open sidepanel first (must be in user gesture)
                      chrome.runtime.sendMessage({ type: "OPEN_SIDEPANEL_TO_PROJECTS" })
                      
                      // Then promote the candidate
                      chrome.runtime.sendMessage({
                        type: "PROMOTE_CANDIDATE",
                        payload: { candidateId }
                      })
                      
                      // Dismiss notification
                      setNotifications([])
                      setMode('normal')
                    }}
                    style={{
                      backgroundColor: '#0072de',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      flex: 1,
                      fontFamily: "'Breeze Sans', sans-serif",
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#0056b3'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#0072de'
                    }}>
                    Track Project
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      console.log("⏭️ Not Now clicked, snoozing candidate:", notifications[0].id)
                      
                      // Snooze the candidate
                      chrome.runtime.sendMessage({
                        type: "SNOOZE_CANDIDATE",
                        payload: { candidateId: notifications[0].id }
                      })
                      
                      // Dismiss notification
                      setNotifications([])
                      setMode('normal')
                    }}
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.05)',
                      color: '#666',
                      border: '1px solid #E5E5E5',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      flex: 1,
                      fontFamily: "'Breeze Sans', sans-serif",
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.08)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)'
                    }}>
                    Not Now
                  </button>
                </div>
              )}
              
              {/* Action buttons for suggestion notifications */}
              {notifications[0].type === 'suggestion' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      console.log("➕ Add to Project clicked:", notifications[0].payload)
                      const { projectId, currentUrl, currentTitle } = notifications[0].payload
                      
                      // Add site to project
                      chrome.runtime.sendMessage({
                        type: "ADD_SITE_TO_PROJECT",
                        payload: {
                          projectId,
                          siteUrl: currentUrl,
                          siteTitle: currentTitle,
                          addedBy: 'auto'
                        }
                      })
                      
                      // Dismiss notification
                      setNotifications([])
                      setMode('normal')
                    }}
                    style={{
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      flex: 1,
                      fontFamily: "'Breeze Sans', sans-serif",
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#059669'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#10b981'
                    }}>
                    Add to Project
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      console.log("⏭️ Dismissed suggestion:", notifications[0].payload)
                      
                      // Record dismissal
                      chrome.runtime.sendMessage({
                        type: "DISMISS_PROJECT_SUGGESTION",
                        payload: {
                          projectId: notifications[0].payload.projectId,
                          url: notifications[0].payload.currentUrl
                        }
                      })
                      
                      // Dismiss notification
                      setNotifications([])
                      setMode('normal')
                    }}
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.05)',
                      color: '#666',
                      border: '1px solid #E5E5E5',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      flex: 1,
                      fontFamily: "'Breeze Sans', sans-serif",
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.08)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)'
                    }}>
                    Not Now
                  </button>
                </div>
              )}
              
              {/* Action buttons for similar pages notifications */}
              {notifications[0].type === 'similar-pages' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      console.log("🔗 Open All clicked:", notifications[0].payload.pages)
                      
                      // Open all similar pages in new tabs
                      notifications[0].payload.pages.forEach(({ url }) => {
                        const fullUrl = url.startsWith('http') ? url : `https://${url}`
                        window.open(fullUrl, '_blank')
                      })
                      
                      // Dismiss notification
                      setNotifications([])
                      setMode('normal')
                    }}
                    style={{
                      backgroundColor: '#0072de',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      flex: 1,
                      fontFamily: "'Breeze Sans', sans-serif",
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#0056b3'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#0072de'
                    }}>
                    Open All
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      console.log("⏭️ Dismissed similar pages")
                      
                      // Dismiss notification
                      setNotifications([])
                      setMode('normal')
                    }}
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.05)',
                      color: '#666',
                      border: '1px solid #E5E5E5',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      flex: 1,
                      fontFamily: "'Breeze Sans', sans-serif",
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.08)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)'
                    }}>
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Indicator

import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
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
  `
  return style
}

type EdgePosition = 'left' | 'right'

const KontaNotificationHub = () => {
  const [isVisible, setIsVisible] = useState(true) // Always visible for testing
  const [isHovered, setIsHovered] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [edgePosition, setEdgePosition] = useState<EdgePosition>('right')
  const [verticalPosition, setVerticalPosition] = useState(200) // pixels from top
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [tempPosition, setTempPosition] = useState({ x: 0, y: 0 })
  const [closeTimeout, setCloseTimeout] = useState<NodeJS.Timeout | null>(null)


  // Load saved position from storage
  useEffect(() => {
    chrome.storage.local.get(['konta-position'], (result) => {
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
    
    const handleMessage = (message: any) => {
      console.log("Konta hub received message:", message)
      if (message.type === "SIDEPANEL_CLOSED") {
        setIsVisible(true)
      }
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
    // Clicking icon collapses the wheel if expanded
    if (isExpanded) {
      setIsExpanded(false)
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
      if (isExpanded) {
        baseStyle.transform = 'translateX(0)'
      } else if (isHovered) {
        baseStyle.transform = 'translateX(-8px)'
      } else {
        baseStyle.transform = 'translateX(calc(100% - 12px))' // Peek 12px
      }
    } else {
      baseStyle.left = 0
      baseStyle.right = 'auto'
      if (isExpanded) {
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
        alignItems: "center",
        userSelect: 'none'
      }}
      onMouseEnter={() => {
        if (!isDragging) {
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
        if (!isDragging) {
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
          borderRadius: edgePosition === 'right' ? "8px 0 0 8px" : "0 8px 8px 0",
          cursor: isExpanded ? 'pointer' : 'default',
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

      {/* Radial Options Wheel */}
      {true && (
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
    </div>
      )
}

export default KontaNotificationHub

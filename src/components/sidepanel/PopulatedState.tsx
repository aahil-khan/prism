import { X, Search, ChevronDown, Settings, ArrowLeft, ExternalLink, MoreVertical, ExternalLinkIcon, Copy, Trash2, EyeOff, Folder, Calendar, Tag, Edit2, Clock } from "lucide-react"
import { useEffect, useMemo, useState, useRef } from "react"
import type { PageEvent } from "~/types/page-event"
import type { Session } from "~/types/session"
import type { Label } from "~/background/labelsStore"
import type { Project } from "~/types/project"
import { CoiPanel } from "./CoiPanel"
import { GraphPanel } from "./GraphPanel"
import { FocusPanel } from "./FocusPanel"

// Mock filter data - will be fetched from API
const MOCK_FILTERS = [
  { id: 1, label: "Development" },
  { id: 2, label: "Research" },
  { id: 3, label: "Shoes" },
  { id: 4, label: "Humanities Co..." },
  { id: 5, label: "Technology" },
  { id: 6, label: "Design" },
  { id: 7, label: "Business" },
  { id: 8, label: "Marketing" },
]

type SearchResult = {
  pageEvent: PageEvent
  score: number
  layer: "ML" | "Semantic" | "Keyword"
}

async function sendMessage<T>(message: any): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const err = chrome.runtime.lastError
      if (err) {
        reject(err)
      } else {
        resolve(response as T)
      }
    })
  })
}

interface PopulatedStateProps {
  onShowEmpty?: () => void
  initialTab?: string
}

export function PopulatedState({ onShowEmpty, initialTab }: PopulatedStateProps) {
  const [activeTab, setActiveTab] = useState<"sessions" | "graph" | "projects" | "focus">(
    (initialTab as "sessions" | "graph" | "projects" | "focus") || "sessions"
  )
  const [sessions, setSessions] = useState<Session[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [results, setResults] = useState<SearchResult[]>([])

  // Update activeTab when initialTab changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab as "sessions" | "graph" | "projects" | "focus")
    }
  }, [initialTab])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [expandFilters, setExpandFilters] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<number | null>(null)
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null)
  const [expandedDays, setExpandedDays] = useState<string[]>(["today"])
  const [expandedSessions, setExpandedSessions] = useState<string[]>([])
  const [expandedProjects, setExpandedProjects] = useState<string[]>([])
  const [showAddLabelModal, setShowAddLabelModal] = useState(false)
  const [newLabelName, setNewLabelName] = useState("")
  const [newLabelColor, setNewLabelColor] = useState("#3B82F6")
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [enableNotifications, setEnableNotifications] = useState(true)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const tabScrollRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkTabScroll = () => {
    if (tabScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabScrollRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5)
    }
  }

  useEffect(() => {
    checkTabScroll()
    const scrollContainer = tabScrollRef.current
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', checkTabScroll)
      window.addEventListener('resize', checkTabScroll)
      return () => {
        scrollContainer.removeEventListener('scroll', checkTabScroll)
        window.removeEventListener('resize', checkTabScroll)
      }
    }
  }, [])

  const scroll = (direction: 'left' | 'right') => {
    if (tabScrollRef.current) {
      const scrollAmount = 150
      tabScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
      setTimeout(checkTabScroll, 300)
    }
  }

  const scrollTabToCenter = (tabName: string) => {
    if (tabScrollRef.current) {
      const buttons = tabScrollRef.current.querySelectorAll('button')
      let targetButton: Element | null = null
      
      buttons.forEach((btn) => {
        if (tabName === 'sessions' && btn.textContent?.includes('Timeline')) {
          targetButton = btn
        } else if (tabName === 'graph' && btn.textContent?.includes('Knowledge')) {
          targetButton = btn
        } else if (tabName === 'projects' && btn.textContent?.includes('Projects')) {
          targetButton = btn
        } else if (tabName === 'focus' && btn.textContent?.includes('Focus')) {
          targetButton = btn
        }
      })

      if (targetButton) {
        const container = tabScrollRef.current
        const containerWidth = container.clientWidth
        const buttonLeft = (targetButton as HTMLElement).offsetLeft
        const buttonWidth = (targetButton as HTMLElement).offsetWidth
        const scrollTarget = buttonLeft - (containerWidth / 2) + (buttonWidth / 2)

        container.scrollTo({
          left: Math.max(0, scrollTarget),
          behavior: 'smooth'
        })
        setTimeout(checkTabScroll, 300)
      }
    }
  }

  useEffect(() => {
    scrollTabToCenter(activeTab)
  }, [activeTab])

  useEffect(() => {
    // Initial load of sessions
    const loadSessions = () => {
      sendMessage<{ sessions: Session[] }>({ type: "GET_SESSIONS" })
        .then((res) => {
          setSessions(res?.sessions ?? [])
        })
        .catch((err) => {
          console.error("Failed to load sessions:", err)
          setError("Failed to load sessions")
        })
    }

    // Load labels once
    sendMessage<{ labels: Label[] }>({ type: "GET_LABELS" })
      .then((res) => {
        setLabels(res?.labels ?? [])
      })
      .catch((err) => {
        console.error("Failed to load labels:", err)
      })

    // Load projects
    const loadProjects = () => {
      sendMessage<{ projects: Project[] }>({ type: "GET_PROJECTS" })
        .then((res) => {
          setProjects(res?.projects ?? [])
        })
        .catch((err) => {
          console.error("Failed to load projects:", err)
        })
    }

    loadSessions()
    loadProjects()

    // Poll for session and project updates every 2 seconds to catch real-time changes
    const pollInterval = setInterval(() => {
        if (activeTab === "sessions") {
            loadSessions()
        }
        if (activeTab === "projects") {
            loadProjects()
        }
    }, 2000)

    // Cleanup: stop polling on unmount
    return () => {
      clearInterval(pollInterval)
    }
  }, [activeTab])

  const pages = useMemo(() => {
    return sessions.flatMap((s) => s.pages)
  }, [sessions])

  // Group real sessions by date (infinite menu)
  const realSessionsByDay = useMemo(() => {
    const grouped: Map<string, { sessions: Session[]; date: Date; label: string }> = new Map()
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // Filter sessions by selected label if one is chosen
    const filteredSessions = selectedLabelId 
      ? sessions.filter((s) => s.labelId === selectedLabelId)
      : sessions

    filteredSessions.forEach((session) => {
      const sessionDate = new Date(session.startTime)
      const sessionDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate())
      const dateKey = sessionDay.toISOString().split('T')[0] // YYYY-MM-DD

      if (!grouped.has(dateKey)) {
        // Generate label: "Today - Monday, December 30" or "Yesterday - Sunday, December 29" or "Monday, December 28"
        let label = ''
        if (sessionDay.getTime() === today.getTime()) {
          const dayName = sessionDay.toLocaleString('en-US', { weekday: 'long' })
          const dateStr = sessionDay.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          label = `Today - ${dayName}, ${dateStr}`
        } else if (sessionDay.getTime() === yesterday.getTime()) {
          const dayName = sessionDay.toLocaleString('en-US', { weekday: 'long' })
          const dateStr = sessionDay.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          label = `Yesterday - ${dayName}, ${dateStr}`
        } else {
          const dayName = sessionDay.toLocaleString('en-US', { weekday: 'long' })
          const dateStr = sessionDay.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          label = `${dayName}, ${dateStr}`
        }

        grouped.set(dateKey, { sessions: [], date: sessionDay, label })
      }

      grouped.get(dateKey)!.sessions.push(session)
    })

    // Sort by date descending (newest first), and sort sessions within each day by startTime descending
    return Array.from(grouped.entries())
      .sort(([, a], [, b]) => b.date.getTime() - a.date.getTime())
      .map(([, data]) => ({
        ...data,
        sessions: data.sessions.sort((a, b) => b.startTime - a.startTime)
      }))
  }, [sessions, selectedLabelId])

  const handleSearch = async (value: string) => {
    setSearchQuery(value)
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    if (!value.trim()) {
      setResults([])
      return
    }

    // Set loading state immediately
    setLoading(true)
    setError(null)
    
    // Debounce: wait 300ms before searching
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await sendMessage<{ results: SearchResult[] }>({
          type: "SEARCH_QUERY",
          payload: { query: value }
        })
        setResults(res?.results ?? [])
      } catch (err) {
        console.error("Search failed:", err)
        setError("Search failed")
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  const handleClose = () => {
    // Send message to content scripts before closing
    console.log("Sidepanel sending SIDEPANEL_CLOSED message")
    chrome.runtime.sendMessage({ type: "SIDEPANEL_CLOSED" })
    // Also set localStorage as fallback
    localStorage.setItem("aegis-sidebar-closed", "true")
    window.close()
  }

  const handleAddLabel = async () => {
    if (!newLabelName.trim()) return
    try {
      const res = await sendMessage<{ label: Label }>({
        type: "ADD_LABEL",
        payload: { name: newLabelName, color: newLabelColor }
      })
      if (res?.label) {
        setLabels([...labels, res.label])
        setNewLabelName("")
        setNewLabelColor("#3B82F6")
        setShowAddLabelModal(false)
      }
    } catch (err) {
      console.error("Failed to add label:", err)
    }
  }

  const handleDeleteLabel = async (labelId: string) => {
    if (!window.confirm("Delete this label? Sessions with this label will no longer have it assigned.")) {
      return
    }
    try {
      await sendMessage<{ success: boolean }>({
        type: "DELETE_LABEL",
        payload: { labelId }
      })
      setLabels(labels.filter((l) => l.id !== labelId))
      // Clear filter if deleted label was selected
      if (selectedLabelId === labelId) {
        setSelectedLabelId(null)
      }
    } catch (err) {
      console.error("Failed to delete label:", err)
    }
  }

  const handleClearAllSessions = async () => {
    if (!window.confirm("Are you sure you want to delete all sessions? This action cannot be undone.")) {
      return
    }
    try {
      await sendMessage<{ success: boolean }>({
        type: "CLEAR_ALL_SESSIONS"
      })
      setSessions([])
      setSelectedLabelId(null)
      setExpandedDays([])
      setExpandedSessions([])
    } catch (err) {
      console.error("Failed to clear sessions:", err)
    }
  }

  const handleClearAllLabels = async () => {
    if (!window.confirm("Are you sure you want to reset all labels to defaults? This action cannot be undone.")) {
      return
    }
    try {
      await sendMessage<{ success: boolean }>({
        type: "RESET_LABELS_TO_DEFAULT"
      })
      const res = await sendMessage<{ labels: Label[] }>({ type: "GET_LABELS" })
      setLabels(res?.labels ?? [])
      setSelectedLabelId(null)
    } catch (err) {
      console.error("Failed to reset labels:", err)
    }
  }

  const handleExportData = async () => {
    try {
      const dataToExport = {
        sessions,
        labels,
        exportedAt: new Date().toISOString()
      }
      const jsonString = JSON.stringify(dataToExport, null, 2)
      const blob = new Blob([jsonString], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `aegis-export-${new Date().getTime()}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Failed to export data:", err)
    }
  }

  const MAX_OPEN_TABS = 10
  const openAllResults = () => {
    if (!results.length) return
    const count = results.length
    const toOpen = results.slice(0, MAX_OPEN_TABS)
    const needsConfirm = count > MAX_OPEN_TABS
    if (needsConfirm) {
      const ok = window.confirm(
        `Open ${count} tabs? For safety, only the first ${MAX_OPEN_TABS} will be opened.`
      )
      if (!ok) return
    }
    toOpen.forEach(({ pageEvent }) => {
      const raw = pageEvent.url || ""
      const url = raw.startsWith("http") ? raw : `https://${raw}`
      try {
        chrome.tabs.create({ url })
      } catch (e) {
        console.error("Failed to open tab:", url, e)
      }
    })
  }



  return (
    <div className="relative h-full flex flex-col" style={{ backgroundColor: '#FFFFFF' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b bg-white" style={{ borderColor: '#E5E5E5' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={onShowEmpty}
            className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none"
            style={{ color: 'var(--gray)' }}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </button>
          <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--primary)' }} />
          <h1 
            className="text-xl font"
            style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
            Aegis
          </h1>
        </div>
        
        {/* Settings Button */}
        <button
          onClick={() => setShowSettingsModal(true)}
          className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none"
          style={{ color: 'var(--gray)' }}>
          <Settings className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </button>
      </div>

      {/* <div className="px-3 pt-2">
        <CoiPanel sessions={sessions} />
      </div> */}

      {/* Tabs with Navigation Arrows */}
      <div className="flex items-center border-b gap-1 px-2" style={{ borderColor: '#E5E5E5' }}>
        {/* Left Arrow */}
        <button
          onClick={() => scroll('left')}
          disabled={!canScrollLeft}
          className="flex-shrink-0 p-1.5 transition-colors rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: '#9A9FA6' }}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Tabs Container */}
        <div 
          ref={tabScrollRef}
          className="overflow-x-hidden flex-1"
          style={{
            scrollBehavior: 'smooth'
          }}>
          <div className="flex gap-1 pt-3 pb-0 whitespace-nowrap">
            <button
              onClick={() => setActiveTab("sessions")}
              className={`px-4 py-2 text-sm font-medium transition-all rounded-t-lg flex-shrink-0 ${
                activeTab === "sessions" ? "" : "opacity-60"
              }`}
              style={{
                backgroundColor: activeTab === "sessions" ? "white" : "transparent",
                color: activeTab === "sessions" ? "#0072de" : "#64748b",
                borderBottom: activeTab === "sessions" ? "2px solid #0072de" : "none",
                fontFamily: "'Breeze Sans'"
              }}>
              Timeline
            </button>
            <button
              onClick={() => setActiveTab("graph")}
              className={`px-4 py-2 text-sm font-medium transition-all rounded-t-lg flex-shrink-0 ${
                activeTab === "graph" ? "" : "opacity-60"
              }`}
              style={{
                backgroundColor: activeTab === "graph" ? "white" : "transparent",
                color: activeTab === "graph" ? "#0072de" : "#64748b",
                borderBottom: activeTab === "graph" ? "2px solid #0072de" : "none",
                fontFamily: "'Breeze Sans'"
              }}>
              Knowledge Graph
            </button>
            <button
              onClick={() => setActiveTab("projects")}
              className={`px-4 py-2 text-sm font-medium transition-all rounded-t-lg flex-shrink-0 ${
                activeTab === "projects" ? "" : "opacity-60"
              }`}
              style={{
                backgroundColor: activeTab === "projects" ? "white" : "transparent",
                color: activeTab === "projects" ? "#0072de" : "#64748b",
                borderBottom: activeTab === "projects" ? "2px solid #0072de" : "none",
                fontFamily: "'Breeze Sans'"
              }}>
              Projects
            </button>
            <button
              onClick={() => setActiveTab("focus")}
              className={`px-4 py-2 text-sm font-medium transition-all rounded-t-lg flex-shrink-0 ${
                activeTab === "focus" ? "" : "opacity-60"
              }`}
              style={{
                backgroundColor: activeTab === "focus" ? "white" : "transparent",
                color: activeTab === "focus" ? "#0072de" : "#64748b",
                borderBottom: activeTab === "focus" ? "2px solid #0072de" : "none",
                fontFamily: "'Breeze Sans'"
              }}>
              Focus Mode
            </button>
          </div>
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scroll('right')}
          disabled={!canScrollRight}
          className="flex-shrink-0 p-1.5 transition-colors rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: '#9A9FA6' }}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col gap-0 overflow-y-auto">
        {activeTab === "graph" ? (
          <div className="p-3">
            <GraphPanel />
          </div>
        ) : activeTab === "projects" ? (
          <div className="p-3">
            <ProjectsPanel 
              projects={projects} 
              sessions={sessions}
              expandedProjects={expandedProjects}
              onToggleProject={(projectId) => {
                setExpandedProjects((prev) =>
                  prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]
                )
              }}
              onDetectProjects={async () => {
                try {
                  const response = await sendMessage<{ projects: Project[] }>({ 
                    type: "DETECT_PROJECTS" 
                  })
                  if (response?.projects) {
                    setProjects(response.projects)
                  }
                } catch (err) {
                  console.error("Failed to detect projects:", err)
                }
              }}
              onUpdateProject={async (projectId, updates) => {
                try {
                  await sendMessage({
                    type: "UPDATE_PROJECT",
                    payload: { projectId, updates }
                  })
                  // Reload projects
                  const response = await sendMessage<{ projects: Project[] }>({ 
                    type: "GET_PROJECTS" 
                  })
                  if (response?.projects) {
                    setProjects(response.projects)
                  }
                } catch (err) {
                  console.error("Failed to update project:", err)
                }
              }}
              onDeleteProject={async (projectId) => {
                try {
                  await sendMessage({
                    type: "DELETE_PROJECT",
                    payload: { projectId }
                  })
                  // Reload projects
                  const response = await sendMessage<{ projects: Project[] }>({ 
                    type: "GET_PROJECTS" 
                  })
                  if (response?.projects) {
                    setProjects(response.projects)
                  }
                } catch (err) {
                  console.error("Failed to delete project:", err)
                }
              }}
            />
          </div>
        ) : activeTab === "focus" ? (
          <FocusPanel />
        ) : (
          <>
        {/* Sticky Search Bar Only */}
        <div className="sticky top-0 z-20 bg-white px-2 pt-4 pb-2 -mx-0">
          {/* Back Button and Search Bar */}
          <div className="flex items-center gap-2 mb-5">
            {/* <button className="p-2" onClick={onShowEmpty} style={{ color: '#9A9FA6' }}>
              <ArrowLeft className="h-4 w-4" />
            </button> */}
            <div className="relative flex items-center gap-3 px-4 py-2.5 rounded-full flex-1" style={{ backgroundColor: '#F5F5F5' }}>
              <Search className="h-4 w-4" style={{ color: '#9A9FA6' }} />
              <input
                type="text"
                placeholder="Search what you have seen before"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}
              />
            </div>
          </div>
        </div>

        {/* Scrollable Filters Section */}
        <div className="bg-white px-2 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Show first 3 labels or all if expanded */}
            {labels.slice(0, expandFilters ? labels.length : 3).map((label) => (
              <button
                key={label.id}
                onClick={() => {
                  setSelectedLabelId(selectedLabelId === label.id ? null : label.id)
                }}
                className="px-4 py-2 rounded-full text-xs font-medium transition-all"
                style={{
                  backgroundColor: selectedLabelId === label.id ? (label.color || '#000000') : '#FFFFFF',
                  color: selectedLabelId === label.id ? '#FFFFFF' : '#000000',
                  border: `1px solid ${label.color || '#000000'}`,
                  fontFamily: "'Breeze Sans'",
                }}>
                {label.name}
              </button>
            ))}

            {/* Add Label Button */}
            <button
              onClick={() => setShowAddLabelModal(true)}
              className="px-3 py-2 rounded-full text-xs font-medium transition-all"
              style={{
                backgroundColor: '#F5F5F5',
                color: '#666',
                border: '1px dashed #CCC',
                fontFamily: "'Breeze Sans'",
              }}>
              + Add
            </button>

            {/* More/Less button */}
            {labels.length > 3 && (
              <button
                onClick={() => setExpandFilters(!expandFilters)}
                className="inline-flex items-center gap-1 text-xs font-medium transition-colors ml-auto"
                style={{ color: '#000000', fontFamily: "'Breeze Sans'" }}>
                {expandFilters ? "Less" : "More"}
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${expandFilters ? "rotate-180" : ""}`}
                />
              </button>
            )}
          </div>
        </div>
            {/* dev: number of pages indexed */}
          {/* <div className="flex items-center justify-between px-1 text-xs" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
            <span>{pages.length} pages indexed</span>
          </div> */}
          {error && (
            <div className="mt-1 px-2 text-xs" style={{ color: '#b00020', fontFamily: "'Breeze Sans'" }}>
              {error}
            </div>
          )}

        {/* Search Results or Timeline */}
        {searchQuery.trim() ? (
          <div className="flex flex-col gap-2 p-2">
            {results.length > 0 && (
              <div className="flex items-center justify-end pb-1">
                <button
                  onClick={openAllResults}
                  className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
                  style={{ backgroundColor: '#0074FB', color: 'white', fontFamily: "'Breeze Sans'" }}
                >
                  Open all ({Math.min(results.length, MAX_OPEN_TABS)}/{results.length})
                </button>
              </div>
            )}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="flex gap-1">
                  <div
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{ backgroundColor: '#0074FB', animationDelay: '0ms' }}
                  />
                  <div
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{ backgroundColor: '#0074FB', animationDelay: '150ms' }}
                  />
                  <div
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{ backgroundColor: '#0074FB', animationDelay: '300ms' }}
                  />
                </div>
                <p className="text-xs" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
                  Searching...
                </p>
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Search className="h-8 w-8 opacity-30 mb-2" style={{ color: '#9A9FA6' }} />
                <p className="text-sm" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
                  No results found.
                </p>
              </div>
            ) : null}
            {results.map((item, idx) => {
              const { pageEvent, score, layer } = item
              const opened = pageEvent.openedAt || pageEvent.timestamp
              const openedText = new Date(opened).toLocaleString()
              return (
                <div
                  key={`${pageEvent.url}-${opened}-${idx}`}
                  className="flex flex-col gap-1 p-2 rounded-lg"
                  style={{ backgroundColor: '#FAFAFA', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold truncate" style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
                      {pageEvent.title || pageEvent.url}
                    </div>
                    <span className="text-2xs px-2 py-0.5 rounded" style={{ backgroundColor: '#E8E8E8', color: '#555', fontSize: '10px' }}>
                      {layer} {score ? `• ${score.toFixed(3)}` : ""}
                    </span>
                  </div>
                  <div className="text-xs truncate" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
                    {pageEvent.url}
                  </div>
                  <div className="text-2xs" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'", fontSize: '10px' }}>
                    Opened: {openedText}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col p-0.5">
            {realSessionsByDay.map((dayGroup, dayIndex) => (
              <DaySection
                key={dayGroup.label}
                dayKey={dayGroup.label}
                dayLabel={dayGroup.label}
                sessions={dayGroup.sessions}
                isExpanded={expandedDays.includes(dayGroup.label)}
                onToggleDay={(key) => {
                  setExpandedDays((prev) =>
                    prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
                  )
                }}
                expandedSessions={expandedSessions}
                onToggleSession={(id) => {
                  setExpandedSessions((prev) =>
                    prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
                  )
                }}                labels={labels}
                onUpdateSessionLabel={async (sessionId, labelId) => {
                  try {
                    await sendMessage<{ success: boolean }>({
                      type: "UPDATE_SESSION_LABEL",
                      payload: { sessionId, labelId }
                    })
                  } catch (err) {
                    console.error("Failed to update session label:", err)
                  }
                }}
                onDeleteLabel={handleDeleteLabel}
              />
            ))}
          </div>
        )}
        </>
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 border-t bg-white px-4 py-3" style={{ borderColor: '#E5E5E5' }}>
        <button
          onClick={onShowEmpty}
          className="w-full text-xs opacity-70 transition-opacity hover:opacity-100"
          style={{ color: 'var(--gray)', fontFamily: "'Breeze Sans'" }}>
          ← Back to empty state
        </button>
      </div>
      {showAddLabelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-80 shadow-lg">
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
              Create New Label
            </h2>
            
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium" style={{ color: '#666', fontFamily: "'Breeze Sans'" }}>
                  Label Name
                </label>
                <input
                  type="text"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="e.g., Project X"
                  className="w-full mt-2 px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500"
                  style={{ borderColor: '#DDD', fontFamily: "'Breeze Sans'" }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddLabel()
                    }
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-medium" style={{ color: '#666', fontFamily: "'Breeze Sans'" }}>
                  Color
                </label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="color"
                    value={newLabelColor}
                    onChange={(e) => setNewLabelColor(e.target.value)}
                    className="w-12 h-10 border rounded cursor-pointer"
                    style={{ borderColor: '#DDD' }}
                  />
                  <span className="text-xs" style={{ color: '#666' }}>
                    {newLabelColor}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowAddLabelModal(false)
                    setNewLabelName("")
                    setNewLabelColor("#3B82F6")
                  }}
                  className="px-4 py-2 text-xs rounded-lg transition-colors"
                  style={{
                    backgroundColor: '#F5F5F5',
                    color: '#666',
                    fontFamily: "'Breeze Sans'",
                  }}>
                  Cancel
                </button>
                <button
                  onClick={handleAddLabel}
                  disabled={!newLabelName.trim()}
                  className="px-4 py-2 text-xs rounded-lg text-white transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: newLabelName.trim() ? '#0072DE' : '#CCC',
                    fontFamily: "'Breeze Sans'",
                  }}>
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold" style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
                Settings
              </h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 hover:bg-blue-100 rounded transition-colors"
                style={{ color: '#0072df' }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Preferences Section */}
              <div className="pb-4 border-b" style={{ borderColor: '#E5E5E5' }}>
                <h3 className="text-sm font-normal mb-3" style={{ color: '#0072df', fontFamily: "'Breeze Sans'" }}>
                  Preferences
                </h3>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setDarkMode(!darkMode)}
                    className="w-full text-left px-4 py-3 rounded-lg text-sm transition-all hover:bg-gray-50 border flex items-center justify-between"
                    style={{ 
                      color: '#080A0B', 
                      fontFamily: "'Breeze Sans'",
                      borderColor: '#E5E5E5',
                      backgroundColor: '#FFFFFF'
                    }}>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m6.364 1.636l-.707-.707M21 12h-1m1.364 6.364l-.707-.707M12 21v1m-6.364-1.636l.707-.707M3 12h1M3.636 5.636l.707-.707" />
                        </svg>
                        Dark Mode
                      </div>
                      <div className="text-xs" style={{ color: '#9A9FA6', marginTop: '4px' }}>
                        Toggle dark theme
                      </div>
                    </div>
                    <div 
                      style={{ 
                        width: '40px', 
                        height: '20px', 
                        backgroundColor: darkMode ? '#0072df' : '#E5E5E5', 
                        borderRadius: '10px',
                        transition: 'background-color 0.3s',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: darkMode ? '20px' : '2px'
                      }}>
                      <div 
                        style={{ 
                          width: '16px', 
                          height: '16px', 
                          backgroundColor: 'white', 
                          borderRadius: '50%',
                          transition: 'all 0.3s'
                        }} 
                      />
                    </div>
                  </button>
                  <button
                    onClick={() => setEnableNotifications(!enableNotifications)}
                    className="w-full text-left px-4 py-3 rounded-lg text-sm transition-all hover:bg-gray-50 border flex items-center justify-between"
                    style={{ 
                      color: '#080A0B', 
                      fontFamily: "'Breeze Sans'",
                      borderColor: '#E5E5E5',
                      backgroundColor: '#FFFFFF'
                    }}>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        Notifications
                      </div>
                      <div className="text-xs" style={{ color: '#9A9FA6', marginTop: '4px' }}>
                        Enable notifications for similar content
                      </div>
                    </div>
                    <div 
                      style={{ 
                        width: '40px', 
                        height: '20px', 
                        backgroundColor: enableNotifications ? '#0072df' : '#E5E5E5', 
                        borderRadius: '10px',
                        transition: 'background-color 0.3s',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: enableNotifications ? '20px' : '2px'
                      }}>
                      <div 
                        style={{ 
                          width: '16px', 
                          height: '16px', 
                          backgroundColor: 'white', 
                          borderRadius: '50%',
                          transition: 'all 0.3s'
                        }} 
                      />
                    </div>
                  </button>
                </div>
              </div>

              {/* Data Management Section */}
              <div className="pb-4 border-b" style={{ borderColor: '#E5E5E5' }}>
                <h3 className="text-sm font-normal mb-3" style={{ color: '#0072df', fontFamily: "'Breeze Sans'" }}>
                  Data Management
                </h3>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      handleClearAllSessions()
                      setShowSettingsModal(false)
                    }}
                    className="w-full text-left px-4 py-3 rounded-lg text-sm transition-all hover:bg-gray-50 border"
                    style={{ 
                      color: '#080A0B', 
                      fontFamily: "'Breeze Sans'",
                      borderColor: '#E5E5E5',
                      backgroundColor: '#FFFFFF'
                    }}>
                    <div className="font-medium flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Clear All Sessions
                    </div>
                    <div className="text-xs" style={{ color: '#9A9FA6', marginTop: '4px' }}>
                      Permanently delete all recorded sessions
                    </div>
                  </button>
                </div>
              </div>

              {/* Labels Section */}
              <div className="pb-4 border-b" style={{ borderColor: '#E5E5E5' }}>
                <h3 className="text-sm font-normal mb-3" style={{ color: '#0072df', fontFamily: "'Breeze Sans'" }}>
                  Labels
                </h3>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      handleClearAllLabels()
                      setShowSettingsModal(false)
                    }}
                    className="w-full text-left px-4 py-3 rounded-lg text-sm transition-all hover:bg-gray-50 border"
                    style={{ 
                      color: '#080A0B', 
                      fontFamily: "'Breeze Sans'",
                      borderColor: '#E5E5E5',
                      backgroundColor: '#FFFFFF'
                    }}>
                    <div className="font-medium flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Reset Labels to Default
                    </div>
                    <div className="text-xs" style={{ color: '#9A9FA6', marginTop: '4px' }}>
                      Restore default label set and remove custom labels
                    </div>
                  </button>
                </div>
              </div>

              {/* About Section */}
              <div>
                <h3 className="text-sm font-normal mb-3" style={{ color: '#0072df', fontFamily: "'Breeze Sans'" }}>
                  About
                </h3>
                <div className="px-4 py-3 rounded-lg border" style={{ backgroundColor: '#F5F5F5', borderColor: '#E5E5E5' }}>
                  <div className="text-xs" style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span style={{ color: '#9A9FA6' }}>Sessions recorded:</span>
                      <span className="font-normal" style={{ fontSize: '0.875rem', color: '#080A0B' }}>{sessions.length}</span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span style={{ color: '#9A9FA6' }}>Total labels:</span>
                      <span className="font-normal" style={{ fontSize: '0.875rem', color: '#080A0B' }}>{labels.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ color: '#9A9FA6' }}>Pages indexed:</span>
                      <span className="font-normal" style={{ fontSize: '0.875rem', color: '#080A0B' }}>{pages.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 text-xs rounded-lg transition-all font-medium border"
                style={{
                  backgroundColor: '#0072df',
                  color: '#FFFFFF',
                  fontFamily: "'Breeze Sans'",
                  borderColor: '#0072df'
                }}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Day Section Component (for actual sessions from IndexedDB)
interface DaySectionProps {
  dayKey: string
  dayLabel: string
  sessions: Session[]
  isExpanded: boolean
  onToggleDay: (key: string) => void
  expandedSessions: string[]
  onToggleSession: (id: string) => void
  labels: Label[]
  onUpdateSessionLabel: (sessionId: string, labelId: string | undefined) => Promise<void>
  onDeleteLabel: (labelId: string) => Promise<void>
}

function DaySection({
  dayKey,
  dayLabel,
  sessions,
  isExpanded,
  onToggleDay,
  expandedSessions,
  onToggleSession,
  labels,
  onUpdateSessionLabel,
  onDeleteLabel,
}: DaySectionProps) {
  const visibleCount = isExpanded ? sessions.length : 3

  return (
    <div className="flex flex-col gap-3 pb-0 pt-1 p-2">
      {/* Day Header */}
      <div className="text-sm font-normal px-2 mb-2" style={{ color: '#0072DF', fontFamily: "'Breeze Sans'" }}>
        <span>{dayLabel}</span>
      </div>

      {/* Sessions List */}
      <div className="flex flex-col gap-3 pt-0">
        {sessions.slice(0, visibleCount).map((session, index) => (
          <div
            key={session.id}
            className="animate-in fade-in slide-in-from-bottom-2 duration-300"
            style={{ animationDelay: `${index * 50}ms` }}>
            <SessionItem
              session={session}
              isExpanded={expandedSessions.includes(session.id)}
              onToggle={() => onToggleSession(session.id)}
              labels={labels}
              onUpdateSessionLabel={async (sessionId, labelId) => {
                try {
                  await sendMessage<{ success: boolean }>({
                    type: "UPDATE_SESSION_LABEL",
                    payload: { sessionId, labelId }
                  })
                } catch (err) {
                  console.error("Failed to update session label:", err)
                }
              }}
              onDeleteLabel={onDeleteLabel}
            />
          </div>
        ))}
        {sessions.length > 3 && (
          <button
            onClick={() => onToggleDay(dayKey)}
            className="text-xs font-medium self-end px-3 py-0.5 rounded-lg transition-all hover:opacity-70 hover:scale-105"
            style={{
              color: 'var(--primary)',
              fontFamily: "'Breeze Sans'",
              backgroundColor: 'transparent'
            }}>
            {isExpanded ? "Less" : "More"}
          </button>
        )}
      </div>
    </div>
  )
}

// Session Item Component (for actual sessions from IndexedDB)
interface SessionItemProps {
  session: Session
  isExpanded: boolean
  onToggle: () => void
  labels: Label[]
  onUpdateSessionLabel: (sessionId: string, labelId: string | undefined) => void
  onDeleteLabel?: (labelId: string) => Promise<void>
}

function SessionItem({ session, isExpanded, onToggle, labels, onUpdateSessionLabel, onDeleteLabel }: SessionItemProps) {
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null)
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const timeStart = new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const timeEnd = new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const domains = [...new Set(session.pages.map((p) => new URL(p.url).hostname.replace('www.', '')))].slice(0, 3)
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openMenuIndex !== null) {
        setOpenMenuIndex(null)
      }
    }
    
    if (openMenuIndex !== null) {
      document.addEventListener('click', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [openMenuIndex])
  
  // Generate a title from the most common domain or first page
  const sessionTitle = session.inferredTitle || (session.pages.length > 0 
    ? (session.pages[0]?.title || domains[0] || "Session")
    : "Session")

  return (
    <div 
      onClick={onToggle}
      className="flex flex-col gap-1.5 p-3 rounded-xl transition-all cursor-pointer"
      style={{ 
        backgroundColor: isExpanded ? '#F5F5F5' : '#FFFFFF',
        border: '1px solid #BCBCBC'
      }}>
      {/* Session Header */}
      <div className="flex items-center gap-2 w-full">
        <div className="flex items-center gap-3 flex-1">
          <p
            className="text-sm font-medium leading-tight"
            style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
            {sessionTitle}
          </p>
          {/* Reload Session Icon */}
          <button
            onClick={async (e) => {
              e.stopPropagation()
              // Open all pages from the session in a new tab group
              const tabIds: number[] = []
              
              for (const page of session.pages) {
                const tab = await chrome.tabs.create({ url: page.url })
                if (tab.id) tabIds.push(tab.id)
              }
              
              // Create a tab group with the session title
              if (tabIds.length > 0) {
                const groupId = await chrome.tabs.group({ tabIds })
                chrome.tabGroups.update(groupId, { 
                  title: sessionTitle,
                  collapsed: false
                }).catch((error) => {
                  console.error('Failed to update tab group:', error)
                })
              }
            }}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            style={{ color: '#9A9FA6' }}>
            <ExternalLink className="h-4 w-4" />
          </button>
          {/* Label Selector */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowLabelPicker(!showLabelPicker)
              }}
              className="px-2 py-1 text-xs rounded transition-colors"
              style={{
                backgroundColor: session.labelId 
                  ? (labels.find(l => l.id === session.labelId)?.color || '#E8E8E8')
                  : '#E8E8E8',
                color: session.labelId ? '#FFFFFF' : '#666',
                fontFamily: "'Breeze Sans'",
              }}>
              {session.labelId ? labels.find(l => l.id === session.labelId)?.name || 'Label' : 'Label'}
            </button>
            {showLabelPicker && (
              <div
                className="absolute top-full left-0 mt-1 z-20 bg-white rounded-lg py-1 min-w-[200px]"
                style={{
                  border: '1px solid #E5E5E5',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                }}
                onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => {
                    onUpdateSessionLabel(session.id, undefined)
                    setShowLabelPicker(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 transition-colors"
                  style={{ color: '#666', fontFamily: "'Breeze Sans'" }}>
                  No label
                </button>
                {labels.map((label) => (
                  <div
                    key={label.id}
                    className="flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-100 transition-colors group">
                    <button
                      onClick={() => {
                        onUpdateSessionLabel(session.id, label.id)
                        setShowLabelPicker(false)
                      }}
                      className="flex-1 text-left flex items-center gap-2"
                      style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: label.color || '#000' }}
                      />
                      {label.name}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (onDeleteLabel) {
                          onDeleteLabel(label.id)
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-red-100 rounded ml-1"
                      title="Delete label"
                      style={{ color: '#9A9FA6' }}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Expand/Collapse Icon */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className="p-1 hover:bg-gray-100 rounded transition-colors">
          <ChevronDown
            className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            style={{ color: '#9A9FA6' }}
          />
        </button>
      </div>

      {/* Links List */}
      {isExpanded && (
        <div className="flex flex-col gap-1 pt-2" onClick={(e) => e.stopPropagation()}>
          {/* Individual Links */}
          {session.pages
            .slice()
            .sort((a, b) => (b.timestamp || b.openedAt) - (a.timestamp || a.openedAt))
            .map((page, index) => {
            // Generate a time for each page based on timestamp or index
            const pageTime = page.openedAt || page.timestamp
            const timeStr = new Date(pageTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

            return (
              <div key={index} className="relative flex items-center justify-between gap-3 py-1">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenMenuIndex(openMenuIndex === index ? null : index)
                    }}
                    className="hover:bg-gray-200 rounded p-0.5 transition-colors">
                    <MoreVertical className="h-3.5 w-3.5" style={{ color: '#9A9FA6' }} />
                  </button>
                  <a
                    href={page.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs leading-tight truncate flex-1"
                    style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
                    {page.title}
                  </a>
                </div>
                <span className="text-xs flex-shrink-0" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
                  {timeStr}
                </span>

                {/* Dropdown Menu */}
                {openMenuIndex === index && (
                  <div
                    className="absolute left-6 top-6 z-30 bg-white rounded-xl py-2 min-w-[200px]"
                    style={{ 
                      border: '1px solid #E5E5E5',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
                    }}
                    onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        window.open(page.url, '_blank')
                        setOpenMenuIndex(null)
                      }}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center gap-3"
                      style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
                      <ExternalLinkIcon className="h-3.5 w-3.5" style={{ color: '#9A9FA6' }} />
                      <span>Open in new tab</span>
                    </button>
                    <button
                      onClick={() => {
                        window.open(page.url, '_blank', 'noopener,noreferrer')
                        setOpenMenuIndex(null)
                      }}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center gap-3"
                      style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
                      <ExternalLinkIcon className="h-3.5 w-3.5" style={{ color: '#9A9FA6' }} />
                      <span>Open in new window</span>
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(page.url)
                        setOpenMenuIndex(null)
                      }}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center gap-3"
                      style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
                      <Copy className="h-3.5 w-3.5" style={{ color: '#9A9FA6' }} />
                      <span>Copy link</span>
                    </button>
                    <div className="h-px mx-2 my-1" style={{ backgroundColor: '#E5E5E5' }} />
                    <button
                      onClick={() => {
                        // Delete functionality would be implemented here
                        console.log('Delete from session:', page.url)
                        setOpenMenuIndex(null)
                      }}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-red-50 transition-colors flex items-center gap-3"
                      style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
                      <Trash2 className="h-3.5 w-3.5" style={{ color: '#9A9FA6' }} />
                      <span>Delete from session</span>
                    </button>
                    <button
                      onClick={() => {
                        chrome.windows.create({ url: page.url, incognito: true })
                        setOpenMenuIndex(null)
                      }}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center gap-3"
                      style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
                      <EyeOff className="h-3.5 w-3.5" style={{ color: '#9A9FA6' }} />
                      <span>Open in incognito</span>
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Projects Panel Component
interface ProjectsPanelProps {
  projects: Project[]
  sessions: Session[]
  expandedProjects: string[]
  onToggleProject: (projectId: string) => void
  onDetectProjects: () => Promise<void>
  onUpdateProject: (projectId: string, updates: Partial<Project>) => Promise<void>
  onDeleteProject: (projectId: string) => Promise<void>
}

function ProjectsPanel({
  projects,
  sessions,
  expandedProjects,
  onToggleProject,
  onDetectProjects,
  onUpdateProject,
  onDeleteProject
}: ProjectsPanelProps) {
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  const handleStartEdit = (project: Project) => {
    setEditingProjectId(project.id)
    setEditName(project.name)
  }

  const handleSaveEdit = async (projectId: string) => {
    if (editName.trim()) {
      await onUpdateProject(projectId, { name: editName.trim() })
    }
    setEditingProjectId(null)
    setEditName("")
  }

  const handleCancelEdit = () => {
    setEditingProjectId(null)
    setEditName("")
  }

  const handleDelete = async (projectId: string) => {
    if (window.confirm("Delete this project? Sessions will not be deleted.")) {
      await onDeleteProject(projectId)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header with Detect Button */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
            Projects
          </h2>
          <p className="text-xs" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
            {projects.length === 0 ? "No projects detected yet" : `${projects.length} project${projects.length === 1 ? '' : 's'} found`}
          </p>
        </div>
      </div>

      {/* Projects List */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Folder className="h-12 w-12 opacity-30" style={{ color: '#9A9FA6' }} />
          <div className="text-center">
            <p className="text-sm mb-1" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
              No projects found
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {projects
            .sort((a, b) => b.startDate - a.startDate)
            .map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                sessions={sessions.filter(s => project.sessionIds.includes(s.id))}
                isExpanded={expandedProjects.includes(project.id)}
                onToggle={() => onToggleProject(project.id)}
                isEditing={editingProjectId === project.id}
                editName={editName}
                onEditNameChange={setEditName}
                onStartEdit={() => handleStartEdit(project)}
                onSaveEdit={() => handleSaveEdit(project.id)}
                onCancelEdit={handleCancelEdit}
                onDelete={() => handleDelete(project.id)}
              />
            ))}
        </div>
      )}
    </div>
  )
}

// Project Card Component
interface ProjectCardProps {
  project: Project
  sessions: Session[]
  isExpanded: boolean
  onToggle: () => void
  isEditing: boolean
  editName: string
  onEditNameChange: (name: string) => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
}

function ProjectCard({
  project,
  sessions,
  isExpanded,
  onToggle,
  isEditing,
  editName,
  onEditNameChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete
}: ProjectCardProps) {
  const [editingDescription, setEditingDescription] = useState(false)
  const [editDescriptionValue, setEditDescriptionValue] = useState(project.description || "")

  const duration = Math.ceil((project.endDate - project.startDate) / (1000 * 60 * 60 * 24))
  const startDateStr = new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endDateStr = new Date(project.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const handleSaveDescription = async () => {
    console.log("Save description:", editDescriptionValue)
    
    // Update project with new description
    const updatedProject = {
      ...project,
      description: editDescriptionValue
    }
    
    // Get all projects and replace the current one
    const projects = await chrome.storage.local.get("aegis-projects")
    const allProjects = projects["aegis-projects"] || []
    const updatedProjects = allProjects.map((p: any) => 
      p.id === project.id ? updatedProject : p
    )
    
    // Save back to storage
    await chrome.storage.local.set({ "aegis-projects": updatedProjects })
    
    setEditingDescription(false)
  }

  const handleCancelDescription = () => {
    setEditDescriptionValue(project.description || "")
    setEditingDescription(false)
  }

  return (
    <div
      className="flex flex-col rounded-xl p-4 cursor-pointer transition-all hover:shadow-md"
      style={{ 
        backgroundColor: '#FAFAFA',
        border: '1px solid #E5E5E5'
      }}
      onClick={onToggle}>
      
      {/* Project Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Folder className="h-4 w-4 flex-shrink-0" style={{ color: '#0074FB' }} />
              <input
                type="text"
                value={editName}
                onChange={(e) => onEditNameChange(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1 text-sm font-semibold rounded border"
                style={{ 
                  color: 'var(--dark)', 
                  fontFamily: "'Breeze Sans'",
                  borderColor: '#0074FB'
                }}
                autoFocus
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <Folder className="h-4 w-4 flex-shrink-0" style={{ color: '#0074FB' }} />
              <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
                {project.name}
              </h3>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {isEditing ? (
            <>
              <button
                onClick={onSaveEdit}
                className="px-2 py-1 rounded text-xs font-medium"
                style={{ backgroundColor: '#0074FB', color: 'white' }}>
                Save
              </button>
              <button
                onClick={onCancelEdit}
                className="px-2 py-1 rounded text-xs font-medium"
                style={{ backgroundColor: '#E5E5E5', color: '#080A0B' }}>
                Cancel
              </button>
            </>
          ) : (
            <>
              {/* Auto-detected Badge */}
              {project.autoDetected && (
                <span
                  className="px-2 py-0.5 rounded text-2xs font-medium whitespace-nowrap"
                  style={{ 
                    backgroundColor: '#F3E8FF', 
                    color: '#6B21A8',
                    fontSize: '10px',
                    fontFamily: "'Breeze Sans'"
                  }}>
                  auto
                </span>
              )}
              
              {/* Edit Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onStartEdit()
                }}
                className="hover:bg-gray-200 rounded p-1 transition-colors"
                title="Edit project">
                <Edit2 className="h-3.5 w-3.5" style={{ color: '#9A9FA6' }} />
              </button>
              
              {/* Open All Sites as Tab Group */}
              {project.sites && project.sites.length > 0 && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation()
                    
                    // Open all sites in new tabs
                    const tabIds: number[] = []
                    for (const site of project.sites) {
                      const url = site.url.startsWith('http') ? site.url : `https://${site.url}`
                      const tab = await chrome.tabs.create({ url })
                      if (tab.id) tabIds.push(tab.id)
                    }
                    
                    // Create a tab group with the project name
                    if (tabIds.length > 0) {
                      const groupId = await chrome.tabs.group({ tabIds })
                      chrome.tabGroups.update(groupId, {
                        title: project.name,
                        collapsed: false
                      }).catch((error) => {
                        console.error('Failed to update tab group:', error)
                      })
                    }
                  }}
                  className="hover:bg-gray-200 rounded p-1 transition-colors"
                  title="Open all sites in a tab group">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#9A9FA6' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              )}
              
              {/* Delete Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                className="hover:bg-red-100 rounded p-1 transition-colors"
                title="Delete project">
                <Trash2 className="h-3.5 w-3.5" style={{ color: '#9A9FA6' }} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Project Metadata */}
      <div className="flex flex-wrap items-center gap-3 text-xs mb-2" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>{duration} day{duration === 1 ? '' : 's'} • {startDateStr} - {endDateStr}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{project.sessionIds.length} session{project.sessionIds.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      {/* Keywords */}
      {project.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {project.keywords.slice(0, 5).map((keyword, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 rounded text-2xs"
              style={{ 
                backgroundColor: '#E8E8E8', 
                color: '#555',
                fontSize: '10px',
                fontFamily: "'Breeze Sans'"
              }}>
              {keyword}
            </span>
          ))}
          {project.keywords.length > 5 && (
            <span
              className="px-2 py-0.5 rounded text-2xs"
              style={{ 
                backgroundColor: '#E8E8E8', 
                color: '#555',
                fontSize: '10px',
                fontFamily: "'Breeze Sans'"
              }}>
              +{project.keywords.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Top Domains */}
      {project.topDomains.length > 0 && (
        <div className="flex items-center gap-2 text-2xs mb-2" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'", fontSize: '10px' }}>
          <Tag className="h-3 w-3" />
          <span>{project.topDomains.slice(0, 3).join(', ')}</span>
        </div>
      )}

      {/* Description */}
      {editingDescription ? (
        <div className="flex flex-col gap-2 mb-2" onClick={(e) => e.stopPropagation()}>
          <textarea
            value={editDescriptionValue}
            onChange={(e) => setEditDescriptionValue(e.target.value)}
            className="flex-1 px-2 py-1 text-xs rounded border"
            style={{ 
              color: 'var(--dark)', 
              fontFamily: "'Breeze Sans'",
              borderColor: '#0074FB',
              resize: 'vertical',
              minHeight: '60px'
            }}
            autoFocus
          />
          <div className="flex items-center gap-1">
            <button
              onClick={handleSaveDescription}
              className="px-2 py-1 rounded text-xs font-medium"
              style={{ backgroundColor: '#0074FB', color: 'white' }}>
              Save
            </button>
            <button
              onClick={handleCancelDescription}
              className="px-2 py-1 rounded text-xs font-medium"
              style={{ backgroundColor: '#E5E5E5', color: '#080A0B' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : project.description ? (
        <div 
          className="flex items-start justify-between gap-2 mb-2 p-2 rounded group hover:bg-gray-100 transition-colors"
          style={{ backgroundColor: '#FAFAFA' }}
          onClick={(e) => e.stopPropagation()}>
          <p className="text-xs flex-1" style={{ color: '#64748b', fontFamily: "'Breeze Sans'" }}>
            {project.description}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setEditingDescription(true)
              setEditDescriptionValue(project.description || "")
            }}
            className="hover:bg-gray-200 rounded p-1 transition-all flex-shrink-0"
            title="Edit description">
            <Edit2 className="h-3 w-3" style={{ color: '#9A9FA6' }} />
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setEditingDescription(true)
            setEditDescriptionValue("")
          }}
          className="text-xs mb-2 px-2 py-1 rounded text-left transition-colors hover:bg-gray-100"
          style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
          + Add description
        </button>
      )}

      {/* Confidence Score */}
      {project.autoDetected && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#E5E5E5' }}>
            <div
              className="h-full transition-all"
              style={{ 
                width: `${project.score}%`,
                backgroundColor: project.score >= 70 ? '#2E7D32' : project.score >= 50 ? '#E65100' : '#9A9FA6'
              }}
            />
          </div>
          <span className="text-2xs" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'", fontSize: '10px' }}>
            {project.score}% confidence
          </span>
        </div>
      )}

      {/* Sites List (shown when expanded) */}
      {isExpanded && project.sites && project.sites.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-3 pb-3 border-b" style={{ borderColor: '#E5E5E5' }}>
          <h4 className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Sites ({project.sites.length})
          </h4>
          {project.sites
            .sort((a, b) => b.addedAt - a.addedAt)
            .slice(0, isExpanded ? project.sites.length : 3)
            .map((site, index) => {
              const domain = new URL(site.url.startsWith('http') ? site.url : `https://${site.url}`).hostname
              const timeAgo = (() => {
                const now = Date.now()
                const diff = now - site.addedAt
                const minutes = Math.floor(diff / 60000)
                const hours = Math.floor(diff / 3600000)
                const days = Math.floor(diff / 86400000)
                
                if (days > 0) return `${days}d ago`
                if (hours > 0) return `${hours}h ago`
                if (minutes > 0) return `${minutes}m ago`
                return 'just now'
              })()

              return (
                <div
                  key={`${site.url}-${index}`}
                  className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 transition-colors cursor-pointer"
                  style={{ backgroundColor: '#FAFAFA', border: '1px solid #E5E5E5' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    const fullUrl = site.url.startsWith('http') ? site.url : `https://${site.url}`
                    chrome.tabs.create({ url: fullUrl })
                  }}
                  title={`Open ${site.url}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate mb-0.5" style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'", fontWeight: 500 }}>
                      {site.title}
                    </p>
                    <p className="text-2xs truncate flex items-center gap-1.5" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'", fontSize: '10px' }}>
                      <span>{domain}</span>
                      <span>•</span>
                      <span>{timeAgo}</span>
                      {site.addedBy === 'auto' && (
                        <>
                          <span>•</span>
                          <span style={{ color: '#667eea' }}>auto</span>
                        </>
                      )}
                    </p>
                  </div>
                  <svg className="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#9A9FA6' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
              )
            })}
          {!isExpanded && project.sites.length > 3 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggle()
              }}
              className="text-2xs py-1 px-2 rounded text-left transition-colors hover:bg-gray-100"
              style={{ color: '#667eea', fontFamily: "'Breeze Sans'", fontSize: '10px' }}>
              + {project.sites.length - 3} more site{project.sites.length - 3 === 1 ? '' : 's'}
            </button>
          )}    
        </div>
      )}

      {/* Expand Icon */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        className="flex items-center justify-center w-full pt-2 border-t hover:bg-gray-50 transition-colors"
        style={{ borderColor: '#E5E5E5' }}>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          style={{ color: '#9A9FA6' }}
        />
      </button>
    </div>
  )
}

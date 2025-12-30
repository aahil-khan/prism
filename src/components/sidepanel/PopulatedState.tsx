import { X, Search, ChevronDown, Settings, ArrowLeft, ExternalLink, MoreVertical, ExternalLinkIcon, Copy, Trash2, EyeOff } from "lucide-react"
import { useEffect, useMemo, useState, useRef } from "react"
import type { PageEvent } from "~/types/page-event"
import type { Session } from "~/types/session"
import { CoiPanel } from "./CoiPanel"
import { GraphPanel } from "./GraphPanel"

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
}

export function PopulatedState({ onShowEmpty }: PopulatedStateProps) {
  const [activeTab, setActiveTab] = useState<"sessions" | "graph">("sessions")
  const [sessions, setSessions] = useState<Session[]>([])
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [expandFilters, setExpandFilters] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<number | null>(null)
  const [expandedDays, setExpandedDays] = useState<string[]>(["today"])
  const [expandedSessions, setExpandedSessions] = useState<string[]>([])
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    sendMessage<{ sessions: Session[] }>({ type: "GET_SESSIONS" })
      .then((res) => {
        setSessions(res?.sessions ?? [])
      })
      .catch((err) => {
        console.error("Failed to load sessions:", err)
        setError("Failed to load sessions")
      })
  }, [])

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

    sessions.forEach((session) => {
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

    // Sort by date descending (newest first)
    return Array.from(grouped.entries())
      .sort(([, a], [, b]) => b.date.getTime() - a.date.getTime())
      .map(([, data]) => data)
  }, [sessions])

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
          <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--primary)' }} />
          <h1 
            className="text-xl font"
            style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
            Aegis
          </h1>
        </div>
        
        {/* Settings Button */}
        <button
          onClick={() => {}}
          className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none"
          style={{ color: 'var(--gray)' }}>
          <Settings className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </button>
      </div>

      {/* <div className="px-3 pt-2">
        <CoiPanel sessions={sessions} />
      </div> */}

      {/* Tabs */}
      <div className="px-3 pt-3 flex gap-1 border-b" style={{ borderColor: '#E5E5E5' }}>
        <button
          onClick={() => setActiveTab("sessions")}
          className={`px-4 py-2 text-sm font-medium transition-all rounded-t-lg ${
            activeTab === "sessions" ? "" : "opacity-60"
          }`}
          style={{
            backgroundColor: activeTab === "sessions" ? "white" : "transparent",
            color: activeTab === "sessions" ? "#0072de" : "#64748b",
            borderBottom: activeTab === "sessions" ? "2px solid #0072de" : "none",
            fontFamily: "'Breeze Sans'"
          }}>
          Sessions
        </button>
        <button
          onClick={() => setActiveTab("graph")}
          className={`px-4 py-2 text-sm font-medium transition-all rounded-t-lg ${
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
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col gap-0 overflow-y-auto">
        {activeTab === "graph" ? (
          <div className="p-3">
            <GraphPanel />
          </div>
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
            {/* Show first 3 filters or all if expanded */}
            {MOCK_FILTERS.slice(0, expandFilters ? MOCK_FILTERS.length : 3).map((filter) => (
              <button
                key={filter.id}
                onClick={() => {
                  setSelectedFilter(selectedFilter === filter.id ? null : filter.id)
                }}
                className="px-4 py-2 rounded-full text-xs font-medium transition-all"
                style={{
                  backgroundColor: selectedFilter === filter.id ? '#000000' : '#FFFFFF',
                  color: selectedFilter === filter.id ? '#FFFFFF' : '#000000',
                  border: '1px solid #000000',
                  fontFamily: "'Breeze Sans'",
                }}>
                {filter.label}
              </button>
            ))}

            {/* More/Less button */}
            {MOCK_FILTERS.length > 3 && (
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
                }}
              />
            ))}
          </div>
        )}
        
        <button
          onClick={onShowEmpty}
          className="mt-4 text-xs underline underline-offset-4 opacity-70 transition-opacity hover:opacity-100"
          style={{ color: 'var(--gray)', fontFamily: "'Breeze Sans'" }}>
          Show empty state (dev)
        </button>
        </>
        )}
      </div>
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
}

function DaySection({
  dayKey,
  dayLabel,
  sessions,
  isExpanded,
  onToggleDay,
  expandedSessions,
  onToggleSession,
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
}

function SessionItem({ session, isExpanded, onToggle }: SessionItemProps) {
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null)
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
  const sessionTitle = session.pages.length > 0 
    ? (session.pages[0]?.title || domains[0] || "Session")
    : "Session"

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
        </div>
        {/* Expand/Collapse Icon */}
        <button
          onClick={(e) => e.stopPropagation()}
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
          {session.pages.map((page, index) => {
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

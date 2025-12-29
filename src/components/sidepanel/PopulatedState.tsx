import { X, Search, ChevronDown } from "lucide-react"
import { useEffect, useMemo, useState, useRef } from "react"
import type { PageEvent } from "~/types/page-event"
import type { Session } from "~/types/session"
import { CoiPanel } from "./CoiPanel"

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

// Mock session data - will be fetched from API
const MOCK_SESSIONS = {
  today: [
    {
      id: 1,
      title: "Research on CAiuth",
      timeStart: "10:40",
      timeEnd: "11:25",
      domain: "auth",
      siteIcon: "📄",
      siteName: "google.docs",
      itemCount: 6,
      links: [
        { title: "GitHub - oauth2-server", url: "github.com/oauth2-server" },
        { title: "OAuth 2.0 Security - OWASP", url: "owasp.org/oauth" },
        { title: "RFC 6749 - OAuth 2.0", url: "tools.ietf.org/html/rfc6749" },
      ],
    },
    {
      id: 2,
      title: "google Maps",
      timeStart: "11:05",
      timeEnd: "11:25",
      domain: "maps",
      siteIcon: "🗺️",
      siteName: "google.maps",
      itemCount: 5,
      links: [
        { title: "React Navigation Maps", url: "maps.google.com" },
        { title: "Mapbox Documentation", url: "docs.mapbox.com" },
      ],
    },
    {
      id: 3,
      title: "Online shopping - headphones",
      timeStart: "10:10",
      timeEnd: "10:40",
      domain: "shopping",
      siteIcon: "🛍️",
      siteName: "flipkart",
      itemCount: 7,
      links: [
        { title: "Sony WH-1000XM5", url: "flipkart.com/sony-headphones" },
        { title: "Bose QuietComfort", url: "flipkart.com/bose" },
        { title: "JBL Tune 750", url: "flipkart.com/jbl" },
      ],
    },
    {
      id: 4,
      title: "Design System Review",
      timeStart: "13:30",
      timeEnd: "14:15",
      domain: "design",
      siteIcon: "🎨",
      siteName: "figma.com",
      itemCount: 4,
      links: [
        { title: "Tailwind CSS Components", url: "tailwindui.com" },
        { title: "Material Design Guidelines", url: "material.io" },
      ],
    },
    {
      id: 5,
      title: "Team Meeting Notes",
      timeStart: "14:30",
      timeEnd: "15:00",
      domain: "productivity",
      siteIcon: "📋",
      siteName: "notion.so",
      itemCount: 3,
      links: [
        { title: "Q4 Roadmap", url: "notion.so/roadmap" },
      ],
    },
  ],
  yesterday: [
    {
      id: 6,
      title: "Research on CAiuth",
      timeStart: "10:40",
      timeEnd: "11:25",
      domain: "auth",
      siteIcon: "📄",
      siteName: "google.docs",
      itemCount: 6,
      links: [
        { title: "GitHub - oauth2-server", url: "github.com/oauth2-server" },
      ],
    },
    {
      id: 7,
      title: "Launch places.nearby",
      timeStart: "11:05",
      timeEnd: "11:25",
      domain: "maps",
      siteIcon: "🗺️",
      siteName: "google.maps",
      itemCount: 8,
      links: [
        { title: "Places API", url: "maps.google.com/places" },
      ],
    },
    {
      id: 8,
      title: "Online shopping - headphones",
      timeStart: "10:10",
      timeEnd: "10:40",
      domain: "shopping",
      siteIcon: "🛍️",
      siteName: "flipkart",
      itemCount: 7,
      links: [
        { title: "Sony WH-1000XM5", url: "flipkart.com/sony-headphones" },
      ],
    },
    {
      id: 10,
      title: "Code Review Session",
      timeStart: "15:30",
      timeEnd: "16:15",
      domain: "development",
      siteIcon: "👨‍💻",
      siteName: "github.com",
      itemCount: 5,
      links: [
        { title: "PR #234 - New Features", url: "github.com/pr/234" },
      ],
    },
  ],
  older: [
    {
      id: 11,
      title: "Research on CAiuth",
      timeStart: "10:40",
      timeEnd: "11:25",
      domain: "auth",
      siteIcon: "📄",
      siteName: "google.docs",
      itemCount: 6,
      links: [
        { title: "GitHub - oauth2-server", url: "github.com/oauth2-server" },
      ],
    },
    {
      id: 12,
      title: "Documentation Updates",
      timeStart: "13:00",
      timeEnd: "13:45",
      domain: "documentation",
      siteIcon: "📚",
      siteName: "docs.example.com",
      itemCount: 4,
      links: [
        { title: "API Reference", url: "docs.example.com/api" },
      ],
    },
    {
      id: 13,
      title: "Performance Optimization",
      timeStart: "14:00",
      timeEnd: "14:45",
      domain: "performance",
      siteIcon: "⚡",
      siteName: "analytics.example.com",
      itemCount: 3,
      links: [
        { title: "Metrics Dashboard", url: "analytics.example.com" },
      ],
    },
    {
      id: 14,
      title: "Bug Fixing Session",
      timeStart: "15:00",
      timeEnd: "16:00",
      domain: "debugging",
      siteIcon: "🐛",
      siteName: "bugtracker.example.com",
      itemCount: 8,
      links: [
        { title: "Bug #567 - Critical", url: "bugtracker.example.com/567" },
      ],
    },
    {
      id: 15,
      title: "Team Standup",
      timeStart: "16:30",
      timeEnd: "17:00",
      domain: "communication",
      siteIcon: "💬",
      siteName: "slack.com",
      itemCount: 2,
      links: [
        { title: "Channel: #development", url: "slack.com/dev" },
      ],
    },
  ],
}

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
  const [sessions, setSessions] = useState<Session[]>([])
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [expandFilters, setExpandFilters] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<number | null>(null)
  const [expandedDays, setExpandedDays] = useState<string[]>(["today"])
  const [expandedSessions, setExpandedSessions] = useState<string[]>([])

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

  // Group real sessions by date
  const realSessionsByDay = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const grouped: { today: Session[]; yesterday: Session[]; older: Session[] } = {
      today: [],
      yesterday: [],
      older: [],
    }

    sessions.forEach((session) => {
      const sessionDate = new Date(session.startTime)
      const sessionDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate())

      if (sessionDay.getTime() === today.getTime()) {
        grouped.today.push(session)
      } else if (sessionDay.getTime() === yesterday.getTime()) {
        grouped.yesterday.push(session)
      } else {
        grouped.older.push(session)
      }
    })

    return grouped
  }, [sessions])

  const searchMock = (value: string): SearchResult[] => {
    const term = value.toLowerCase()
    return Object.values(MOCK_SESSIONS)
      .flat()
      .flatMap((session) => session.links.map((link) => ({ sessionTitle: session.title, link })))
      .filter(({ sessionTitle, link }) =>
        sessionTitle.toLowerCase().includes(term) || link.title.toLowerCase().includes(term) || link.url.toLowerCase().includes(term)
      )
      .map(({ link }) => ({
        pageEvent: {
          url: `https://${link.url}`,
          title: link.title,
          domain: new URL(`https://${link.url}`).hostname,
          timestamp: Date.now(),
          openedAt: Date.now()
        },
        score: 0.5,
        layer: "Keyword" as const
      }))
  }

  const handleSearch = async (value: string) => {
    setSearchQuery(value)
    if (!value.trim()) {
      setResults([])
      return
    }

    // If no real sessions yet, fall back to mock search
    if (!pages.length) {
      setResults(searchMock(value))
      return
    }

    setLoading(true)
    setError(null)
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
    <div className="relative h-full flex flex-col" style={{ backgroundColor: '#F2F4F7' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between p-2 pb-1 bg-white" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--primary)' }} />
          <h1 
            className="text-lg font-bold"
            style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
            Aegis
          </h1>
        </div>
        
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none"
          style={{ color: 'var(--gray)' }}>
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </button>
      </div>

      <div className="px-3 pt-2">
        <CoiPanel sessions={sessions} />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col gap-0 overflow-y-auto">
        {/* Sticky Search & Filters */}
        <div className="sticky top-0 z-20 bg-white px-2 pt-1 pb-2 -mx-0" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
          {/* Search Bar */}
          <div className="relative flex items-center gap-3 px-4 py-2 rounded-full mb-3" style={{ backgroundColor: '#E8E8E8' }}>
            <Search className="h-4 w-4" style={{ color: '#9A9FA6' }} />
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}
            />
          </div>

          <div className="flex items-center justify-between px-1 text-xs" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
            <span>{pages.length} pages indexed{!pages.length ? " (using mock fallback)" : ""}</span>
            {loading && <span>Searching...</span>}
          </div>
          {error && (
            <div className="mt-1 px-2 text-xs" style={{ color: '#b00020', fontFamily: "'Breeze Sans'" }}>
              {error}
            </div>
          )}

          {/* Filters Section */}
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
                backgroundColor: selectedFilter === filter.id ? '#0074FB' : '#D9D9D9',
                color: selectedFilter === filter.id ? 'white' : '#080A0B',
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
              style={{ color: 'var(--primary)', fontFamily: "'Breeze Sans'" }}>
              {expandFilters ? "Less" : "More"}
              <ChevronDown
                className={`h-3 w-3 transition-transform ${expandFilters ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </div>
        </div>

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
            {results.length === 0 && !loading && (
              <div className="text-sm px-2" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
                No results found.
              </div>
            )}
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
            <RealDaySection
              dayKey="today"
              dayLabel="Today"
              sessions={realSessionsByDay.today}
              isExpanded={expandedDays.includes("today")}
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

            <RealDaySection
              dayKey="yesterday"
              dayLabel="Yesterday"
              sessions={realSessionsByDay.yesterday}
              isExpanded={expandedDays.includes("yesterday")}
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

            <RealDaySection
              dayKey="older"
              dayLabel="📅 DATES +"
              sessions={realSessionsByDay.older}
              isExpanded={expandedDays.includes("older")}
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
          </div>
        )}
        
        <button
          onClick={onShowEmpty}
          className="mt-4 text-xs underline underline-offset-4 opacity-70 transition-opacity hover:opacity-100"
          style={{ color: 'var(--gray)', fontFamily: "'Breeze Sans'" }}>
          Show empty state (dev)
        </button>
      </div>
    </div>
  )
}

// Real Day Section Component (for actual sessions from IndexedDB)
interface RealDaySectionProps {
  dayKey: string
  dayLabel: string
  sessions: Session[]
  isExpanded: boolean
  onToggleDay: (key: string) => void
  expandedSessions: string[]
  onToggleSession: (id: string) => void
}

function RealDaySection({
  dayKey,
  dayLabel,
  sessions,
  isExpanded,
  onToggleDay,
  expandedSessions,
  onToggleSession,
}: RealDaySectionProps) {
  const visibleCount = isExpanded ? sessions.length : 3

  return (
    <div className="flex flex-col gap-3 pb-0 pt-1 p-2">
      {/* Day Header */}
      <div className="text-sm font-semibold px-2" style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
        <span>{dayLabel}</span>
      </div>

      {/* Sessions List */}
      <div className="flex flex-col gap-3 pt-0">
        {sessions.slice(0, visibleCount).map((session, index) => (
          <div
            key={session.id}
            className="animate-in fade-in slide-in-from-bottom-2 duration-300"
            style={{ animationDelay: `${index * 50}ms` }}>
            <RealSessionItem
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

// Real Session Item Component (for actual sessions from IndexedDB)
interface RealSessionItemProps {
  session: Session
  isExpanded: boolean
  onToggle: () => void
}

function RealSessionItem({ session, isExpanded, onToggle }: RealSessionItemProps) {
  const timeStart = new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const timeEnd = new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const domains = [...new Set(session.pages.map((p) => new URL(p.url).hostname.replace('www.', '')))].slice(0, 3)

  return (
    <div
      className="flex flex-col gap-1.5 p-2.5 rounded-lg transition-all"
      style={{
        backgroundColor: '#FAFAFA',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
      {/* Row 1: Session Header with title and duration */}
      <button
        onClick={onToggle}
        className="flex items-center justify-between gap-2 w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ChevronDown
            className={`h-3 w-3 flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            style={{ color: 'var(--gray)' }}
          />
          <p
            className="text-xs font-bold leading-tight"
            style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
            Session {session.pages.length} pages
          </p>
        </div>
        <span className="text-xs flex-shrink-0" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
          {timeStart} - {timeEnd}
        </span>
      </button>

      {/* Row 2: Domains (only show when collapsed) */}
      {!isExpanded && (
        <div className="flex items-center gap-1.5 px-5">
          {domains.map((domain) => (
            <span
              key={domain}
              className="text-2xs px-2 py-1 rounded"
              style={{ backgroundColor: '#E8E8E8', color: '#555', fontSize: '10px', fontFamily: "'Breeze Sans'" }}>
              {domain}
            </span>
          ))}
        </div>
      )}

      {/* Expanded: Show pages */}
      {isExpanded && (
        <div className="flex flex-col gap-1 border-t border-gray-200 pt-2">
          {session.pages.map((page) => (
            <div key={page.url} className="px-5 py-1 text-2xs" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
              <div className="font-medium truncate" style={{ color: 'var(--dark)' }}>{page.title}</div>
              <div className="truncate">{page.url}</div>
              {page.visitCount && page.visitCount > 1 && (
                <div style={{ color: '#0074FB' }}>Visited {page.visitCount} times</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Day Section Component
interface DaySectionProps {
  dayKey: string
  dayLabel: string
  sessions: typeof MOCK_SESSIONS.today
  isExpanded: boolean
  onToggleDay: (key: string) => void
  expandedSessions: number[]
  onToggleSession: (id: number) => void
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

  const handleToggle = () => {
    onToggleDay(dayKey)
  }
  
  return (
    <div className="flex flex-col gap-3 pb-0 pt-1 p-2">
      {/* Day Header */}
      <div className="text-sm font-semibold px-2" style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
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
            onClick={handleToggle}
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

// Session Item Component
interface SessionItemProps {
  session: (typeof MOCK_SESSIONS.today)[0]
  isExpanded: boolean
  onToggle: () => void
}

function SessionItem({ session, isExpanded, onToggle }: SessionItemProps) {
  // Extract site names from links (first 2-3)
  const linkedSites = session.links.slice(0, 3).map((link) => {
    // Extract domain from URL
    const url = new URL(`https://${link.url}`)
    return {
      domain: url.hostname.replace('www.', ''),
      title: link.title,
    }
  })

  return (
    <div 
      className="flex flex-col gap-1.5 p-2.5 rounded-lg transition-all"
      style={{ 
        backgroundColor: '#FAFAFA',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
      {/* Row 1: Session Header with title and duration */}
      <button
        onClick={onToggle}
        className="flex items-center justify-between gap-2 w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ChevronDown
            className={`h-3 w-3 flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            style={{ color: 'var(--gray)' }}
          />
          <p
            className="text-xs font-bold leading-tight"
            style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
            {session.title}
          </p>
        </div>
        <span className="text-xs flex-shrink-0" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
          {session.timeStart} - {session.timeEnd}
        </span>
      </button>

      {/* Row 2: Sites visited in this session */}
      <div className="flex items-center gap-1.5 pl-5">
        {linkedSites.map((site, index) => (
          <span
            key={index}
            className="text-2xs px-1.5 py-0.5 rounded"
            style={{ 
              backgroundColor: '#F0F0F0',
              color: '#9A9FA6',
              fontFamily: "'Breeze Sans'",
              fontSize: '10px'
            }}>
            {site.domain}
          </span>
        ))}
      </div>

      {/* Links List - Chrome history style */}
      {isExpanded && (
        <div className="flex flex-col gap-2 pl-5 pt-2">
          {/* Reload Session Button */}
          <button
            onClick={async () => {
              // Open all links from the session in a new tab group
              const tabIds: number[] = []
              
              for (const link of session.links) {
                const tab = await chrome.tabs.create({ url: `https://${link.url}` })
                if (tab.id) tabIds.push(tab.id)
              }
              
              // Create a tab group with the session name
              if (tabIds.length > 0) {
                const groupId = await chrome.tabs.group({ tabIds })
                // Update group with title and a color
                chrome.tabGroups.update(groupId, { 
                  title: session.title,
                  collapsed: false
                }).catch((error) => {
                  console.error('Failed to update tab group:', error)
                })
              }
            }}
            className="text-xs font-medium px-2 py-1.5 rounded transition-colors"
            style={{ 
              color: 'var(--primary)',
              backgroundColor: '#F0F0F0',
              fontFamily: "'Breeze Sans'"
            }}>
            Reload Session
          </button>

          {/* Individual Links */}
          {session.links.map((link, index) => {
            // Extract domain from URL
            const url = new URL(`https://${link.url}`)
            const domain = url.hostname.replace('www.', '')
            // Generate a time for each link based on index
            const linkTime = new Date(new Date(`2024-01-01 ${session.timeStart}`).getTime() + index * 5 * 60000)
            const timeStr = linkTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

            return (
              <a
                key={index}
                href={`https://${link.url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start justify-between gap-3 px-2 py-1.5 rounded transition-colors hover:bg-gray-100"
                style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <p className="text-xs leading-tight truncate hover:text-blue-600" style={{ color: 'var(--primary)' }}>
                    {link.title}
                  </p>
                  <span className="text-2xs" style={{ color: '#9A9FA6', fontSize: '10px' }}>
                    {domain}
                  </span>
                </div>
                <span className="text-2xs flex-shrink-0" style={{ color: '#9A9FA6', fontSize: '10px' }}>
                  {timeStr}
                </span>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { X, Search, ChevronDown, Settings, ArrowLeft, ExternalLink, MoreVertical, ExternalLinkIcon, Copy, Trash2, EyeOff } from "lucide-react"
import { useState, useRef, useEffect } from "react"

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

interface PopulatedStateProps {
  onShowEmpty?: () => void
}

export function PopulatedState({ onShowEmpty }: PopulatedStateProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [expandFilters, setExpandFilters] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<number | null>(null)
  const [expandedDays, setExpandedDays] = useState<string[]>(["today"])
  const [expandedSessions, setExpandedSessions] = useState<number[]>([])

  const handleClose = () => {
    // Send message to content scripts before closing
    console.log("Sidepanel sending SIDEPANEL_CLOSED message")
    chrome.runtime.sendMessage({ type: "SIDEPANEL_CLOSED" })
    // Also set localStorage as fallback
    localStorage.setItem("aegis-sidebar-closed", "true")
    window.close()
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

      {/* Content */}
      <div className="flex-1 flex flex-col gap-0 overflow-y-auto">
        {/* Sticky Search & Filters */}
        <div className="sticky top-0 z-20 bg-white px-2 pt-4 pb-2 -mx-0">
          {/* Back Button and Search Bar */}
          <div className="flex items-center gap-2 mb-5">
            <button className="p-2" onClick={onShowEmpty} style={{ color: '#9A9FA6' }}>
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="relative flex items-center gap-3 px-4 py-2.5 rounded-full flex-1" style={{ backgroundColor: '#F5F5F5' }}>
              <Search className="h-4 w-4" style={{ color: '#9A9FA6' }} />
              <input
                type="text"
                placeholder="Search what you have seen before"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}
              />
            </div>
          </div>

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

        {/* Timeline Sessions */}
        <div className="flex flex-col p-0.5">
          {/* Today Section */}
          <DaySection
            dayKey="today"
            dayLabel="Today- Friday, December 26, 2025"
            sessions={MOCK_SESSIONS.today}
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

          {/* Yesterday Section */}
          <DaySection
            dayKey="yesterday"
            dayLabel="Yesterday - Thursday, December 25, 2025"
            sessions={MOCK_SESSIONS.yesterday}
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

          {/* Older Section */}
          <DaySection
            dayKey="older"
            dayLabel="📅 DATES +"
            sessions={MOCK_SESSIONS.older}
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
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null)
  
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
            {session.title}
          </p>
          {/* Reload Session Icon */}
          <button
            onClick={async (e) => {
              e.stopPropagation()
              // Open all links from the session in a new tab group
              const tabIds: number[] = []
              
              for (const link of session.links) {
                const tab = await chrome.tabs.create({ url: `https://${link.url}` })
                if (tab.id) tabIds.push(tab.id)
              }
              
              // Create a tab group with the session name
              if (tabIds.length > 0) {
                const groupId = await chrome.tabs.group({ tabIds })
                chrome.tabGroups.update(groupId, { 
                  title: session.title,
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
          {session.links.map((link, index) => {
            // Generate a time for each link based on index
            const linkTime = new Date(new Date(`2024-01-01 ${session.timeStart}`).getTime() + index * 5 * 60000)
            const timeStr = linkTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

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
                    href={`https://${link.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs leading-tight truncate flex-1"
                    style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
                    {link.title}
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
                        window.open(`https://${link.url}`, '_blank')
                        setOpenMenuIndex(null)
                      }}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center gap-3"
                      style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
                      <ExternalLinkIcon className="h-3.5 w-3.5" style={{ color: '#9A9FA6' }} />
                      <span>Open in new tab</span>
                    </button>
                    <button
                      onClick={() => {
                        window.open(`https://${link.url}`, '_blank', 'noopener,noreferrer')
                        setOpenMenuIndex(null)
                      }}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center gap-3"
                      style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
                      <ExternalLinkIcon className="h-3.5 w-3.5" style={{ color: '#9A9FA6' }} />
                      <span>Open in new window</span>
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`https://${link.url}`)
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
                        console.log('Delete from session:', link.url)
                        setOpenMenuIndex(null)
                      }}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-red-50 transition-colors flex items-center gap-3"
                      style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
                      <Trash2 className="h-3.5 w-3.5" style={{ color: '#9A9FA6' }} />
                      <span>Delete from session</span>
                    </button>
                    <button
                      onClick={() => {
                        chrome.windows.create({ url: `https://${link.url}`, incognito: true })
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

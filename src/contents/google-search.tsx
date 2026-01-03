import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"
import { X, Filter } from "lucide-react"

export const config: PlasmoCSConfig = {
  matches: ["https://www.google.com/search*", "https://www.google.co.uk/search*", "https://www.google.ca/search*", "https://www.google.co.in/search*"]
}

export const getShadowHostId = () => "google-search-filter"

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
  `
  return style
}

const GoogleSearchFilter = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [blockedDomains, setBlockedDomains] = useState<string[]>([])
  const [newDomain, setNewDomain] = useState("")
  const [hiddenResults, setHiddenResults] = useState<Set<string>>(new Set())

  // Load blocked domains from storage
  useEffect(() => {
    chrome.storage.local.get(["googleBlockedDomains"], (result) => {
      if (result.googleBlockedDomains) {
        setBlockedDomains(result.googleBlockedDomains)
      }
    })
  }, [])

  // Apply filtering to search results
  useEffect(() => {
    const filterResults = () => {
      // Find all search result elements
      const results = document.querySelectorAll('div[data-sokoban-container]')
      
      results.forEach((result) => {
        const linkElement = result.querySelector('a[href]') as HTMLAnchorElement
        if (!linkElement) return

        try {
          const url = new URL(linkElement.href)
          const domain = url.hostname.replace('www.', '')

          // Check if domain is blocked
          const isBlocked = blockedDomains.some(blocked => 
            domain.includes(blocked) || blocked.includes(domain)
          )

          if (isBlocked) {
            (result as HTMLElement).style.display = 'none'
            setHiddenResults(prev => new Set([...prev, domain]))
          } else {
            (result as HTMLElement).style.display = ''
          }
        } catch (e) {
          // Invalid URL, skip
        }
      })
    }

    if (blockedDomains.length > 0) {
      filterResults()
      
      // Re-apply on DOM changes (lazy loading)
      const observer = new MutationObserver(filterResults)
      observer.observe(document.body, { childList: true, subtree: true })
      
      return () => observer.disconnect()
    }
  }, [blockedDomains])

  const addDomain = () => {
    if (newDomain.trim()) {
      const cleanDomain = newDomain.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '')
      const updated = [...blockedDomains, cleanDomain]
      setBlockedDomains(updated)
      chrome.storage.local.set({ googleBlockedDomains: updated })
      setNewDomain("")
    }
  }

  const removeDomain = (domain: string) => {
    const updated = blockedDomains.filter(d => d !== domain)
    setBlockedDomains(updated)
    chrome.storage.local.set({ googleBlockedDomains: updated })
    setHiddenResults(prev => {
      const next = new Set(prev)
      next.delete(domain)
      return next
    })
  }

  return (
    <>
      {/* Toggle Button */}
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 99999,
          backgroundColor: "#0072de",
          color: "white",
          borderRadius: "50%",
          width: "56px",
          height: "56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0, 114, 222, 0.3)",
          transition: "all 0.2s ease"
        }}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.1)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)"
        }}
      >
        <Filter size={24} />
        {hiddenResults.size > 0 && (
          <div
            style={{
              position: "absolute",
              top: "-5px",
              right: "-5px",
              backgroundColor: "#ff4444",
              color: "white",
              borderRadius: "12px",
              width: "24px",
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: "600"
            }}
          >
            {hiddenResults.size}
          </div>
        )}
      </div>

      {/* Filter Panel */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: "90px",
            right: "20px",
            zIndex: 99999,
            backgroundColor: "white",
            borderRadius: "12px",
            width: "340px",
            maxHeight: "500px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
            overflow: "hidden",
            fontFamily: "'Inter', system-ui, sans-serif"
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #e5e5e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "#f9fafb"
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#1f2937"
                }}
              >
                Google Search Filter
              </h3>
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: "12px",
                  color: "#6b7280"
                }}
              >
                Hide unwanted domains from results
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "6px",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#e5e7eb"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent"
              }}
            >
              <X size={20} color="#6b7280" />
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: "16px 20px", maxHeight: "380px", overflowY: "auto" }}>
            {/* Add Domain Input */}
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "#374151",
                  marginBottom: "8px"
                }}
              >
                Block a domain
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addDomain()}
                  placeholder="example.com"
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    fontSize: "14px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    outline: "none",
                    fontFamily: "inherit"
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#0072de"
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 114, 222, 0.1)"
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#d1d5db"
                    e.currentTarget.style.boxShadow = "none"
                  }}
                />
                <button
                  onClick={addDomain}
                  style={{
                    padding: "8px 16px",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "white",
                    backgroundColor: "#0072de",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "background-color 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#005bb5"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#0072de"
                  }}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Blocked Domains List */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "#374151",
                  marginBottom: "8px"
                }}
              >
                Blocked domains ({blockedDomains.length})
              </label>
              {blockedDomains.length === 0 ? (
                <p
                  style={{
                    fontSize: "13px",
                    color: "#9ca3af",
                    textAlign: "center",
                    padding: "20px",
                    margin: 0
                  }}
                >
                  No blocked domains yet
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {blockedDomains.map((domain) => (
                    <div
                      key={domain}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                        backgroundColor: "#f9fafb",
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb"
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          color: "#1f2937",
                          fontFamily: "monospace"
                        }}
                      >
                        {domain}
                      </span>
                      <button
                        onClick={() => removeDomain(domain)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "4px",
                          display: "flex",
                          alignItems: "center",
                          borderRadius: "4px",
                          transition: "background-color 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#fee2e2"
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent"
                        }}
                      >
                        <X size={16} color="#ef4444" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default GoogleSearchFilter

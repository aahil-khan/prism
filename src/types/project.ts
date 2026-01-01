import type { PageEvent } from "./page-event"

export type Session = {
  id: string
  startTime: number
  endTime: number
  pages: PageEvent[]
  inferredTitle?: string
  labelId?: string // Optional label ID from user's label list
  projectId?: string // Optional project ID this session belongs to
}

export type ProjectSite = {
  url: string // Specific resource identifier (e.g., "github.com/user/repo")
  title: string // Page title or user-edited name
  addedAt: number // Timestamp when added to project
  addedBy: 'auto' | 'user' // How it was added
  visitCount: number // Number of visits to this site within project sessions
}

export type Project = {
  id: string
  name: string // Auto-generated or user-edited
  description?: string // Optional user notes
  startDate: number // Timestamp of first session
  endDate: number // Timestamp of last session
  sessionIds: string[] // Sessions belonging to this project
  keywords: string[] // Inferred keywords from pages
  topDomains: string[] // Most frequently visited domains (legacy - will be derived from sites)
  sites: ProjectSite[] // Specific sites/URLs that are part of this project
  status: 'active' | 'stale' | 'completed'
  createdAt: number // When project was detected
  autoDetected: boolean // True if auto-detected, false if manually created
  score: number // Confidence score 0-100
  dismissedSuggestions?: Array<{
    url: string // URL that was dismissed
    timestamp: number // When it was dismissed
  }> // Track URLs user has dismissed from suggestions
}

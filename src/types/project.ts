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

export type Project = {
  id: string
  name: string // Auto-generated or user-edited
  description?: string // Optional user notes
  startDate: number // Timestamp of first session
  endDate: number // Timestamp of last session
  sessionIds: string[] // Sessions belonging to this project
  keywords: string[] // Inferred keywords from pages
  topDomains: string[] // Most frequently visited domains
  status: 'active' | 'stale' | 'completed'
  createdAt: number // When project was detected
  autoDetected: boolean // True if auto-detected, false if manually created
  score: number // Confidence score 0-100
}

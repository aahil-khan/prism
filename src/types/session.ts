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
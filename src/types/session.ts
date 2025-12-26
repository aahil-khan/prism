import type { PageEvent } from "./page-event"

export type Session = {
  id: string
  startTime: number
  endTime: number
  pages: PageEvent[]
}

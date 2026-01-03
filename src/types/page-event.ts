export type PageEvent = {
  url: string
  title: string
  domain: string
  timestamp: number
  openedAt: number
  titleEmbedding?: number[]
  visitCount?: number
  wasForeground?: boolean
  referrer?: string
  searchQuery?: string // Extracted search query for search engine results
}
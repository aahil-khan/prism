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
}
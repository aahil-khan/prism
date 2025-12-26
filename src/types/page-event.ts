export type PageEvent = {
  url: string
  title: string
  domain: string
  timestamp: number
  wasForeground?: boolean
  referrer?: string
}
// Focus Mode Type Definitions

export type BlocklistCategory =
  | "social-media"
  | "entertainment"
  | "news"
  | "shopping"
  | "gaming"
  | "custom"

export type BlocklistEntryType = "domain" | "url" | "regex"

export interface BlocklistEntry {
  pattern: string
  type: BlocklistEntryType
  addedAt: number
  reason?: string
  category: BlocklistCategory
}

export interface BlocklistCategoryInfo {
  id: BlocklistCategory
  name: string
  emoji: string
  description: string
}

export interface CategoryStates {
  "social-media": boolean
  entertainment: boolean
  news: boolean
  shopping: boolean
  gaming: boolean
  custom: boolean
}

export interface Blocklist {
  version: string
  exportedAt?: number
  metadata?: {
    name?: string
    description?: string
    author?: string
  }
  categoryStates: CategoryStates
  entries: BlocklistEntry[]
}

export interface FocusModeState {
  isActive: boolean
  enabledCategories: BlocklistCategory[]
}

export const CATEGORY_INFO: Record<BlocklistCategory, BlocklistCategoryInfo> = {
  "social-media": {
    id: "social-media",
    name: "Social Media",
    emoji: "🔵",
    description: "Facebook, Twitter/X, Instagram, TikTok, Snapchat, LinkedIn, Reddit, etc."
  },
  entertainment: {
    id: "entertainment",
    name: "Entertainment & Videos",
    emoji: "🎬",
    description: "YouTube, Netflix, Twitch, Spotify, streaming platforms"
  },
  news: {
    id: "news",
    name: "News & Media",
    emoji: "📰",
    description: "CNN, BBC, news sites and media outlets"
  },
  shopping: {
    id: "shopping",
    name: "Shopping",
    emoji: "🛒",
    description: "Amazon, eBay, online shopping sites"
  },
  gaming: {
    id: "gaming",
    name: "Gaming",
    emoji: "🎮",
    description: "Steam, game platforms and gaming sites"
  },
  custom: {
    id: "custom",
    name: "Custom Sites",
    emoji: "⚙️",
    description: "Your personally added distractions"
  }
}

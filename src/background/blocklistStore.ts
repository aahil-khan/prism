// Blocklist Storage Manager

import type { Blocklist, BlocklistEntry, CategoryStates } from "~/types/focus-mode"

const BLOCKLIST_KEY = "focus-mode-blocklist"

// Default blocklist with pre-populated sites from sample config
const DEFAULT_BLOCKLIST: Blocklist = {
  version: "1.0",
  categoryStates: {
    "social-media": true,
    entertainment: true,
    news: true,
    shopping: false,
    gaming: true,
    custom: true
  },
  entries: [
    // Social Media (🔵)
    {
      pattern: "*.facebook.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Social media distraction",
      category: "social-media"
    },
    {
      pattern: "*.twitter.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Social media distraction",
      category: "social-media"
    },
    {
      pattern: "*.x.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Social media distraction",
      category: "social-media"
    },
    {
      pattern: "*.instagram.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Social media distraction",
      category: "social-media"
    },
    {
      pattern: "*.tiktok.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Social media distraction",
      category: "social-media"
    },
    {
      pattern: "*.snapchat.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Social media distraction",
      category: "social-media"
    },
    {
      pattern: "*.linkedin.com/feed/*",
      type: "url",
      addedAt: Date.now(),
      reason: "LinkedIn feed browsing",
      category: "social-media"
    },
    {
      pattern: "*.linkedin.com/messaging/*",
      type: "url",
      addedAt: Date.now(),
      reason: "LinkedIn messages can be distracting",
      category: "social-media"
    },
    {
      pattern: "*.reddit.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Social media distraction",
      category: "social-media"
    },
    {
      pattern: "*.pinterest.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Social media distraction",
      category: "social-media"
    },
    {
      pattern: "*.tumblr.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Social media distraction",
      category: "social-media"
    },
    {
      pattern: "*.mastodon.social",
      type: "domain",
      addedAt: Date.now(),
      reason: "Social media distraction",
      category: "social-media"
    },
    {
      pattern: "*.threads.net",
      type: "domain",
      addedAt: Date.now(),
      reason: "Social media distraction",
      category: "social-media"
    },

    // Entertainment & Videos (🎬)
    {
      pattern: "*.youtube.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "YouTube - full site block",
      category: "entertainment"
    },
    {
      pattern: "*.youtube.com/feed/*",
      type: "url",
      addedAt: Date.now(),
      reason: "YouTube feed browsing",
      category: "entertainment"
    },
    {
      pattern: "*.youtube.com/shorts/*",
      type: "url",
      addedAt: Date.now(),
      reason: "YouTube Shorts distraction",
      category: "entertainment"
    },
    {
      pattern: "*.youtube.com/trending/*",
      type: "url",
      addedAt: Date.now(),
      reason: "YouTube trending videos",
      category: "entertainment"
    },
    {
      pattern: "*.twitch.tv",
      type: "domain",
      addedAt: Date.now(),
      reason: "Streaming platform distraction",
      category: "entertainment"
    },
    {
      pattern: "*.netflix.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Streaming platform distraction",
      category: "entertainment"
    },
    {
      pattern: "*.hulu.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Streaming platform distraction",
      category: "entertainment"
    },
    {
      pattern: "*.disneyplus.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Streaming platform distraction",
      category: "entertainment"
    },
    {
      pattern: "*.primevideo.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Streaming platform distraction",
      category: "entertainment"
    },
    {
      pattern: "*.spotify.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Music browsing can be distracting",
      category: "entertainment"
    },
    {
      pattern: "*.soundcloud.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Music browsing can be distracting",
      category: "entertainment"
    },
    {
      pattern: "*.vimeo.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Video platform distraction",
      category: "entertainment"
    },
    {
      pattern: "*.dailymotion.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Video platform distraction",
      category: "entertainment"
    },
    {
      pattern: "*.crunchyroll.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Streaming platform distraction",
      category: "entertainment"
    },

    // News & Media (📰)
    {
      pattern: "*.cnn.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "News browsing distraction",
      category: "news"
    },
    {
      pattern: "*.bbc.com/news/*",
      type: "url",
      addedAt: Date.now(),
      reason: "News browsing distraction",
      category: "news"
    },
    {
      pattern: "*.foxnews.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "News browsing distraction",
      category: "news"
    },
    {
      pattern: "*.buzzfeed.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Entertainment news distraction",
      category: "news"
    },
    {
      pattern: "*.theguardian.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "News browsing distraction",
      category: "news"
    },
    {
      pattern: "*.nytimes.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "News browsing distraction",
      category: "news"
    },
    {
      pattern: "*.washingtonpost.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "News browsing distraction",
      category: "news"
    },
    {
      pattern: "*.reuters.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "News browsing distraction",
      category: "news"
    },
    {
      pattern: "*.apnews.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "News browsing distraction",
      category: "news"
    },

    // Shopping (🛒)
    {
      pattern: "*.amazon.com/deals/*",
      type: "url",
      addedAt: Date.now(),
      reason: "Deal browsing distraction",
      category: "shopping"
    },
    {
      pattern: "*.amazon.com/gp/goldbox/*",
      type: "url",
      addedAt: Date.now(),
      reason: "Today's deals distraction",
      category: "shopping"
    },
    {
      pattern: "*.ebay.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Shopping distraction",
      category: "shopping"
    },
    {
      pattern: "*.etsy.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Shopping distraction",
      category: "shopping"
    },
    {
      pattern: "*.aliexpress.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Shopping distraction",
      category: "shopping"
    },
    {
      pattern: "*.wish.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Shopping distraction",
      category: "shopping"
    },
    {
      pattern: "*.walmart.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Shopping distraction",
      category: "shopping"
    },
    {
      pattern: "*.target.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Shopping distraction",
      category: "shopping"
    },
    {
      pattern: "*.bestbuy.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Shopping distraction",
      category: "shopping"
    },

    // Gaming (🎮)
    {
      pattern: "*.steampowered.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Gaming platform distraction",
      category: "gaming"
    },
    {
      pattern: "*.store.steampowered.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Steam store browsing",
      category: "gaming"
    },
    {
      pattern: "*.epicgames.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Gaming platform distraction",
      category: "gaming"
    },
    {
      pattern: "*.roblox.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Gaming platform distraction",
      category: "gaming"
    },
    {
      pattern: "*.minecraft.net",
      type: "domain",
      addedAt: Date.now(),
      reason: "Gaming platform distraction",
      category: "gaming"
    },
    {
      pattern: "*.ea.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Gaming platform distraction",
      category: "gaming"
    },
    {
      pattern: "*.blizzard.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Gaming platform distraction",
      category: "gaming"
    },
    {
      pattern: "*.playstation.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Gaming platform distraction",
      category: "gaming"
    },
    {
      pattern: "*.xbox.com",
      type: "domain",
      addedAt: Date.now(),
      reason: "Gaming platform distraction",
      category: "gaming"
    }
  ]
}

export async function loadBlocklist(): Promise<Blocklist> {
  return new Promise((resolve) => {
    chrome.storage.local.get([BLOCKLIST_KEY], (result) => {
      if (chrome.runtime.lastError) {
        console.error("[Blocklist] Error loading:", chrome.runtime.lastError)
        resolve(DEFAULT_BLOCKLIST)
        return
      }
      resolve(result[BLOCKLIST_KEY] || DEFAULT_BLOCKLIST)
    })
  })
}

export function saveBlocklist(blocklist: Blocklist): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [BLOCKLIST_KEY]: blocklist }, () => {
      if (chrome.runtime.lastError) {
        console.error("[Blocklist] Error saving:", chrome.runtime.lastError)
        reject(chrome.runtime.lastError)
      } else {
        console.log("[Blocklist] Saved successfully")
        resolve()
      }
    })
  })
}

export async function addBlocklistEntry(entry: BlocklistEntry): Promise<void> {
  const blocklist = await loadBlocklist()
  blocklist.entries.push(entry)
  await saveBlocklist(blocklist)
}

export async function updateBlocklistEntry(
  index: number,
  entry: BlocklistEntry
): Promise<void> {
  const blocklist = await loadBlocklist()
  if (index >= 0 && index < blocklist.entries.length) {
    blocklist.entries[index] = entry
    await saveBlocklist(blocklist)
  }
}

export async function deleteBlocklistEntry(index: number): Promise<void> {
  const blocklist = await loadBlocklist()
  if (index >= 0 && index < blocklist.entries.length) {
    blocklist.entries.splice(index, 1)
    await saveBlocklist(blocklist)
  }
}

export async function updateCategoryStates(
  categoryStates: CategoryStates
): Promise<void> {
  const blocklist = await loadBlocklist()
  blocklist.categoryStates = categoryStates
  await saveBlocklist(blocklist)
}

export async function importBlocklist(
  importedBlocklist: Blocklist,
  mergeStrategy: "skip" | "replace" | "merge"
): Promise<void> {
  if (mergeStrategy === "replace") {
    await saveBlocklist(importedBlocklist)
    return
  }

  const currentBlocklist = await loadBlocklist()

  if (mergeStrategy === "skip") {
    const existingPatterns = new Set(
      currentBlocklist.entries.map((e) => e.pattern)
    )
    const newEntries = importedBlocklist.entries.filter(
      (e) => !existingPatterns.has(e.pattern)
    )
    currentBlocklist.entries.push(...newEntries)
  } else if (mergeStrategy === "merge") {
    currentBlocklist.entries.push(...importedBlocklist.entries)
  }

  // Merge category states (imported states take precedence)
  currentBlocklist.categoryStates = {
    ...currentBlocklist.categoryStates,
    ...importedBlocklist.categoryStates
  }

  await saveBlocklist(currentBlocklist)
}

export async function exportBlocklist(): Promise<Blocklist> {
  const blocklist = await loadBlocklist()
  return {
    ...blocklist,
    exportedAt: Date.now(),
    metadata: {
      name: "Aegis Focus Mode Blocklist",
      description: "Exported from Aegis Browser Extension",
      author: "User"
    }
  }
}

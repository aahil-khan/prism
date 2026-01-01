// Focus Mode Manager - Handles state and blocking logic

import type { BlocklistCategory, FocusModeState } from "~/types/focus-mode"
import { loadBlocklist } from "./blocklistStore"

const FOCUS_MODE_STATE_KEY = "focus-mode-state"
const RULE_ID_START = 10000 // Start rule IDs at 10000 to avoid conflicts

let currentState: FocusModeState = {
  isActive: false,
  enabledCategories: []
}

// Initialize focus mode on extension startup
export async function initializeFocusMode(): Promise<void> {
  console.log("[Focus Mode] Initializing...")

  // Load saved state from storage
  const savedState = await loadFocusModeState()
  currentState = savedState

  // If focus mode was active, restore blocking rules
  if (currentState.isActive) {
    console.log("[Focus Mode] Restoring active focus mode from previous session")
    await updateBlockingRules()
  } else {
    console.log("[Focus Mode] Focus mode is inactive")
  }
}

// Load focus mode state from storage
export async function loadFocusModeState(): Promise<FocusModeState> {
  return new Promise((resolve) => {
    chrome.storage.local.get([FOCUS_MODE_STATE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[Focus Mode] Error loading state:",
          chrome.runtime.lastError
        )
        resolve({
          isActive: false,
          enabledCategories: []
        })
        return
      }

      const state = result[FOCUS_MODE_STATE_KEY] || {
        isActive: false,
        enabledCategories: []
      }
      resolve(state)
    })
  })
}

// Save focus mode state to storage
async function saveFocusModeState(state: FocusModeState): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [FOCUS_MODE_STATE_KEY]: state }, () => {
      if (chrome.runtime.lastError) {
        console.error(
          "[Focus Mode] Error saving state:",
          chrome.runtime.lastError
        )
        reject(chrome.runtime.lastError)
      } else {
        console.log("[Focus Mode] State saved:", state)
        resolve()
      }
    })
  })
}

// Get current focus mode state
export function getFocusModeState(): FocusModeState {
  return { ...currentState }
}

// Toggle focus mode on/off
export async function toggleFocusMode(): Promise<FocusModeState> {
  currentState.isActive = !currentState.isActive

  console.log(
    `[Focus Mode] ${currentState.isActive ? "Activating" : "Deactivating"} focus mode`
  )

  // Update blocking rules based on new state
  await updateBlockingRules()

  // Save state to storage
  await saveFocusModeState(currentState)

  return getFocusModeState()
}

// Toggle a specific category on/off
export async function toggleCategory(
  category: BlocklistCategory
): Promise<FocusModeState> {
  const index = currentState.enabledCategories.indexOf(category)

  if (index === -1) {
    // Enable category
    currentState.enabledCategories.push(category)
    console.log(`[Focus Mode] Enabled category: ${category}`)
  } else {
    // Disable category
    currentState.enabledCategories.splice(index, 1)
    console.log(`[Focus Mode] Disabled category: ${category}`)
  }

  // Update blocking rules if focus mode is active
  if (currentState.isActive) {
    await updateBlockingRules()
  }

  // Save state to storage
  await saveFocusModeState(currentState)

  return getFocusModeState()
}

// Set enabled categories (for bulk updates)
export async function setEnabledCategories(
  categories: BlocklistCategory[]
): Promise<FocusModeState> {
  currentState.enabledCategories = [...categories]

  console.log(`[Focus Mode] Updated enabled categories:`, categories)

  // Update blocking rules if focus mode is active
  if (currentState.isActive) {
    await updateBlockingRules()
  }

  // Save state to storage
  await saveFocusModeState(currentState)

  return getFocusModeState()
}

// Normalize pattern for declarativeNetRequest urlFilter
function normalizePattern(pattern: string): string {
  // Remove protocol if present
  pattern = pattern.replace(/^https?:\/\//, "")

  // Remove leading *.
  pattern = pattern.replace(/^\*\./, "")

  // Remove trailing slashes
  pattern = pattern.replace(/\/+$/, "")

  return pattern
}

// Update dynamic blocking rules based on current state
async function updateBlockingRules(): Promise<void> {
  try {
    // Clear all existing rules first
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules()
    const ruleIdsToRemove = existingRules
      .filter((rule) => rule.id >= RULE_ID_START)
      .map((rule) => rule.id)

    if (ruleIdsToRemove.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIdsToRemove
      })
      console.log(`[Focus Mode] Removed ${ruleIdsToRemove.length} existing rules`)
    }

    // If focus mode is inactive, we're done
    if (!currentState.isActive) {
      console.log("[Focus Mode] No rules added (focus mode inactive)")
      return
    }

    // Load blocklist and filter by enabled categories
    const blocklist = await loadBlocklist()

    // Use the enabled categories from focus mode state
    const activeCategories = currentState.enabledCategories

    console.log(`[Focus Mode] Active categories:`, activeCategories)

    // Filter entries by active categories
    const entriesToBlock = blocklist.entries.filter((entry) =>
      activeCategories.includes(entry.category)
    )

    console.log(`[Focus Mode] Entries to block: ${entriesToBlock.length}`)

    // Convert entries to declarativeNetRequest rules
    const rulesToAdd: chrome.declarativeNetRequest.Rule[] = []
    const seenFilters = new Set<string>() // Track unique filters to avoid duplicates

    entriesToBlock.forEach((entry, index) => {
      const ruleId = RULE_ID_START + index

      // Convert pattern to urlFilter format for declarativeNetRequest
      // IMPORTANT: urlFilter must NOT contain protocol like https:// or *://
      const rawPattern = entry.pattern
      let urlFilter = ""
      let regexFilter: string | undefined = undefined

      if (entry.type === "domain" || entry.type === "url") {
        // Normalize pattern: *.youtube.com -> youtube.com
        let normalized = normalizePattern(rawPattern)
        
        // For URL patterns, extract just the domain (ignore paths)
        // youtube.com/feed/* -> youtube.com
        if (entry.type === "url" && normalized.includes("/")) {
          normalized = normalized.split("/")[0]
        }
        
        // Remove www. prefix to match all subdomains
        const domain = normalized.replace(/^www\./, "")
        
        // Use domain anchor || with separator ^ for full domain matching
        // ||youtube.com^ matches youtube.com, www.youtube.com, m.youtube.com, all paths
        urlFilter = `||${domain}^`
      } else if (entry.type === "regex") {
        // Regex pattern: /pattern/
        regexFilter = rawPattern.replace(/^\/|\/$/g, "")
      }

      const rule: chrome.declarativeNetRequest.Rule = {
        id: ruleId,
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.BLOCK
        },
        condition: {
          ...(urlFilter && { urlFilter }),
          ...(regexFilter && { regexFilter }),
          resourceTypes: [
            chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
            chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
            chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST
          ]
        }
      }

      console.log(`[Focus Mode] Rule ${ruleId}: "${rawPattern}" → urlFilter: "${urlFilter}"`)

      // Skip if we've already added this filter (deduplication)
      const filterKey = urlFilter || regexFilter || ""
      if (seenFilters.has(filterKey)) {
        console.log(`[Focus Mode] Skipping duplicate filter: "${filterKey}"`)
        return
      }
      seenFilters.add(filterKey)

      rulesToAdd.push(rule)
    })

    // Add rules to declarativeNetRequest
    if (rulesToAdd.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: rulesToAdd
      })
      console.log(`[Focus Mode] Added ${rulesToAdd.length} blocking rules`)
    }
  } catch (error) {
    console.error("[Focus Mode] Error updating blocking rules:", error)
  }
}

// Refresh blocking rules (call after blocklist changes)
export async function refreshBlockingRules(): Promise<void> {
  if (currentState.isActive) {
    console.log("[Focus Mode] Refreshing blocking rules...")
    await updateBlockingRules()
  }
}

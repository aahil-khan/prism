export type Label = {
  id: string
  name: string
  color?: string // Optional color for UI
}

const LABELS_KEY = "aegis-labels"
const DEFAULT_LABELS: Label[] = [
  { id: "dev", name: "Development", color: "#3B82F6" },
  { id: "research", name: "Research", color: "#8B5CF6" },
  { id: "shopping", name: "Shopping", color: "#EC4899" },
  { id: "learning", name: "Learning", color: "#F59E0B" },
  { id: "work", name: "Work", color: "#10B981" },
  { id: "personal", name: "Personal", color: "#6366F1" },
]

/**
 * Load labels from Chrome storage, or initialize with defaults
 */
export async function loadLabels(): Promise<Label[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get([LABELS_KEY], (result) => {
      const labels = result[LABELS_KEY]
      if (labels && Array.isArray(labels)) {
        resolve(labels)
      } else {
        // Initialize with defaults if not found
        saveLabels(DEFAULT_LABELS).then(() => resolve(DEFAULT_LABELS))
      }
    })
  })
}

/**
 * Save labels to Chrome storage
 */
export function saveLabels(labels: Label[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [LABELS_KEY]: labels }, () => {
      const err = chrome.runtime.lastError
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

/**
 * Add a new label
 */
export async function addLabel(label: Omit<Label, "id">): Promise<Label> {
  const labels = await loadLabels()
  const newLabel: Label = {
    id: `label-${Date.now()}`,
    ...label,
  }
  labels.push(newLabel)
  await saveLabels(labels)
  return newLabel
}

/**
 * Delete a label by ID
 */
export async function deleteLabel(id: string): Promise<void> {
  const labels = await loadLabels()
  const filtered = labels.filter((l) => l.id !== id)
  await saveLabels(filtered)
}

/**
 * Get a label by ID
 */
export async function getLabelById(id: string): Promise<Label | null> {
  const labels = await loadLabels()
  return labels.find((l) => l.id === id) || null
}

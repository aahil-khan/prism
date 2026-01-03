import type { Session } from "~/types/session"

const DB_NAME = "aegis-labelled-sessions"
const DB_VERSION = 1
const STORE_NAME = "labelled-sessions"

export type LabelledSession = Session & {
  labelId: string
  labelledAt: number // Timestamp when the session was labelled
}

/**
 * Open or create the IndexedDB database for labelled sessions
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error("❌ Failed to open labelled sessions IndexedDB:", request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" })
        // Create index for labelId to efficiently query sessions by label
        store.createIndex("labelId", "labelId", { unique: false })
        // Create index for labelledAt for sorting by date
        store.createIndex("labelledAt", "labelledAt", { unique: false })
      }
    }
  })
}

/**
 * Save a labelled session to IndexedDB
 */
export async function saveLabelledSession(session: LabelledSession): Promise<void> {
  try {
    const db = await openDatabase()
    const store = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME)
    const request = store.put(session)

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close()
        resolve()
      }

      request.onerror = () => {
        console.error("❌ Failed to save labelled session to IndexedDB:", request.error)
        db.close()
        reject(request.error)
      }
    })
  } catch (error) {
    console.error("❌ Error saving labelled session:", error)
    throw error
  }
}

/**
 * Get all labelled sessions for a specific label
 */
export async function getLabelledSessionsByLabelId(labelId: string): Promise<LabelledSession[]> {
  try {
    const db = await openDatabase()
    const store = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME)
    const index = store.index("labelId")
    const request = index.getAll(labelId)

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const sessions = request.result as LabelledSession[]
        db.close()
        // Sort by labelledAt in descending order (most recent first)
        resolve(sessions.sort((a, b) => b.labelledAt - a.labelledAt))
      }

      request.onerror = () => {
        console.error("❌ Failed to get labelled sessions from IndexedDB:", request.error)
        db.close()
        resolve([])
      }
    })
  } catch (error) {
    console.error("❌ Error loading labelled sessions:", error)
    return []
  }
}

/**
 * Get all labelled sessions
 */
export async function getAllLabelledSessions(): Promise<LabelledSession[]> {
  try {
    const db = await openDatabase()
    const store = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME)
    const request = store.getAll()

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const sessions = request.result as LabelledSession[]
        db.close()
        // Sort by labelledAt in descending order (most recent first)
        resolve(sessions.sort((a, b) => b.labelledAt - a.labelledAt))
      }

      request.onerror = () => {
        console.error("❌ Failed to get all labelled sessions from IndexedDB:", request.error)
        db.close()
        resolve([])
      }
    })
  } catch (error) {
    console.error("❌ Error loading all labelled sessions:", error)
    return []
  }
}

/**
 * Delete a labelled session by session ID
 */
export async function deleteLabelledSession(sessionId: string): Promise<void> {
  try {
    const db = await openDatabase()
    const store = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME)
    const request = store.delete(sessionId)

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close()
        resolve()
      }

      request.onerror = () => {
        console.error("❌ Failed to delete labelled session from IndexedDB:", request.error)
        db.close()
        reject(request.error)
      }
    })
  } catch (error) {
    console.error("❌ Error deleting labelled session:", error)
    throw error
  }
}

/**
 * Get a specific labelled session by ID
 */
export async function getLabelledSessionById(sessionId: string): Promise<LabelledSession | null> {
  try {
    const db = await openDatabase()
    const store = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME)
    const request = store.get(sessionId)

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const session = request.result as LabelledSession | undefined
        db.close()
        resolve(session || null)
      }

      request.onerror = () => {
        console.error("❌ Failed to get labelled session from IndexedDB:", request.error)
        db.close()
        resolve(null)
      }
    })
  } catch (error) {
    console.error("❌ Error loading labelled session:", error)
    return null
  }
}

/**
 * Update a labelled session
 */
export async function updateLabelledSession(session: LabelledSession): Promise<void> {
  try {
    const db = await openDatabase()
    const store = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME)
    const request = store.put(session)

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close()
        resolve()
      }

      request.onerror = () => {
        console.error("❌ Failed to update labelled session in IndexedDB:", request.error)
        db.close()
        reject(request.error)
      }
    })
  } catch (error) {
    console.error("❌ Error updating labelled session:", error)
    throw error
  }
}

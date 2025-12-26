import type { Session } from "~/types/session"

const DB_NAME = "aegis-sessions"
const DB_VERSION = 1
const STORE_NAME = "sessions"
const RECORD_KEY = "all-sessions"

/**
 * Open or create the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error("❌ Failed to open IndexedDB:", request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

/**
 * Load sessions from IndexedDB
 * Returns empty array if loading fails
 */
export async function loadSessions(): Promise<Session[]> {
  try {
    const db = await openDatabase()
    const store = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME)
    const request = store.get(RECORD_KEY)

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const data = request.result
        db.close()
        resolve(data ? data : [])
      }

      request.onerror = () => {
        console.error("❌ Failed to load sessions from IndexedDB:", request.error)
        db.close()
        resolve([])
      }
    })
  } catch (error) {
    console.error("❌ Error loading sessions:", error)
    return []
  }
}

/**
 * Save sessions to IndexedDB
 */
export async function saveSessions(sessions: Session[]): Promise<void> {
  try {
    const db = await openDatabase()
    const store = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME)
    const request = store.put(sessions, RECORD_KEY)

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close()
        resolve()
      }

      request.onerror = () => {
        console.error("❌ Failed to save sessions to IndexedDB:", request.error)
        db.close()
        reject(request.error)
      }
    })
  } catch (error) {
    console.error("❌ Error saving sessions:", error)
    throw error
  }
}

import type { PageEvent } from "~/types/page-event"
import type { Session } from "~/types/session"
import { searchByKeywords } from "~/lib/layer1-keyword-search"
import { searchSemantic } from "~/lib/layer2-semantic-search"
import { searchWithML } from "./layer3-ml-ranker"

export type SearchLayer = "ML" | "Semantic" | "Keyword"

export type SearchResult = {
  pageEvent: PageEvent
  score: number
  layer: SearchLayer
}

function flattenPages(sessions: Session[]): PageEvent[] {
  // Return the most recent unique page per URL to avoid duplicate results
  const byUrl = new Map<string, PageEvent>()
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i]
    for (let j = s.pages.length - 1; j >= 0; j--) {
      const p = s.pages[j]
      if (!byUrl.has(p.url)) {
        byUrl.set(p.url, p)
      }
    }
  }
  return Array.from(byUrl.values())
}

export async function executeSearch(query: string, sessions: Session[]): Promise<SearchResult[]> {
  const pages = flattenPages(sessions)
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return []

  // Layer 3: ML
  try {
    const mlResults = await searchWithML(trimmedQuery, pages)
    if (mlResults && mlResults.length > 0) {
      return mlResults.map((r) => ({ ...r, layer: "ML" as const }))
    }
  } catch (error) {
    console.error("ML search failed:", error)
  }

  // Layer 2: Semantic
  try {
    const semanticResults = searchSemantic(trimmedQuery, pages)
    if (semanticResults.length > 0) {
      return semanticResults.map((r) => ({ ...r, layer: "Semantic" as const }))
    }
  } catch (error) {
    console.error("Semantic search failed:", error)
  }

  // Layer 1: Keyword
  const keywordResults = searchByKeywords(trimmedQuery, pages)
  return keywordResults.map((r) => ({ ...r, layer: "Keyword" as const }))
}

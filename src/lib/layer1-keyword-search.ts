import type { PageEvent } from "~/types/page-event"

export type KeywordMatchResult = {
  pageEvent: PageEvent
  score: number
  matchCount: number
  matchedTerms: string[]
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

export function searchByKeywords(query: string, pages: PageEvent[]): KeywordMatchResult[] {
  const terms = tokenize(query)
  if (terms.length === 0) return []

  return pages
    .map((page) => {
      const titleTokens = tokenize(page.title)
      const titleSet = new Set(titleTokens)
      let matchCount = 0
      const matchedTerms: string[] = []

      for (const term of terms) {
        if (titleSet.has(term)) {
          matchCount += 1
          matchedTerms.push(term)
        }
      }

      if (matchCount === 0) return null

      // Simple scoring: match count plus slight boost for shorter titles (denser match)
      const densityBoost = 1 / Math.max(titleTokens.length, 1)
      const score = matchCount + densityBoost

      return {
        pageEvent: page,
        score,
        matchCount,
        matchedTerms
      }
    })
    .filter((result): result is KeywordMatchResult => result !== null)
    .sort((a, b) => b.score - a.score)
}

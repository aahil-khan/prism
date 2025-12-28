import type { PageEvent } from "~/types/page-event"
import { generateEmbedding } from "./embedding-engine"

export type MlMatchResult = {
  pageEvent: PageEvent
  score: number
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let sum = 0
  const len = Math.min(vecA.length, vecB.length)
  for (let i = 0; i < len; i++) {
    sum += vecA[i] * vecB[i]
  }
  return sum
}

export async function searchWithML(
  query: string,
  pages: PageEvent[],
  minScore = 0.3
): Promise<MlMatchResult[] | null> {
  if (!query.trim()) return []

  let queryEmbedding: number[] | null = null
  try {
    queryEmbedding = await generateEmbedding(query)
  } catch (error) {
    console.error("Failed to generate query embedding:", error)
    return null
  }

  if (!queryEmbedding) return null

  const results: MlMatchResult[] = []

  for (const page of pages) {
    if (!page.titleEmbedding) continue
    const score = cosineSimilarity(queryEmbedding, page.titleEmbedding)
    if (score >= minScore) {
      results.push({ pageEvent: page, score })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}

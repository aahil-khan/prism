import type { SearchResult } from "~/background/search-coordinator"

export function logSearchResults(query: string, results: SearchResult[], elapsedMs: number): void {
  console.log(`Search completed in ${elapsedMs.toFixed(1)}ms for query: "${query}"`)
  results.slice(0, 10).forEach((result, index) => {
    const { pageEvent, score, layer } = result
    console.log(
      `#${index + 1} [${layer}] score=${score.toFixed(4)} title="${pageEvent.title}" url=${pageEvent.url}`
    )
  })
  if (results.length === 0) {
    console.log("No results found for query:", query)
  }
}

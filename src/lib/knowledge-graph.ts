import type { PageEvent } from "~/types/page-event"

export interface GraphNode {
  id: string
  title: string
  url: string
  domain: string
  cluster: number
  visitCount: number
}

export interface GraphEdge {
  source: string
  target: string
  similarity: number
}

export interface KnowledgeGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  lastUpdated: number
}

// Compute cosine similarity between two vectors
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  return denominator === 0 ? 0 : dotProduct / denominator
}

// Build sparse similarity graph from pages
export function buildKnowledgeGraph(
  pages: PageEvent[],
  options: {
    similarityThreshold?: number
    maxEdgesPerNode?: number
    maxNodes?: number
  } = {}
): KnowledgeGraph {
  const {
    similarityThreshold = 0.35,
    maxEdgesPerNode = 8,
    maxNodes = 500
  } = options

  console.log("[KnowledgeGraph] Building graph from pages:", pages.length)

  // Deduplicate by URL, keeping latest visit
  const pageMap = new Map<string, PageEvent>()
  for (const page of pages) {
    const existing = pageMap.get(page.url)
    if (!existing || page.timestamp > existing.timestamp) {
      pageMap.set(page.url, page)
    }
  }

  // Filter pages with embeddings and apply maxNodes limit
  const validPages = Array.from(pageMap.values())
    .filter(p => p.titleEmbedding && p.titleEmbedding.length > 0)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, maxNodes)

  console.log("[KnowledgeGraph] Valid pages with embeddings:", validPages.length)

  if (validPages.length === 0) {
    return { nodes: [], edges: [], lastUpdated: Date.now() }
  }

  // Build nodes
  const nodes: GraphNode[] = validPages.map(page => ({
    id: page.url,
    title: page.title,
    url: page.url,
    domain: page.domain,
    cluster: -1,
    visitCount: page.visitCount || 1
  }))

  // Build sparse similarity edges
  const edges: GraphEdge[] = []
  const edgesByNode = new Map<string, Array<{ target: string; similarity: number }>>()

  for (let i = 0; i < validPages.length; i++) {
    const pageA = validPages[i]
    const neighbors: Array<{ target: string; similarity: number }> = []

    for (let j = i + 1; j < validPages.length; j++) {
      const pageB = validPages[j]
      const similarity = cosineSimilarity(pageA.titleEmbedding!, pageB.titleEmbedding!)

      if (similarity >= similarityThreshold) {
        neighbors.push({ target: pageB.url, similarity })
      }
    }

    // Keep top-k neighbors
    neighbors.sort((a, b) => b.similarity - a.similarity)
    const topNeighbors = neighbors.slice(0, maxEdgesPerNode)
    
    edgesByNode.set(pageA.url, topNeighbors)

    for (const neighbor of topNeighbors) {
      edges.push({
        source: pageA.url,
        target: neighbor.target,
        similarity: neighbor.similarity
      })
    }
  }

  console.log("[KnowledgeGraph] Built edges:", edges.length)

  // Assign clusters using connected components
  const clusters = findConnectedComponents(nodes, edges)
  nodes.forEach((node, idx) => {
    node.cluster = clusters[idx]
  })

  const uniqueClusters = new Set(clusters).size
  console.log("[KnowledgeGraph] Identified clusters:", uniqueClusters)

  return {
    nodes,
    edges,
    lastUpdated: Date.now()
  }
}

// Find connected components for clustering
function findConnectedComponents(nodes: GraphNode[], edges: GraphEdge[]): number[] {
  const nodeCount = nodes.length
  const clusters = new Array(nodeCount).fill(-1)
  const urlToIndex = new Map<string, number>()
  
  nodes.forEach((node, idx) => {
    urlToIndex.set(node.id, idx)
  })

  // Build adjacency list
  const adjacency = new Map<number, Set<number>>()
  for (let i = 0; i < nodeCount; i++) {
    adjacency.set(i, new Set())
  }

  for (const edge of edges) {
    const sourceIdx = urlToIndex.get(edge.source)
    const targetIdx = urlToIndex.get(edge.target)
    if (sourceIdx !== undefined && targetIdx !== undefined) {
      adjacency.get(sourceIdx)!.add(targetIdx)
      adjacency.get(targetIdx)!.add(sourceIdx)
    }
  }

  // BFS to find connected components
  let currentCluster = 0
  for (let i = 0; i < nodeCount; i++) {
    if (clusters[i] === -1) {
      const queue = [i]
      clusters[i] = currentCluster

      while (queue.length > 0) {
        const node = queue.shift()!
        const neighbors = adjacency.get(node)!
        
        for (const neighbor of neighbors) {
          if (clusters[neighbor] === -1) {
            clusters[neighbor] = currentCluster
            queue.push(neighbor)
          }
        }
      }
      
      currentCluster++
    }
  }

  return clusters
}

// Get cluster color for visualization
export function getClusterColor(clusterId: number): string {
  const colors = [
    "#2563eb", // blue-600
    "#059669", // emerald-600
    "#d97706", // amber-600
    "#dc2626", // red-600
    "#7c3aed", // violet-600
    "#db2777", // pink-600
    "#0891b2", // cyan-600
    "#ea580c", // orange-600
    "#0d9488", // teal-600
    "#4f46e5", // indigo-600
    "#9333ea", // purple-600
    "#65a30d", // lime-600
    "#0284c7", // sky-600
    "#c026d3", // fuchsia-600
    "#be123c", // rose-600
  ]
  return colors[clusterId % colors.length]
}

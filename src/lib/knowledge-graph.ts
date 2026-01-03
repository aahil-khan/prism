import type { PageEvent } from "~/types/page-event"

export interface GraphNode {
  id: string
  title: string
  url: string
  domain: string
  cluster: number
  visitCount: number
  searchQuery?: string // Extracted search query for search engine results
}

export interface GraphEdge {
  source: string
  target: string
  similarity: number
  weight?: number // Multi-factor composite weight
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

// Extract keywords from title for Jaccard similarity
function extractKeywords(title: string): Set<string> {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'should', 'could', 'may', 'might', 'must', 'can'
  ])
  
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
  )
}

// Compute Jaccard similarity between keyword sets
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0
  
  const intersection = new Set([...setA].filter(x => setB.has(x)))
  const union = new Set([...setA, ...setB])
  
  return intersection.size / union.size
}

// Calculate multi-factor edge weight
function calculateEdgeWeight(
  pageA: PageEvent,
  pageB: PageEvent,
  embeddingSimilarity: number,
  domainCountInGraph: Map<string, number>
): number {
  // α: Embedding similarity (semantic closeness) - 0.6
  const embeddingComponent = embeddingSimilarity * 0.6
  
  // β: Keyword Jaccard similarity (lexical overlap) - 0.2
  const keywordsA = extractKeywords(pageA.title)
  const keywordsB = extractKeywords(pageB.title)
  const keywordComponent = jaccardSimilarity(keywordsA, keywordsB) * 0.2
  
  // γ: Temporal proximity (visited close in time) - 0.1
  const timeDiff = Math.abs(pageA.timestamp - pageB.timestamp)
  const hoursDiff = timeDiff / (1000 * 60 * 60)
  const temporalComponent = Math.exp(-hoursDiff / 24) * 0.1 // Decay over 24 hours
  
  // δ: Domain penalty (prevent single-domain dominance) - 0.1
  let domainPenalty = 0
  if (pageA.domain === pageB.domain) {
    const domainCount = domainCountInGraph.get(pageA.domain) || 1
    // Penalize if domain is overrepresented (>10% of graph)
    if (domainCount > 10) {
      domainPenalty = Math.min(0.1, domainCount / 1000)
    }
  }
  
  const weight = embeddingComponent + keywordComponent + temporalComponent - domainPenalty
  return Math.max(0, Math.min(1, weight)) // Clamp to [0, 1]
}

// Filter out authentication, login, and non-content pages
function isUtilityPage(page: PageEvent): boolean {
  const titleLower = page.title.toLowerCase()
  const urlLower = page.url.toLowerCase()
  
  // Filter out search engine result pages
  if (urlLower.includes('google.com/search') ||
      urlLower.includes('google.co.in/search') ||
      urlLower.includes('google.co.uk/search') ||
      urlLower.includes('google.ca/search') ||
      urlLower.includes('bing.com/search') ||
      urlLower.includes('duckduckgo.com/?q=') ||
      urlLower.includes('yahoo.com/search') ||
      urlLower.includes('baidu.com/s?')) {
    return true
  }
  
  // Filter out browser utility pages
  if (urlLower.startsWith('chrome://') ||
      urlLower.startsWith('chrome-extension://') ||
      urlLower.startsWith('edge://') ||
      urlLower.startsWith('about:') ||
      urlLower.startsWith('brave://') ||
      urlLower.includes('/bookmarks') ||
      urlLower.includes('/extensions') ||
      urlLower.includes('/settings')) {
    return true
  }
  
  const utilityPatterns = [
    // Authentication & Login
    /sign\s*in/i,
    /log\s*in/i,
    /login/i,
    /signin/i,
    /authenticate/i,
    /authentication/i,
    
    // Account creation
    /sign\s*up/i,
    /signup/i,
    /create\s*account/i,
    /register/i,
    /registration/i,
    
    // Password & Security
    /password\s*reset/i,
    /forgot\s*password/i,
    /reset\s*password/i,
    /verify/i,
    /verification/i,
    /two.factor/i,
    /2fa/i,
    
    // OAuth & SSO
    /oauth/i,
    /sso/i,
    /authorize/i,
    /consent/i,
    
    // Generic utility pages
    /^(404|403|500|error)/i,
    /page\s*not\s*found/i,
    /access\s*denied/i,
    /cookie\s*(policy|consent)/i,
    /privacy\s*policy/i,
    /terms\s*(of\s*service|and\s*conditions)/i,
    /about\s*blank/i,
  ]
  
  // Check if title or URL matches any utility pattern
  if (utilityPatterns.some(pattern => 
    pattern.test(titleLower) || pattern.test(urlLower)
  )) {
    return true
  }
  
  // Filter out domain-only pages (homepages without specific content)
  try {
    const url = new URL(page.url)
    const path = url.pathname
    const hasParams = url.search.length > 0
    
    // If path is just "/" or empty and no query params, it's likely just a domain homepage
    if ((path === '/' || path === '') && !hasParams) {
      return true
    }
  } catch (e) {
    // Invalid URL, skip filtering
  }
  
  return false
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
    similarityThreshold = 0.55,
    maxEdgesPerNode = 8,
    maxNodes = 500
  } = options

  console.log("[KnowledgeGraph] Building graph from pages:", pages.length)

  // Filter out utility pages (login, auth, error pages, etc.)
  const contentPages = pages.filter(page => !isUtilityPage(page))
  console.log("[KnowledgeGraph] Filtered out utility pages:", pages.length - contentPages.length)

  // First deduplicate by URL, keeping latest visit
  const pageMap = new Map<string, PageEvent>()
  for (const page of contentPages) {
    const existing = pageMap.get(page.url)
    if (!existing || page.timestamp > existing.timestamp) {
      pageMap.set(page.url, page)
    }
  }

  // Filter pages with embeddings
  const pagesWithEmbeddings = Array.from(pageMap.values())
    .filter(p => p.titleEmbedding && p.titleEmbedding.length > 0)
    .sort((a, b) => b.timestamp - a.timestamp)

  // Now merge by title - aggregate visit counts for same titles
  const titleMap = new Map<string, PageEvent>()
  for (const page of pagesWithEmbeddings) {
    const existing = titleMap.get(page.title)
    if (existing) {
      // Merge: keep the most recent one, but sum visit counts
      existing.visitCount = (existing.visitCount || 1) + (page.visitCount || 1)
    } else {
      titleMap.set(page.title, { ...page })
    }
  }

  // Apply maxNodes limit
  const validPages = Array.from(titleMap.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, maxNodes)

  console.log("[KnowledgeGraph] Valid pages with embeddings:", validPages.length)

  if (validPages.length === 0) {
    return { nodes: [], edges: [], lastUpdated: Date.now() }
  }

  // Build nodes (using title as ID now)
  const nodes: GraphNode[] = validPages.map(page => ({
    id: page.title, // Use title as ID to ensure uniqueness by title
    title: page.title,
    url: page.url,
    domain: page.domain,
    cluster: -1,
    visitCount: page.visitCount || 1,
    searchQuery: page.searchQuery // Preserve search query if available
  }))

  // Count domain occurrences for penalty calculation
  const domainCounts = new Map<string, number>()
  for (const page of validPages) {
    domainCounts.set(page.domain, (domainCounts.get(page.domain) || 0) + 1)
  }

  // Build weighted graph with multi-factor similarity
  const edges: GraphEdge[] = []
  const edgesByNode = new Map<string, Array<{ target: string; similarity: number; weight: number }>>()

  for (let i = 0; i < validPages.length; i++) {
    const pageA = validPages[i]
    const neighbors: Array<{ target: string; similarity: number; weight: number }> = []

    for (let j = i + 1; j < validPages.length; j++) {
      const pageB = validPages[j]
      const embeddingSimilarity = cosineSimilarity(pageA.titleEmbedding!, pageB.titleEmbedding!)

      // Only consider if embedding similarity exceeds minimum threshold
      if (embeddingSimilarity >= similarityThreshold) {
        const weight = calculateEdgeWeight(pageA, pageB, embeddingSimilarity, domainCounts)
        neighbors.push({ 
          target: pageB.title, 
          similarity: embeddingSimilarity,
          weight: weight
        })
      }
    }

    // Keep top-k neighbors by weight (not just similarity)
    neighbors.sort((a, b) => b.weight - a.weight)
    const topNeighbors = neighbors.slice(0, maxEdgesPerNode)
    
    edgesByNode.set(pageA.title, topNeighbors)

    for (const neighbor of topNeighbors) {
      edges.push({
        source: pageA.title,
        target: neighbor.target,
        similarity: neighbor.similarity,
        weight: neighbor.weight
      })
    }
  }

  console.log("[KnowledgeGraph] Built weighted edges:", edges.length)

  // Assign clusters using Louvain community detection
  const clusters = louvainClustering(nodes, edges)
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

// Louvain community detection algorithm (simplified, optimized for browser)
function louvainClustering(nodes: GraphNode[], edges: GraphEdge[]): number[] {
  const nodeCount = nodes.length
  if (nodeCount === 0) return []
  
  const idToIndex = new Map<string, number>()
  nodes.forEach((node, idx) => idToIndex.set(node.id, idx))
  
  // Build weighted adjacency list
  const adjacency: Map<number, Map<number, number>> = new Map()
  const nodeDegree: number[] = new Array(nodeCount).fill(0)
  let totalWeight = 0
  
  for (let i = 0; i < nodeCount; i++) {
    adjacency.set(i, new Map())
  }
  
  for (const edge of edges) {
    const i = idToIndex.get(edge.source)
    const j = idToIndex.get(edge.target)
    if (i === undefined || j === undefined) continue
    
    const weight = edge.weight || edge.similarity
    adjacency.get(i)!.set(j, weight)
    adjacency.get(j)!.set(i, weight)
    nodeDegree[i] += weight
    nodeDegree[j] += weight
    totalWeight += weight * 2
  }
  
  // Initialize: each node in its own community
  let communities = nodes.map((_, idx) => idx)
  let improved = true
  let iterations = 0
  const maxIterations = 10
  
  while (improved && iterations < maxIterations) {
    improved = false
    iterations++
    
    // For each node, try moving it to neighbor communities
    for (let nodeIdx = 0; nodeIdx < nodeCount; nodeIdx++) {
      const currentCommunity = communities[nodeIdx]
      let bestCommunity = currentCommunity
      let bestGain = 0
      
      // Get neighboring communities
      const neighborCommunities = new Set<number>()
      for (const [neighbor] of adjacency.get(nodeIdx)!) {
        neighborCommunities.add(communities[neighbor])
      }
      
      // Try each neighboring community
      for (const targetCommunity of neighborCommunities) {
        if (targetCommunity === currentCommunity) continue
        
        const gain = modularityGain(
          nodeIdx,
          currentCommunity,
          targetCommunity,
          communities,
          adjacency,
          nodeDegree,
          totalWeight
        )
        
        if (gain > bestGain) {
          bestGain = gain
          bestCommunity = targetCommunity
        }
      }
      
      // Move to best community if improvement found
      if (bestCommunity !== currentCommunity) {
        communities[nodeIdx] = bestCommunity
        improved = true
      }
    }
  }
  
  // Renumber communities to be contiguous
  const communityMap = new Map<number, number>()
  let nextId = 0
  
  return communities.map(comm => {
    if (!communityMap.has(comm)) {
      communityMap.set(comm, nextId++)
    }
    return communityMap.get(comm)!
  })
}

// Calculate modularity gain for moving a node between communities
function modularityGain(
  node: number,
  fromComm: number,
  toComm: number,
  communities: number[],
  adjacency: Map<number, Map<number, number>>,
  nodeDegree: number[],
  totalWeight: number
): number {
  // Sum of weights from node to nodes in target community
  let weightToComm = 0
  let weightFromComm = 0
  
  const nodeNeighbors = adjacency.get(node)!
  
  for (let i = 0; i < communities.length; i++) {
    const weight = nodeNeighbors.get(i) || 0
    if (communities[i] === toComm) {
      weightToComm += weight
    }
    if (communities[i] === fromComm && i !== node) {
      weightFromComm += weight
    }
  }
  
  const nodeDeg = nodeDegree[node]
  const m2 = totalWeight
  
  // Simplified modularity gain calculation
  const gain = (weightToComm - weightFromComm) / m2 - 
               (nodeDeg * (sumCommunityDegree(toComm, communities, nodeDegree) - 
                          sumCommunityDegree(fromComm, communities, nodeDegree))) / (m2 * m2)
  
  return gain
}

function sumCommunityDegree(community: number, communities: number[], nodeDegree: number[]): number {
  let sum = 0
  for (let i = 0; i < communities.length; i++) {
    if (communities[i] === community) {
      sum += nodeDegree[i]
    }
  }
  return sum
}

// Helper function to clean domain names
function cleanDomainName(domain: string): string {
  return domain
    .replace(/^www\./, '')
    .replace(/\.com$/, '')
    .replace(/\.org$/, '')
    .replace(/\.net$/, '')
    .replace(/\.co\.in$/, '')
    .replace(/\.ai$/, '')
    .replace(/\.io$/, '')
    .split('.')[0]
}

// Generate smart label for a cluster based on its nodes
export function generateClusterLabel(nodes: any[], clusterId: number): string {
  const clusterNodes = nodes.filter(n => n.cluster === clusterId)
  
  if (clusterNodes.length === 0) return `Cluster ${clusterId}`
  if (clusterNodes.length === 1) return cleanDomainName(clusterNodes[0].domain)
  
  // Extract domains
  const domainCounts = new Map<string, number>()
  for (const node of clusterNodes) {
    const count = domainCounts.get(node.domain) || 0
    domainCounts.set(node.domain, count + node.visitCount)
  }
  
  // Get top 2 domains by weighted visit count
  const topDomains = Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([domain]) => cleanDomainName(domain))
  
  // Extract common keywords from titles
  const keywords = new Map<string, number>()
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can'])
  
  for (const node of clusterNodes) {
    const title = node.title || node.name || ''
    const words = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w))
    
    for (const word of words) {
      keywords.set(word, (keywords.get(word) || 0) + 1)
    }
  }
  
  // Get most common keyword that appears in at least 30% of cluster
  const minOccurrence = Math.ceil(clusterNodes.length * 0.3)
  const topKeyword = Array.from(keywords.entries())
    .filter(([_, count]) => count >= minOccurrence)
    .sort((a, b) => b[1] - a[1])[0]
  
  // Build label
  if (topDomains.length === 2 && topDomains[0] !== topDomains[1]) {
    return `${topDomains[0]} & ${topDomains[1]}`
  } else if (topDomains.length >= 1 && topKeyword) {
    const keyword = topKeyword[0].charAt(0).toUpperCase() + topKeyword[0].slice(1)
    return `${topDomains[0]} (${keyword})`
  } else if (topDomains.length >= 1) {
    const nodeCount = clusterNodes.length
    return `${topDomains[0]} (${nodeCount})`
  }
  
  return `Cluster ${clusterId}`
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

import { useEffect, useRef, useState, useCallback } from "react"
import ForceGraph2D from "react-force-graph-2d"
import { Search, X, ChevronDown, RotateCw, Sliders, ZoomIn, ZoomOut, Link, Maximize2 } from "lucide-react"
import type { KnowledgeGraph, GraphNode } from "~/lib/knowledge-graph"
import { getClusterColor, generateClusterLabel } from "~/lib/knowledge-graph"

function sendMessage<T>(message: any): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const err = chrome.runtime.lastError
      if (err) {
        reject(err)
      } else {
        resolve(response as T)
      }
    })
  })
}

export function GraphPanel() {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [minSimilarity, setMinSimilarity] = useState(0.50)
  const [selectedClusters, setSelectedClusters] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "week">("all")
  const [showFilters, setShowFilters] = useState(false)
  const [showLabels, setShowLabels] = useState(true)
  const [manualLinkMode, setManualLinkMode] = useState(false)
  const [selectedNodesForLink, setSelectedNodesForLink] = useState<string[]>([])
  const [manualLinks, setManualLinks] = useState<Array<{source: string, target: string}>>([])
  const [showExplanations, setShowExplanations] = useState(false)
  const graphRef = useRef<any>()
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 500, height: 400 })
  const hasUserInteractedRef = useRef(false)
  const lastGraphTimestampRef = useRef<number>(0)
  const faviconCache = useRef<Map<string, HTMLImageElement>>(new Map())

  // Load manual links from storage
  useEffect(() => {
    chrome.storage.local.get(['manualLinks'], (result) => {
      if (result.manualLinks) {
        setManualLinks(result.manualLinks)
      }
    })
  }, [])

  const saveManualLinks = (links: Array<{source: string, target: string}>) => {
    chrome.storage.local.set({ manualLinks: links })
    setManualLinks(links)
  }

  const loadGraph = useCallback(async () => {
    setLoading(true)
    try {
      const response = await sendMessage<{ graph: KnowledgeGraph }>({ type: "GET_GRAPH" })
      if (response?.graph) {
        // Only update if graph has actually changed
        if (response.graph.lastUpdated !== lastGraphTimestampRef.current) {
          console.log("[GraphPanel] Graph data changed, updating UI")
          setGraph(response.graph)
          lastGraphTimestampRef.current = response.graph.lastUpdated
          hasUserInteractedRef.current = false // Reset on new graph load
        }
      }
    } catch (err) {
      console.error("[GraphPanel] Failed to load graph:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleRefresh = async () => {
    try {
      // Get current active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const currentUrl = activeTab?.url
      const currentDomain = currentUrl ? new URL(currentUrl).hostname : null
      
      const response = await sendMessage<{ graph: KnowledgeGraph }>({ type: "REFRESH_GRAPH" })
      if (response?.graph) {
        setGraph(response.graph)
        lastGraphTimestampRef.current = response.graph.lastUpdated
        
        // Find node matching current tab
        if (currentDomain && graphRef.current) {
          setTimeout(() => {
            if (!graphRef.current) return
            
            const matchingNode = response.graph.nodes.find(node => 
              node.domain === currentDomain || node.url.includes(currentDomain)
            )
            
            if (matchingNode) {
              // Focus on the matching node's cluster
              const clusterNodes = response.graph.nodes.filter(n => n.cluster === matchingNode.cluster)
              
              // Calculate cluster center
              let sumX = 0, sumY = 0, count = 0
              clusterNodes.forEach(node => {
                const graphNode = graphRef.current.graphData().nodes.find((n: any) => n.id === node.id)
                if (graphNode && graphNode.x !== undefined && graphNode.y !== undefined) {
                  sumX += graphNode.x
                  sumY += graphNode.y
                  count++
                }
              })
              
              if (count > 0) {
                const centerX = sumX / count
                const centerY = sumY / count
                graphRef.current.centerAt(centerX, centerY, 400)
                graphRef.current.zoom(2, 400)
                console.log(`[GraphPanel] Focused on cluster ${matchingNode.cluster} for domain ${currentDomain}`)
              }
            } else {
              // No matching node, zoom to fit all
              graphRef.current.zoomToFit(400, 50)
            }
          }, 800)
        } else {
          hasUserInteractedRef.current = false // Allow auto-fit if no current tab
        }
      }
    } catch (err) {
      console.error("[GraphPanel] Failed to refresh graph:", err)
    }
  }

  useEffect(() => {
    loadGraph()
    // Only load once on mount, no polling
  }, [loadGraph])

  // Preload favicons when graph updates
  useEffect(() => {
    if (!graph) return
    
    const clusters = new Set(graph.nodes.map(n => n.cluster))
    clusters.forEach(clusterId => {
      const topDomain = getClusterTopDomain(graph.nodes, clusterId)
      if (topDomain && !faviconCache.current.has(topDomain)) {
        loadFavicon(topDomain).catch(err => 
          console.log('[GraphPanel] Failed to load favicon for', topDomain)
        )
      }
    })
  }, [graph])

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth
        const height = 400
        setDimensions({ width, height })
      }
    }
    
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  useEffect(() => {
    if (graph) {
      console.log("[GraphPanel] Graph loaded:", {
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        nodesSample: graph.nodes.slice(0, 2),
        edgesSample: graph.edges.slice(0, 2)
      })
      
      // Auto-fit when new graph data loads
      if (!hasUserInteractedRef.current && graphRef.current) {
        setTimeout(() => {
          if (graphRef.current && !hasUserInteractedRef.current) {
            graphRef.current.zoomToFit(400, 80)
            // Apply additional zoom out for better initial view
            setTimeout(() => {
              if (graphRef.current && !hasUserInteractedRef.current) {
                const currentZoom = graphRef.current.zoom()
                graphRef.current.zoom(currentZoom * 0.7, 200)
              }
            }, 450)
          }
        }, 500)
      }
    }
  }, [graph])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin">
            <RotateCw className="h-6 w-6" style={{ color: '#0072de' }} />
          </div>
          <p className="text-xs" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
            Loading knowledge graph...
          </p>
        </div>
      </div>
    )
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Search className="h-10 w-10 opacity-20" style={{ color: '#9A9FA6' }} />
        <div className="text-center">
          <p className="text-sm mb-2" style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
            No pages available yet
          </p>
          <p className="text-xs" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
            Visit some pages to build the graph
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
          style={{ backgroundColor: '#0072de', color: 'white', fontFamily: "'Breeze Sans'" }}>
          Refresh Graph
        </button>
      </div>
    )
  }

  const clusters = Array.from(new Set(graph.nodes.map(n => n.cluster)))
  const allClustersSelected = selectedClusters.size === 0

  // Apply time filter
  let timeFilteredNodes = graph.nodes
  if (timeFilter !== "all") {
    const now = Date.now()
    const cutoff = timeFilter === "today" 
      ? now - 24 * 60 * 60 * 1000 
      : now - 7 * 24 * 60 * 60 * 1000
    
    timeFilteredNodes = graph.nodes.filter(n => {
      return (graph.lastUpdated - (n.visitCount * 1000)) >= cutoff
    })
  }

  // Apply search filter
  const searchFilteredNodes = searchQuery.trim()
    ? timeFilteredNodes.filter(n => 
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.domain.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : timeFilteredNodes

  // Apply cluster filter
  const filteredNodes = searchFilteredNodes.filter(n => {
    if (allClustersSelected) return true
    return selectedClusters.has(n.cluster)
  })

  // Create set of filtered node IDs
  const filteredNodeIds = new Set(filteredNodes.map(n => n.id))

  // Filter edges based on cluster-filtered nodes
  // Use weight (composite) instead of similarity (embedding-only) for multi-factor filtering
  const filteredEdges = graph.edges.filter(e => 
    (e.weight || e.similarity) >= minSimilarity &&
    filteredNodeIds.has(e.source) &&
    filteredNodeIds.has(e.target)
  )

  // Group nodes by cluster and find clusters with at least 2 nodes
  const nodesByCluster = new Map<number, typeof filteredNodes>()
  filteredNodes.forEach(n => {
    if (!nodesByCluster.has(n.cluster)) {
      nodesByCluster.set(n.cluster, [])
    }
    nodesByCluster.get(n.cluster)!.push(n)
  })
  
  const clustersWithMultipleNodes = Array.from(nodesByCluster.entries())
    .filter(([, nodes]) => nodes.length >= 2)
    .map(([clusterId]) => clusterId)

  // Transform to react-force-graph format
  const graphData = {
    nodes: filteredNodes.map(n => {
      // Use domain as label for clean, readable display
      const displayLabel = n.domain
      
      return {
        id: n.id,
        name: n.title,
        url: n.url,
        domain: n.domain,
        cluster: n.cluster,
        visitCount: n.visitCount,
        searchQuery: n.searchQuery,
        color: getClusterColor(n.cluster),
        label: displayLabel
      }
    }),
    links: [
      ...filteredEdges.map(e => ({
        source: e.source,
        target: e.target,
        value: e.similarity,
        isManual: false
      })),
      ...manualLinks
        .filter(link => 
          filteredNodeIds.has(link.source) && 
          filteredNodeIds.has(link.target)
        )
        .map(link => ({
          source: link.source,
          target: link.target,
          value: 1,
          isManual: true
        }))
    ]
  }

  const handleNodeClick = (node: any) => {
    if (manualLinkMode) {
      // Manual linking mode
      if (selectedNodesForLink.includes(node.id)) {
        // Deselect node
        setSelectedNodesForLink(prev => prev.filter(id => id !== node.id))
      } else if (selectedNodesForLink.length === 0) {
        // Select first node
        setSelectedNodesForLink([node.id])
      } else if (selectedNodesForLink.length === 1) {
        // Select second node and check for existing link
        const [firstNode] = selectedNodesForLink
        
        // Check if manual link already exists
        const existingLinkIndex = manualLinks.findIndex(
          link => 
            (link.source === firstNode && link.target === node.id) ||
            (link.source === node.id && link.target === firstNode)
        )
        
        if (existingLinkIndex !== -1) {
          // Link exists - remove it
          const updatedLinks = manualLinks.filter((_, idx) => idx !== existingLinkIndex)
          saveManualLinks(updatedLinks)
          console.log('[GraphPanel] Removed manual link between', firstNode, 'and', node.id)
        } else {
          // Link doesn't exist - create it
          const newLink = { source: firstNode, target: node.id }
          saveManualLinks([...manualLinks, newLink])
          console.log('[GraphPanel] Created manual link between', firstNode, 'and', node.id)
        }
        
        // Clear selection
        setSelectedNodesForLink([])
      }
    } else {
      // Normal mode - open URL
      if (node.url) {
        chrome.tabs.create({ url: node.url })
      }
    }
  }

  const handleZoomIn = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom()
      graphRef.current.zoom(currentZoom * 1.5, 300)
      hasUserInteractedRef.current = true
    }
  }

  const handleZoomOut = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom()
      graphRef.current.zoom(currentZoom / 1.5, 300)
      hasUserInteractedRef.current = true
    }
  }

  const handleZoomReset = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 80)
      setTimeout(() => {
        if (graphRef.current) {
          const currentZoom = graphRef.current.zoom()
          graphRef.current.zoom(currentZoom * 0.7, 200)
        }
      }, 450)
      hasUserInteractedRef.current = true
    }
  }

  // Get top domain for a cluster
  const getClusterTopDomain = (nodes: any[], clusterId: number): string | null => {
    const clusterNodes = nodes.filter(n => n.cluster === clusterId)
    if (clusterNodes.length === 0) return null
    
    const domainCounts = new Map<string, number>()
    for (const node of clusterNodes) {
      const count = domainCounts.get(node.domain) || 0
      domainCounts.set(node.domain, count + node.visitCount)
    }
    
    const topDomain = Array.from(domainCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]
    
    return topDomain ? topDomain[0] : null
  }

  // Load favicon for domain
  const loadFavicon = (domain: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      if (faviconCache.current.has(domain)) {
        resolve(faviconCache.current.get(domain)!)
        return
      }

      const img = new Image()
      img.crossOrigin = 'anonymous'
      
      // Try Google's favicon service first
      img.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
      
      img.onload = () => {
        faviconCache.current.set(domain, img)
        resolve(img)
      }
      
      img.onerror = () => {
        // Create a placeholder circle with first letter
        const canvas = document.createElement('canvas')
        canvas.width = 16
        canvas.height = 16
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#e5e7eb'
        ctx.fillRect(0, 0, 16, 16)
        ctx.fillStyle = '#6b7280'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(domain[0].toUpperCase(), 8, 8)
        
        const placeholderImg = new Image()
        placeholderImg.src = canvas.toDataURL()
        placeholderImg.onload = () => {
          faviconCache.current.set(domain, placeholderImg)
          resolve(placeholderImg)
        }
      }
    })
  }

  // Draw cluster boundaries for clusters with 2+ nodes
  const drawClusterBoundaries = (ctx: CanvasRenderingContext2D, globalScale: number) => {
    // Only draw if zoomed out too much
    if (globalScale < 0.5) return
    
    // Helper: Find connected components within a set of nodes
    const getConnectedComponents = (nodes: any[], allEdges: any[]) => {
      const components: Array<Set<string>> = []
      const visited = new Set<string>()
      
      // Build adjacency list from edges
      const nodeIds = new Set(nodes.map(n => n.id))
      const adjacency = new Map<string, Set<string>>()
      nodes.forEach(n => adjacency.set(n.id, new Set()))
      
      allEdges.forEach((edge: any) => {
        const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source
        const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target
        
        if (nodeIds.has(sourceId) && nodeIds.has(targetId)) {
          adjacency.get(sourceId)?.add(targetId)
          adjacency.get(targetId)?.add(sourceId)
        }
      })
      
      // BFS to find connected components
      const bfs = (startId: string): Set<string> => {
        const component = new Set<string>()
        const queue = [startId]
        visited.add(startId)
        component.add(startId)
        
        while (queue.length > 0) {
          const nodeId = queue.shift()!
          const neighbors = adjacency.get(nodeId) || new Set()
          
          for (const neighborId of neighbors) {
            if (!visited.has(neighborId)) {
              visited.add(neighborId)
              component.add(neighborId)
              queue.push(neighborId)
            }
          }
        }
        
        return component
      }
      
      // Find all components
      nodes.forEach(node => {
        if (!visited.has(node.id)) {
          const component = bfs(node.id)
          if (component.size >= 2) { // Only boundaries for 2+ connected nodes
            components.push(component)
          }
        }
      })
      
      return components
    }
    
    // Group nodes by Louvain cluster
    const louvainClusters = new Map<number, any[]>()
    graphData.nodes.forEach(n => {
      if (!louvainClusters.has(n.cluster)) {
        louvainClusters.set(n.cluster, [])
      }
      louvainClusters.get(n.cluster)!.push(n)
    })
    
    // For each Louvain cluster, find connected components
    const allComponents: Array<{nodes: any[], clusterId: number, componentId: number}> = []
    louvainClusters.forEach((clusterNodes, clusterId) => {
      if (clusterNodes.length < 2) return
      
      const components = getConnectedComponents(clusterNodes, graphData.links)
      components.forEach((componentNodeIds, idx) => {
        const componentNodes = clusterNodes.filter(n => componentNodeIds.has(n.id))
        if (componentNodes.length >= 2) {
          allComponents.push({
            nodes: componentNodes,
            clusterId,
            componentId: idx
          })
        }
      })
    })
    
    // Draw boundary for each connected component
    allComponents.forEach(({nodes: clusterNodes, clusterId}) => {
      
      // Calculate bounding box for cluster nodes
      const xs = clusterNodes.map((n: any) => n.x).filter(x => x !== undefined)
      const ys = clusterNodes.map((n: any) => n.y).filter(y => y !== undefined)
      
      if (xs.length === 0 || ys.length === 0) return
      
      const minX = Math.min(...xs) - 20
      const maxX = Math.max(...xs) + 20
      const minY = Math.min(...ys) - 20
      const maxY = Math.max(...ys) + 20
      
      const padding = 15 / globalScale
      
      // Draw rounded rectangle around cluster
      ctx.beginPath()
      const radius = 10 / globalScale
      ctx.moveTo(minX - padding + radius, minY - padding)
      ctx.lineTo(maxX + padding - radius, minY - padding)
      ctx.quadraticCurveTo(maxX + padding, minY - padding, maxX + padding, minY - padding + radius)
      ctx.lineTo(maxX + padding, maxY + padding - radius)
      ctx.quadraticCurveTo(maxX + padding, maxY + padding, maxX + padding - radius, maxY + padding)
      ctx.lineTo(minX - padding + radius, maxY + padding)
      ctx.quadraticCurveTo(minX - padding, maxY + padding, minX - padding, maxY + padding - radius)
      ctx.lineTo(minX - padding, minY - padding + radius)
      ctx.quadraticCurveTo(minX - padding, minY - padding, minX - padding + radius, minY - padding)
      ctx.closePath()
      
      const color = getClusterColor(clusterId)
      ctx.strokeStyle = color + '30' // 19% opacity
      ctx.lineWidth = 1.5 / globalScale
      ctx.setLineDash([4 / globalScale, 4 / globalScale])
      ctx.stroke()
      ctx.setLineDash([])
      
      ctx.fillStyle = color + '08' // 3% opacity
      ctx.fill()
      
      // Draw cluster label at the top
      const clusterLabel = generateClusterLabel(graphData.nodes, clusterId)
      const centerX = (minX + maxX) / 2
      const labelY = minY - padding - (20 / globalScale)
      
      // Get favicon for cluster's top domain
      const topDomain = getClusterTopDomain(graphData.nodes, clusterId)
      const favicon = topDomain && faviconCache.current.has(topDomain) 
        ? faviconCache.current.get(topDomain)! 
        : null
      
      // Set font and measure text
      const fontSize = 10 / globalScale
      ctx.font = `${fontSize}px 'Breeze Sans', sans-serif`
      const textWidth = ctx.measureText(clusterLabel).width
      const labelPadding = 6 / globalScale
      const iconSize = favicon ? 12 / globalScale : 0
      const iconPadding = favicon ? 4 / globalScale : 0
      
      // Draw label background with border
      ctx.fillStyle = 'white'
      ctx.strokeStyle = color + '60'
      ctx.lineWidth = 1 / globalScale
      ctx.setLineDash([])
      const totalWidth = iconSize + iconPadding + textWidth
      const labelRectX = centerX - totalWidth/2 - labelPadding
      const labelRectY = labelY - fontSize - labelPadding
      const labelRectW = totalWidth + labelPadding * 2
      const labelRectH = Math.max(fontSize, iconSize) + labelPadding * 2
      
      // Rounded rectangle for label background
      ctx.beginPath()
      const labelRadius = 4 / globalScale
      ctx.moveTo(labelRectX + labelRadius, labelRectY)
      ctx.lineTo(labelRectX + labelRectW - labelRadius, labelRectY)
      ctx.quadraticCurveTo(labelRectX + labelRectW, labelRectY, labelRectX + labelRectW, labelRectY + labelRadius)
      ctx.lineTo(labelRectX + labelRectW, labelRectY + labelRectH - labelRadius)
      ctx.quadraticCurveTo(labelRectX + labelRectW, labelRectY + labelRectH, labelRectX + labelRectW - labelRadius, labelRectY + labelRectH)
      ctx.lineTo(labelRectX + labelRadius, labelRectY + labelRectH)
      ctx.quadraticCurveTo(labelRectX, labelRectY + labelRectH, labelRectX, labelRectY + labelRectH - labelRadius)
      ctx.lineTo(labelRectX, labelRectY + labelRadius)
      ctx.quadraticCurveTo(labelRectX, labelRectY, labelRectX + labelRadius, labelRectY)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      
      // Draw favicon icon if available
      if (favicon) {
        const iconX = centerX - totalWidth/2
        const iconY = labelY - iconSize/2 - fontSize/2
        ctx.drawImage(favicon, iconX, iconY, iconSize, iconSize)
      }
      
      // Draw label text
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const textX = favicon ? centerX + iconSize/2 + iconPadding/2 : centerX
      ctx.fillText(clusterLabel, textX, labelY - fontSize/2)
    })
  }

  const toggleCluster = (clusterId: number) => {
    setSelectedClusters(prev => {
      const next = new Set(prev)
      if (next.has(clusterId)) {
        next.delete(clusterId)
      } else {
        next.add(clusterId)
      }
      return next
    })
  }

  const clearClusterFilter = () => {
    setSelectedClusters(new Set())
  }

  // Count active filters
  const activeFilterCount = 
    (searchQuery.trim() ? 1 : 0) +
    (timeFilter !== "all" ? 1 : 0) +
    (selectedClusters.size > 0 ? 1 : 0) +
    (minSimilarity !== 0.50 ? 1 : 0)

  return (
    <div className="flex flex-col gap-0">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b" style={{ borderColor: '#E5E5E5' }}>
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium" style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
            Knowledge Graph
          </h3>
          <span className="text-xs" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
            {filteredNodes.length} nodes
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              chrome.tabs.create({ url: chrome.runtime.getURL('tabs/graph.html') })
            }}
            className="p-1.5 rounded-lg transition-colors hover:bg-gray-50"
            style={{ color: '#9A9FA6' }}
            title="Open in full page">
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowLabels(!showLabels)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-gray-50"
            style={{ 
              color: showLabels ? '#0072de' : '#080A0B', 
              fontFamily: "'Breeze Sans'", 
              border: `1px solid ${showLabels ? '#0072de' : '#E5E5E5'}`,
              backgroundColor: showLabels ? '#eff6ff' : 'transparent'
            }}
            title="Toggle node labels">
            <span>Labels</span>
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-gray-50"
            style={{ color: '#080A0B', fontFamily: "'Breeze Sans'", border: '1px solid #E5E5E5' }}>
            <Sliders className="h-3.5 w-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span 
                className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full"
                style={{ backgroundColor: '#0072de', color: 'white' }}>
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setManualLinkMode(!manualLinkMode)
              setSelectedNodesForLink([])
            }}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-gray-50"
            style={{ 
              color: manualLinkMode ? '#FFFFFF' : '#080A0B', 
              fontFamily: "'Breeze Sans'", 
              border: '1px solid #E5E5E5',
              backgroundColor: manualLinkMode ? '#0072de' : 'transparent'
            }}
            title="Click two nodes to create a manual link">
            <Link className="h-3.5 w-3.5" />
            <span>Link</span>
          </button>
          <button
            onClick={() => setShowExplanations(!showExplanations)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-gray-50"
            style={{ 
              color: showExplanations ? '#FFFFFF' : '#080A0B', 
              fontFamily: "'Breeze Sans'", 
              border: '1px solid #E5E5E5',
              backgroundColor: showExplanations ? '#0072de' : 'transparent'
            }}
            title="Explain connections">
            <span>📊</span>
          </button>
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded-lg transition-colors hover:bg-gray-50"
            style={{ color: '#9A9FA6' }}>
            <RotateCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Manual Link Mode Banner */}
      {manualLinkMode && (
        <div className="px-3 py-2 bg-blue-50 border-b" style={{ borderColor: '#E5E5E5' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link className="h-4 w-4" style={{ color: '#0072de' }} />
              <span className="text-xs font-medium" style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
                {selectedNodesForLink.length === 0 
                  ? 'Click two nodes to link them (or unlink if already connected)' 
                  : 'Click second node to toggle link'}
              </span>
            </div>
            {selectedNodesForLink.length > 0 && (
              <button
                onClick={() => setSelectedNodesForLink([])}
                className="text-xs px-2 py-1 rounded hover:bg-blue-100"
                style={{ color: '#0072de', fontFamily: "'Breeze Sans'" }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Always Visible Search Bar */}
      <div className="px-3 py-2 border-b bg-white" style={{ borderColor: '#E5E5E5' }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: '#9A9FA6' }} />
          <input
            type="text"
            placeholder="Search pages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            style={{ 
              border: '1px solid #E5E5E5', 
              backgroundColor: 'white',
              color: '#080A0B',
              fontFamily: "'Breeze Sans'"
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70"
              style={{ color: '#9A9FA6' }}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Filters Section */}
      {showFilters && (
        <div className="px-3 py-3 border-b bg-gray-50/50 flex flex-col gap-3" style={{ borderColor: '#E5E5E5' }}>
          {/* Time Filter Chips */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
              Time:
            </span>
            <div className="flex gap-1.5">
              {(["all", "today", "week"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTimeFilter(filter)}
                  className="px-3 py-1 text-xs font-medium rounded-full transition-all"
                  style={{
                    backgroundColor: timeFilter === filter ? '#000000' : '#FFFFFF',
                    color: timeFilter === filter ? '#FFFFFF' : '#000000',
                    border: '1px solid #000000',
                    fontFamily: "'Breeze Sans'"
                  }}>
                  {filter === "all" ? "All Time" : filter === "today" ? "Today" : "This Week"}
                </button>
              ))}
            </div>
          </div>

          {/* Similarity Slider */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium whitespace-nowrap" style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
              Similarity:
            </span>
            <div className="flex-1 flex items-center gap-2">
              <input
                type="range"
                min={0.2}
                max={0.6}
                step={0.05}
                value={minSimilarity}
                onChange={(e) => setMinSimilarity(parseFloat(e.target.value))}
                className="flex-1 h-1 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #0072de 0%, #0072de ${((minSimilarity - 0.2) / 0.4) * 100}%, #E5E5E5 ${((minSimilarity - 0.2) / 0.4) * 100}%, #E5E5E5 100%)`
                }}
              />
              <span className="text-xs font-mono w-10 text-right" style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
                {minSimilarity.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Cluster Filter Chips */}
          {clusters.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-xs font-medium pt-1 whitespace-nowrap" style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
                Clusters:
              </span>
              <div className="flex-1 flex flex-wrap gap-1.5">
                {clusters.map(clusterId => {
                  const isActive = allClustersSelected || selectedClusters.has(clusterId)
                  const clusterLabel = generateClusterLabel(graph.nodes, clusterId)
                  return (
                    <button
                      key={clusterId}
                      onClick={() => toggleCluster(clusterId)}
                      className="px-2.5 py-1 text-xs font-medium rounded-full transition-all"
                      style={{
                        backgroundColor: isActive ? getClusterColor(clusterId) : '#FFFFFF',
                        color: isActive ? '#FFFFFF' : '#080A0B',
                        border: `1px solid ${isActive ? getClusterColor(clusterId) : '#E5E5E5'}`,
                        fontFamily: "'Breeze Sans'"
                      }}>
                      {clusterLabel}
                    </button>
                  )
                })}
                {!allClustersSelected && (
                  <button
                    onClick={clearClusterFilter}
                    className="px-2.5 py-1 text-xs font-medium rounded-full transition-all underline"
                    style={{ color: '#0072de', fontFamily: "'Breeze Sans'" }}>
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Graph Container */}
      <div ref={containerRef} className="relative bg-white overflow-hidden" style={{ height: "400px", width: "100%" }}>
        {/* Navigation Controls */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
          <button
            onClick={handleZoomIn}
            className="p-3 rounded-lg bg-white shadow-md transition-all hover:bg-gray-50 active:scale-95"
            style={{ border: '2px solid #E5E5E5' }}
            title="Zoom in (scroll up)">
            <ZoomIn className="h-5 w-5" style={{ color: '#080A0B' }} />
          </button>
          <button
            onClick={handleZoomReset}
            className="p-3 rounded-lg bg-white shadow-md transition-all hover:bg-gray-50 active:scale-95"
            style={{ border: '2px solid #E5E5E5' }}
            title="Reset zoom">
            <RotateCw className="h-5 w-5" style={{ color: '#080A0B' }} />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-3 rounded-lg bg-white shadow-md transition-all hover:bg-gray-50 active:scale-95"
            style={{ border: '2px solid #E5E5E5' }}
            title="Zoom out (scroll down)">
            <ZoomOut className="h-5 w-5" style={{ color: '#080A0B' }} />
          </button>
        </div>

        {filteredNodes.length > 0 ? (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            nodeLabel={(node: any) => {
              // Simplified tooltip: just title and visit count
              return `${node.name}\nVisits: ${node.visitCount}`
            }}
            nodeColor={(node: any) => node.color}
            nodeVal={(node: any) => {
              // Check if node is connected (has any edges)
              const isConnected = graphData.links.some((link: any) => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source
                const targetId = typeof link.target === 'object' ? link.target.id : link.target
                return sourceId === node.id || targetId === node.id
              })
              
              const baseSize = 4
              const sizeFactor = Math.log(node.visitCount + 1) * 3
              const calculatedSize = Math.max(baseSize, Math.min(baseSize + sizeFactor, 18))
              
              // Isolated nodes get 250% size boost for strong visibility
              return isConnected ? calculatedSize : calculatedSize * 3.5
            }}
            nodeRelSize={8}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const label = node.label
              const fontSize = 11 / globalScale
              ctx.font = `${fontSize}px 'Breeze Sans', Sans-Serif`
              
              // Check if node is connected
              const isConnected = graphData.links.some((link: any) => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source
                const targetId = typeof link.target === 'object' ? link.target.id : link.target
                return sourceId === node.id || targetId === node.id
              })
              
              const baseSize = node.__bckgDimensions ? node.__bckgDimensions[0] : 4
              // Apply size boost for isolated nodes in rendering
              const size = isConnected ? baseSize : baseSize * 1.5
              const isSelected = selectedNodesForLink.includes(node.id)
              
              // Draw node circle with larger size
              ctx.beginPath()
              ctx.arc(node.x, node.y, size * 1.5, 0, 2 * Math.PI, false)
              ctx.fillStyle = isSelected ? '#0072de' : node.color
              ctx.fill()
              
              // Draw border (thicker for selected nodes)
              ctx.strokeStyle = isSelected ? '#FFFFFF' : '#ffffff'
              ctx.lineWidth = isSelected ? 4 / globalScale : 2 / globalScale
              ctx.stroke()
              
              // Draw selection ring for selected nodes
              if (isSelected) {
                ctx.beginPath()
                ctx.arc(node.x, node.y, size * 2, 0, 2 * Math.PI, false)
                ctx.strokeStyle = '#0072de'
                ctx.lineWidth = 2 / globalScale
                ctx.setLineDash([5 / globalScale, 5 / globalScale])
                ctx.stroke()
                ctx.setLineDash([])
              }
              
              // Only draw labels when zoomed in enough (>1.5x) and labels are enabled
              if (showLabels && globalScale > 1.5) {
                ctx.textAlign = 'center'
                ctx.textBaseline = 'top'
                ctx.fillStyle = '#1f2937'
                ctx.fillText(label, node.x, node.y + (size * 1.5) + 5)
              }
            }}
            nodeCanvasObjectMode={() => 'replace'}
            linkWidth={(link: any) => link.isManual ? 2 : Math.max(0.5, link.value * 1.5)}
            linkColor={(link: any) => link.isManual ? '#0072de' : '#cbd5e1'}
            linkLineDash={(link: any) => link.isManual ? [5, 5] : null}
            linkDirectionalParticles={0}
            onNodeClick={handleNodeClick}
            onNodeHover={null}
            cooldownTicks={150}
            dagMode={null}
            d3VelocityDecay={0.2}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
            onRenderFramePre={(ctx: CanvasRenderingContext2D, globalScale: number) => {
              drawClusterBoundaries(ctx, globalScale)
            }}
            onEngineStop={() => {
              // Only auto-fit on initial load, not after user interactions
              if (graphRef.current && !hasUserInteractedRef.current) {
                graphRef.current.zoomToFit(400, 50)
              }
            }}
            onZoom={() => {
              hasUserInteractedRef.current = true
            }}
            onNodeDragEnd={(node: any) => {
              node.fx = node.x
              node.fy = node.y
              hasUserInteractedRef.current = true
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
              No nodes match current filters
            </p>
          </div>
        )}
      </div>

      {/* Explanation Panel - Compact for Sidepanel */}
      {showExplanations && graph && (
        <div className="absolute top-16 right-2 w-80 max-h-96 bg-white rounded-lg shadow-xl border overflow-hidden flex flex-col z-50"
             style={{ borderColor: '#E5E5E5' }}>
          <div className="flex items-center justify-between px-3 py-2 border-b bg-blue-50" style={{ borderColor: '#E5E5E5' }}>
            <h3 className="font-semibold text-xs" style={{ fontFamily: "'Breeze Sans'", color: '#080A0B' }}>
              📊 Connection Explanations
            </h3>
            <button 
              onClick={() => setShowExplanations(false)}
              className="text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          
          <div className="overflow-y-auto p-2 space-y-2 text-[10px]" style={{ fontFamily: "'Breeze Sans'" }}>
            {Array.from(new Set(graph.nodes.map(n => n.cluster))).slice(0, 3).map(clusterId => {
              const clusterNodes = graph.nodes.filter(n => n.cluster === clusterId)
              if (clusterNodes.length < 2) return null
              
              const clusterEdges = graph.edges.filter(e => {
                const sourceNode = graph.nodes.find(n => n.id === e.source)
                const targetNode = graph.nodes.find(n => n.id === e.target)
                return sourceNode?.cluster === clusterId && targetNode?.cluster === clusterId
              }).slice(0, 3)
              
              if (clusterEdges.length === 0) return null
              
              const clusterLabel = generateClusterLabel(graph.nodes, clusterId)
              const clusterColor = getClusterColor(clusterId)
              
              return (
                <div key={clusterId} className="border rounded" style={{ borderColor: clusterColor + '40' }}>
                  <div className="px-2 py-1.5" style={{ backgroundColor: clusterColor + '10' }}>
                    <div className="font-semibold" style={{ color: clusterColor }}>
                      {clusterLabel}
                    </div>
                  </div>
                  
                  <div className="p-2 space-y-1.5">
                    {clusterEdges.map((edge, idx) => {
                      const breakdown = edge.breakdown
                      if (!breakdown) return null
                      
                      return (
                        <div key={idx} className="pb-1.5 border-b last:border-0" style={{ borderColor: '#f3f4f6' }}>
                          <div className="space-y-0.5">
                            <div className="flex justify-between">
                              <span className="text-gray-600">🧠 Semantic</span>
                              <span className="font-mono font-semibold" style={{ color: clusterColor }}>
                                {(breakdown.embedding * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">🔤 Keywords</span>
                              <span className="font-mono font-semibold" style={{ color: clusterColor }}>
                                {(breakdown.keyword * 100).toFixed(0)}%
                              </span>
                            </div>
                            {breakdown.sameDomain && (
                              <div className="flex justify-between text-blue-600">
                                <span>🌐 Same domain</span>
                                <span className="font-mono font-semibold">+{((breakdown.domainBoost - 1) * 100).toFixed(0)}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            <div className="text-center text-gray-400 pt-1">
              Open full view for complete details
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

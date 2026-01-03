import { useEffect, useRef, useState, useCallback } from "react"
import ForceGraph2D from "react-force-graph-2d"
import { Search, X, ChevronDown, RotateCw, Sliders, ZoomIn, ZoomOut, Link } from "lucide-react"
import type { KnowledgeGraph, GraphNode } from "~/lib/knowledge-graph"
import { getClusterColor, generateClusterLabel, generateProjectClusterLabel } from "~/lib/knowledge-graph"
import "~/style.css"

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

export default function GraphFullPage() {
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
  const [manualLinks, setManualLinks] = useState<Array<{source: string, target: string}>>([] )
  const [showExplanations, setShowExplanations] = useState(false)
  const [graphMode, setGraphMode] = useState<'semantic' | 'projects'>('semantic')
  const graphRef = useRef<any>()
  const containerRef = useRef<HTMLDivElement>(null)
  const hasUserInteractedRef = useRef(false)
  const lastGraphTimestampRef = useRef<number>(0)
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 })
  const faviconCache = useRef<Map<string, HTMLImageElement>>(new Map())
  const panBoundaryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const CONTENT_PADDING = 500 // Padding around node bounds

  // Calculate bounds of all nodes from the actual graph data
  const calculateNodeBounds = () => {
    if (!graphRef.current) return null
    
    const graphData = graphRef.current.graphData()
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) return null
    
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    
    graphData.nodes.forEach((node: any) => {
      if (node.x !== undefined && node.y !== undefined) {
        minX = Math.min(minX, node.x)
        maxX = Math.max(maxX, node.x)
        minY = Math.min(minY, node.y)
        maxY = Math.max(maxY, node.y)
      }
    })
    
    if (minX === Infinity) return null
    
    return {
      minX: minX - CONTENT_PADDING,
      maxX: maxX + CONTENT_PADDING,
      minY: minY - CONTENT_PADDING,
      maxY: maxY + CONTENT_PADDING,
      width: maxX - minX + 2 * CONTENT_PADDING,
      height: maxY - minY + 2 * CONTENT_PADDING
    }
  }

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
      const messageType = graphMode === 'projects' ? 'GET_PROJECT_GRAPH' : 'GET_GRAPH'
      const response = await sendMessage<{ graph: KnowledgeGraph }>({ type: messageType })
      if (response?.graph) {
        if (response.graph.lastUpdated !== lastGraphTimestampRef.current) {
          console.log("[GraphFullPage] Graph data changed, updating UI")
          setGraph(response.graph)
          lastGraphTimestampRef.current = response.graph.lastUpdated
          hasUserInteractedRef.current = false
        }
      }
    } catch (err) {
      console.error("[GraphFullPage] Failed to load graph:", err)
    } finally {
      setLoading(false)
    }
  }, [graphMode])

  const handleRefresh = async () => {
    try {
      const response = await sendMessage<{ graph: KnowledgeGraph }>({ type: "REFRESH_GRAPH" })
      if (response?.graph) {
        setGraph(response.graph)
        lastGraphTimestampRef.current = response.graph.lastUpdated
        
        if (graphRef.current) {
          setTimeout(() => {
            graphRef.current?.zoomToFit(400, 50)
          }, 500)
        }
      }
    } catch (err) {
      console.error("[GraphFullPage] Failed to refresh graph:", err)
    }
  }

  useEffect(() => {
    loadGraph()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Preload favicons when graph updates
  useEffect(() => {
    if (!graph) return
    
    const clusters = new Set(graph.nodes.map(n => n.cluster))
    clusters.forEach(clusterId => {
      const topDomain = getClusterTopDomain(graph.nodes, clusterId)
      if (topDomain && !faviconCache.current.has(topDomain)) {
        loadFavicon(topDomain).catch(err => 
          console.log('[Graph] Failed to load favicon for', topDomain)
        )
      }
    })
  }, [graph])

  useEffect(() => {
    if (graph && graphRef.current && !hasUserInteractedRef.current) {
      setTimeout(() => {
        graphRef.current?.zoomToFit(400, 50)
      }, 500)
    }
  }, [graph])

  // Track container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({ width: rect.width, height: rect.height })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  if (loading && !graph) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p style={{ fontFamily: "'Breeze Sans'", color: '#080A0B' }}>Loading knowledge graph...</p>
        </div>
      </div>
    )
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-white">
        <div className="text-center">
          <p className="text-lg font-medium mb-2" style={{ fontFamily: "'Breeze Sans'", color: '#080A0B' }}>
            No browsing data yet
          </p>
          <p className="text-sm" style={{ color: '#9A9FA6' }}>
            Start browsing to see your knowledge graph
          </p>
        </div>
      </div>
    )
  }

  const clusters = Array.from(new Set(graph.nodes.map(n => n.cluster)))
  const allClustersSelected = selectedClusters.size === 0

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

  const searchFilteredNodes = searchQuery.trim()
    ? timeFilteredNodes.filter(n => 
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.domain.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : timeFilteredNodes

  const filteredNodes = searchFilteredNodes.filter(n => {
    if (allClustersSelected) return true
    return selectedClusters.has(n.cluster)
  })

  const filteredNodeIds = new Set(filteredNodes.map(n => n.id))

  // Use weight (composite) instead of similarity (embedding-only) for multi-factor filtering
  const filteredEdges = graph.edges.filter(e => 
    (e.weight || e.similarity) >= minSimilarity &&
    filteredNodeIds.has(e.source) &&
    filteredNodeIds.has(e.target)
  )

  const nodesByCluster = new Map<number, typeof filteredNodes>()
  filteredNodes.forEach(n => {
    if (!nodesByCluster.has(n.cluster)) {
      nodesByCluster.set(n.cluster, [])
    }
    nodesByCluster.get(n.cluster)!.push(n)
  })

  const graphData = {
    nodes: filteredNodes.map(n => {
      // Use project name in project mode, domain in semantic mode
      const displayLabel = graphMode === 'projects' && n.projectName 
        ? n.projectName 
        : n.domain
      
      return {
        id: n.id,
        name: n.title,
        url: n.url,
        domain: n.domain,
        cluster: n.cluster,
        visitCount: n.visitCount,
        searchQuery: n.searchQuery,
        projectName: n.projectName,
        description: n.description,
        keywords: n.keywords,
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
      if (selectedNodesForLink.includes(node.id)) {
        setSelectedNodesForLink(prev => prev.filter(id => id !== node.id))
      } else if (selectedNodesForLink.length === 0) {
        setSelectedNodesForLink([node.id])
      } else if (selectedNodesForLink.length === 1) {
        const [firstNode] = selectedNodesForLink
        
        const existingLinkIndex = manualLinks.findIndex(
          link => 
            (link.source === firstNode && link.target === node.id) ||
            (link.source === node.id && link.target === firstNode)
        )
        
        if (existingLinkIndex !== -1) {
          const updatedLinks = manualLinks.filter((_, idx) => idx !== existingLinkIndex)
          saveManualLinks(updatedLinks)
        } else {
          const newLink = { source: firstNode, target: node.id }
          saveManualLinks([...manualLinks, newLink])
        }
        
        setSelectedNodesForLink([])
      }
    } else {
      if (node.url) {
        window.open(node.url, '_blank')
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
      
      // Try Google's favicon service first, fallback to direct
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
    
    // Find connected components within each Louvain cluster
    const getConnectedComponents = (nodes: any[], edges: any[]) => {
      const components: Array<Set<string>> = []
      const visited = new Set<string>()
      
      // Build adjacency list from edges
      const adjacency = new Map<string, Set<string>>()
      nodes.forEach(n => adjacency.set(n.id, new Set()))
      
      edges.forEach((edge: any) => {
        const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source
        const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target
        
        if (adjacency.has(sourceId) && adjacency.has(targetId)) {
          adjacency.get(sourceId)!.add(targetId)
          adjacency.get(targetId)!.add(sourceId)
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
          if (component.size >= 2) { // Only keep components with 2+ nodes
            components.push(component)
          }
        }
      })
      
      return components
    }
    
    // Group nodes by Louvain cluster first
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
      const clusterLabel = graphMode === 'projects' 
        ? generateProjectClusterLabel(graphData.nodes, clusterId)
        : generateClusterLabel(graphData.nodes, clusterId)
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

  const handleZoomReset = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 50)
      hasUserInteractedRef.current = true
    }
  }

  const toggleCluster = (clusterId: number) => {
    setSelectedClusters(prev => {
      const newSet = new Set(prev)
      if (newSet.has(clusterId)) {
        newSet.delete(clusterId)
      } else {
        newSet.add(clusterId)
      }
      return newSet
    })
  }

  const clearClusterFilter = () => {
    setSelectedClusters(new Set())
  }

  const activeFilterCount = 
    (timeFilter !== "all" ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0) +
    (minSimilarity !== 0.50 ? 1 : 0) +
    (!allClustersSelected ? 1 : 0)

  return (
    <div className="flex flex-col w-screen h-screen bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white" style={{ borderColor: '#E5E5E5' }}>
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
            Knowledge Graph - Full View
          </h1>
          <p className="text-sm" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
            {filteredNodes.length} nodes · {graphData.links.length} connections
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLabels(!showLabels)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-gray-50"
            style={{ 
              color: '#080A0B', 
              fontFamily: "'Breeze Sans'", 
              border: '1px solid #E5E5E5',
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
              const newMode = graphMode === 'semantic' ? 'projects' : 'semantic'
              setGraphMode(newMode)
              loadGraph()
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-gray-50"
            style={{ 
              color: graphMode === 'projects' ? '#FFFFFF' : '#080A0B', 
              fontFamily: "'Breeze Sans'", 
              border: '1px solid #E5E5E5',
              backgroundColor: graphMode === 'projects' ? '#0072de' : 'transparent'
            }}
            title="Switch between semantic and project-based clustering">
            <span>{graphMode === 'semantic' ? 'Semantic' : 'Projects'}</span>
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
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-gray-50"
            style={{ 
              color: showExplanations ? '#FFFFFF' : '#080A0B', 
              fontFamily: "'Breeze Sans'", 
              border: '1px solid #E5E5E5',
              backgroundColor: showExplanations ? '#0072de' : 'transparent'
            }}
            title="Explain how connections are made">
            <span>📊</span>
            <span>Explain</span>
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
        <div className="px-6 py-2 bg-blue-50 border-b" style={{ borderColor: '#E5E5E5' }}>
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

      {/* Search Bar */}
      <div className="px-6 py-3 border-b bg-white" style={{ borderColor: '#E5E5E5' }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#9A9FA6' }} />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
            style={{ 
              border: '1px solid #E5E5E5', 
              fontFamily: "'Breeze Sans'",
              color: '#080A0B'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded">
              <X className="h-3.5 w-3.5" style={{ color: '#9A9FA6' }} />
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="px-6 py-4 border-b bg-gray-50" style={{ borderColor: '#E5E5E5' }}>
          <div className="space-y-4">
            {/* Similarity Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium" style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
                  Min Similarity:
                </label>
                <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: '#E5E5E5', color: '#080A0B' }}>
                  {minSimilarity.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={minSimilarity}
                onChange={(e) => setMinSimilarity(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Cluster Filter */}
            {clusters.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-xs font-medium pt-1 whitespace-nowrap" style={{ color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
                  Clusters:
                </span>
                <div className="flex-1 flex flex-wrap gap-1.5">
                  {clusters.map(clusterId => {
                    const isActive = allClustersSelected || selectedClusters.has(clusterId)
                    const clusterLabel = graphMode === 'projects'
                      ? generateProjectClusterLabel(graph.nodes, clusterId)
                      : generateClusterLabel(graph.nodes, clusterId)
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
        </div>
      )}

      {/* Graph Container */}
      <div ref={containerRef} className="flex-1 relative bg-white" style={{ overflow: 'hidden' }}>
        {/* Zoom Controls */}
        <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-2">
          <button
            onClick={handleZoomIn}
            className="p-3 rounded-lg bg-white shadow-md transition-all hover:bg-gray-50 active:scale-95"
            style={{ border: '2px solid #E5E5E5' }}
            title="Zoom in">
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
            title="Zoom out">
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
              if (graphMode === 'projects') {
                // Project mode: show project info
                const parts = [`<b>${node.name}</b>`]
                if (node.url) parts.push(`URL: ${node.url}`)
                if (node.description) parts.push(`Description: ${node.description}`)
                if (node.keywords && node.keywords.length > 0) {
                  parts.push(`Keywords: ${node.keywords.join(', ')}`)
                }
                parts.push(`Sites: ${node.visitCount}`)
                return parts.join('\n')
              } else {
                // Semantic mode: show page info
                return `${node.name}\nVisits: ${node.visitCount}`
              }
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
              
              ctx.beginPath()
              ctx.arc(node.x, node.y, size * 1.5, 0, 2 * Math.PI, false)
              ctx.fillStyle = isSelected ? '#0072de' : node.color
              ctx.fill()
              
              ctx.strokeStyle = isSelected ? '#FFFFFF' : '#ffffff'
              ctx.lineWidth = isSelected ? 4 / globalScale : 2 / globalScale
              ctx.stroke()
              
              if (isSelected) {
                ctx.beginPath()
                ctx.arc(node.x, node.y, size * 2, 0, 2 * Math.PI, false)
                ctx.strokeStyle = '#0072de'
                ctx.lineWidth = 2 / globalScale
                ctx.setLineDash([5 / globalScale, 5 / globalScale])
                ctx.stroke()
                ctx.setLineDash([])
              }
              
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
            enablePanInteraction={false}
            onRenderFramePre={(ctx: CanvasRenderingContext2D, globalScale: number) => {
              drawClusterBoundaries(ctx, globalScale)
            }}
            onEngineStop={() => {
              // Only auto-fit on initial load, not after user interactions
              if (graphRef.current && !hasUserInteractedRef.current) {
                graphRef.current.zoomToFit(400, 50)
              }
            }}
            onZoom={(transform: any) => {
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
            <p className="text-sm" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
              No nodes match current filters
            </p>
          </div>
        )}
      </div>

      {/* Explanation Panel */}
      {showExplanations && graph && (
        <div className="absolute top-20 right-6 w-96 max-h-[calc(100vh-7rem)] bg-white rounded-lg shadow-2xl border-2 overflow-hidden flex flex-col"
             style={{ borderColor: '#E5E5E5' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-white" style={{ borderColor: '#E5E5E5' }}>
            <h3 className="font-semibold text-sm" style={{ fontFamily: "'Breeze Sans'", color: '#080A0B' }}>
              📊 Connection Explanations
            </h3>
            <button 
              onClick={() => setShowExplanations(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="overflow-y-auto p-4 space-y-4 flex-1" style={{ fontFamily: "'Breeze Sans'" }}>
            {Array.from(new Set(graph.nodes.map(n => n.cluster))).map(clusterId => {
              const clusterNodes = graph.nodes.filter(n => n.cluster === clusterId)
              if (clusterNodes.length < 2) return null
              
              const clusterEdges = graph.edges.filter(e => {
                const sourceNode = graph.nodes.find(n => n.id === e.source)
                const targetNode = graph.nodes.find(n => n.id === e.target)
                return sourceNode?.cluster === clusterId && targetNode?.cluster === clusterId
              })
              
              if (clusterEdges.length === 0) return null
              
              const clusterLabel = graphMode === 'projects'
                ? generateProjectClusterLabel(graph.nodes, clusterId)
                : generateClusterLabel(graph.nodes, clusterId)
              const clusterColor = getClusterColor(clusterId)
              
              return (
                <div key={clusterId} className="border rounded-lg overflow-hidden" style={{ borderColor: clusterColor + '40' }}>
                  <div className="px-3 py-2" style={{ backgroundColor: clusterColor + '10' }}>
                    <div className="font-semibold text-xs" style={{ color: clusterColor }}>
                      {clusterLabel}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {clusterNodes.length} pages · {clusterEdges.length} connections
                    </div>
                  </div>
                  
                  <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                    {clusterEdges.slice(0, 10).map((edge, idx) => {
                      const breakdown = edge.breakdown
                      if (!breakdown) return null
                      
                      const sourceNode = graph.nodes.find(n => n.id === edge.source)
                      const targetNode = graph.nodes.find(n => n.id === edge.target)
                      
                      return (
                        <div key={idx} className="text-[11px] space-y-1 pb-2 border-b last:border-0" style={{ borderColor: '#f3f4f6' }}>
                          <div className="font-medium text-gray-700 leading-tight">
                            {sourceNode?.title.substring(0, 40)}{sourceNode?.title.length! > 40 ? '...' : ''}
                          </div>
                          <div className="text-gray-500 text-[10px]">↓ connected to</div>
                          <div className="font-medium text-gray-700 leading-tight">
                            {targetNode?.title.substring(0, 40)}{targetNode?.title.length! > 40 ? '...' : ''}
                          </div>
                          
                          <div className="mt-2 space-y-0.5 pl-2 border-l-2" style={{ borderColor: clusterColor + '40' }}>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">🧠 Semantic similarity</span>
                              <span className="font-mono font-semibold" style={{ color: clusterColor }}>
                                {(breakdown.embedding * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">🔤 Keyword overlap</span>
                              <span className="font-mono font-semibold" style={{ color: clusterColor }}>
                                {(breakdown.keyword * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">⏰ Time proximity</span>
                              <span className="font-mono font-semibold" style={{ color: clusterColor }}>
                                {(breakdown.temporal * 100).toFixed(0)}%
                              </span>
                            </div>
                            {breakdown.sameDomain && (
                              <div className="flex justify-between items-center text-blue-600">
                                <span>🌐 Same domain boost</span>
                                <span className="font-mono font-semibold">+{((breakdown.domainBoost - 1) * 100).toFixed(0)}%</span>
                              </div>
                            )}
                            <div className="flex justify-between items-center pt-1 mt-1 border-t" style={{ borderColor: '#f3f4f6' }}>
                              <span className="font-semibold text-gray-700">Total Strength</span>
                              <span className="font-mono font-bold" style={{ color: clusterColor }}>
                                {(edge.weight! * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {clusterEdges.length > 10 && (
                      <div className="text-[10px] text-gray-400 text-center pt-1">
                        ... and {clusterEdges.length - 10} more connections
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

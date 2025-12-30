import { useEffect, useRef, useState, useCallback } from "react"
import ForceGraph2D from "react-force-graph-2d"
import { Search, X, ChevronDown, RotateCw, Sliders, ZoomIn, ZoomOut } from "lucide-react"
import type { KnowledgeGraph, GraphNode } from "~/lib/knowledge-graph"
import { getClusterColor } from "~/lib/knowledge-graph"

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
  const [minSimilarity, setMinSimilarity] = useState(0.35)
  const [selectedClusters, setSelectedClusters] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "week">("all")
  const [showFilters, setShowFilters] = useState(false)
  const hoveredNodeRef = useRef<any>(null)
  const graphRef = useRef<any>()
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 500, height: 400 })

  const loadGraph = useCallback(async () => {
    setLoading(true)
    try {
      const response = await sendMessage<{ graph: KnowledgeGraph }>({ type: "GET_GRAPH" })
      if (response?.graph) {
        setGraph(response.graph)
      }
    } catch (err) {
      console.error("[GraphPanel] Failed to load graph:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleRefresh = async () => {
    try {
      const response = await sendMessage<{ graph: KnowledgeGraph }>({ type: "REFRESH_GRAPH" })
      if (response?.graph) {
        setGraph(response.graph)
      }
    } catch (err) {
      console.error("[GraphPanel] Failed to refresh graph:", err)
    }
  }

  useEffect(() => {
    loadGraph()
  }, [loadGraph])

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

  // Filter graph data
  const filteredEdges = graph.edges.filter(e => 
    e.similarity >= minSimilarity &&
    searchFilteredNodes.some(n => n.id === e.source) &&
    searchFilteredNodes.some(n => n.id === e.target)
  )
  const visibleNodeIds = new Set<string>()
  
  filteredEdges.forEach(e => {
    visibleNodeIds.add(e.source)
    visibleNodeIds.add(e.target)
  })

  // If no edges pass the threshold, show all nodes anyway
  const filteredNodes = searchFilteredNodes.filter(n => {
    if (filteredEdges.length === 0) {
      // Show all nodes when there are no edges
      if (allClustersSelected) return true
      return selectedClusters.has(n.cluster)
    }
    if (!visibleNodeIds.has(n.id)) return false
    if (allClustersSelected) return true
    return selectedClusters.has(n.cluster)
  })

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
    nodes: filteredNodes.map(n => ({
      id: n.id,
      name: n.title,
      url: n.url,
      domain: n.domain,
      cluster: n.cluster,
      visitCount: n.visitCount,
      color: getClusterColor(n.cluster),
      label: n.title.length > 25 ? n.title.substring(0, 25) + '...' : n.title
    })),
    links: filteredEdges
      .filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
      .map(e => ({
        source: e.source,
        target: e.target,
        value: e.similarity
      }))
  }

  // Build a set of connected node IDs when hovering
  const connectedNodeIds = new Set<string>()
  const hoveredNode = hoveredNodeRef.current
  if (hoveredNode) {
    connectedNodeIds.add(hoveredNode.id)
    graphData.links.forEach(link => {
      if (link.source === hoveredNode.id || (typeof link.source === 'object' && (link.source as any).id === hoveredNode.id)) {
        const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id
        connectedNodeIds.add(targetId)
      }
      if (link.target === hoveredNode.id || (typeof link.target === 'object' && (link.target as any).id === hoveredNode.id)) {
        const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id
        connectedNodeIds.add(sourceId)
      }
    })
  }

  const handleNodeClick = (node: any) => {
    if (node.url) {
      chrome.tabs.create({ url: node.url })
    }
  }

  const handleZoomIn = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom()
      graphRef.current.zoom(currentZoom * 1.3, 400)
    }
  }

  const handleZoomOut = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom()
      graphRef.current.zoom(currentZoom / 1.3, 400)
    }
  }

  // Draw cluster boundaries for clusters with 2+ nodes
  const drawClusterBoundaries = (ctx: CanvasRenderingContext2D, globalScale: number) => {
    // Only draw if not hovering or zoomed out too much
    if (hoveredNode || globalScale < 0.5) return
    
    clustersWithMultipleNodes.forEach(clusterId => {
      const clusterNodes = graphData.nodes.filter(n => n.cluster === clusterId)
      if (clusterNodes.length < 2) return
      
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
    (minSimilarity !== 0.35 ? 1 : 0)

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
            onClick={handleRefresh}
            className="p-1.5 rounded-lg transition-colors hover:bg-gray-50"
            style={{ color: '#9A9FA6' }}>
            <RotateCw className="h-4 w-4" />
          </button>
        </div>
      </div>

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
                      {clusterId}
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
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
          <button
            onClick={handleZoomIn}
            className="p-2 rounded-lg bg-white shadow-sm transition-all hover:bg-gray-50"
            style={{ border: '1px solid #E5E5E5' }}
            title="Zoom in">
            <ZoomIn className="h-4 w-4" style={{ color: '#080A0B' }} />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 rounded-lg bg-white shadow-sm transition-all hover:bg-gray-50"
            style={{ border: '1px solid #E5E5E5' }}
            title="Zoom out">
            <ZoomOut className="h-4 w-4" style={{ color: '#080A0B' }} />
          </button>
        </div>

        {filteredNodes.length > 0 ? (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            nodeLabel={(node: any) => `${node.name}\n${node.domain}\nVisits: ${node.visitCount}`}
            nodeColor={(node: any) => node.color}
            nodeVal={(node: any) => {
              const baseSize = 4
              const sizeFactor = Math.log(node.visitCount + 1) * 2
              return Math.max(baseSize, Math.min(baseSize + sizeFactor, 15))
            }}
            nodeRelSize={4}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const label = node.label
              const fontSize = 11 / globalScale
              ctx.font = `${fontSize}px 'Breeze Sans', Sans-Serif`
              
              let size = node.__bckgDimensions ? node.__bckgDimensions[0] : 4
              
              // Scale up hovered node
              if (node.id === hoveredNodeRef.current?.id) {
                size *= 1.6
              }
              
              // Draw node circle
              ctx.beginPath()
              ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false)
              ctx.fillStyle = node.color
              ctx.fill()
              
              // Draw border - thicker for hovered node
              ctx.strokeStyle = node.id === hoveredNodeRef.current?.id ? '#FFFFFF' : 'rgba(255, 255, 255, 0.9)'
              ctx.lineWidth = node.id === hoveredNodeRef.current?.id ? 2 / globalScale : 0.8 / globalScale
              ctx.stroke()
              
              // Draw label below node (show at lower zoom threshold or when hovered/connected)
              const shouldShowLabel = globalScale > 0.6 || (hoveredNodeRef.current && connectedNodeIds.has(node.id))
              if (shouldShowLabel) {
                ctx.textAlign = 'center'
                ctx.textBaseline = 'top'
                ctx.fillStyle = '#080A0B'
                ctx.fillText(label, node.x, node.y + size + 3)
              }
            }}
            nodeCanvasObjectMode={() => 'replace'}
            linkWidth={(link: any) => {
              // Thicker links when hovering
              if (hoveredNode) {
                const sourceId = typeof link.source === 'string' ? link.source : link.source.id
                const targetId = typeof link.target === 'string' ? link.target : link.target.id
                if (sourceId === hoveredNode.id || targetId === hoveredNode.id) {
                  return Math.max(1.5, link.value * 3)
                }
              }
              return Math.max(0.5, link.value * 1.5)
            }}
            linkColor={() => "#cbd5e1"}
            linkDirectionalParticles={0}
            onNodeClick={handleNodeClick}
            onNodeHover={(node) => {
              hoveredNodeRef.current = node
            }}
            cooldownTicks={100}
            dagMode={null}
            d3VelocityDecay={0.3}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
            onRenderFramePre={(ctx: CanvasRenderingContext2D, globalScale: number) => {
              drawClusterBoundaries(ctx, globalScale)
            }}
            onEngineStop={() => {
              if (graphRef.current) {
                graphRef.current.zoomToFit(400, 50)
              }
            }}
            onNodeDragEnd={(node: any) => {
              node.fx = node.x
              node.fy = node.y
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
    </div>
  )
}

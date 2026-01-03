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
  const graphRef = useRef<any>()
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 500, height: 400 })
  const hasUserInteractedRef = useRef(false)
  const lastGraphTimestampRef = useRef<number>(0)

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
  const filteredEdges = graph.edges.filter(e => 
    e.similarity >= minSimilarity &&
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

  // Draw cluster boundaries for clusters with 2+ nodes
  const drawClusterBoundaries = (ctx: CanvasRenderingContext2D, globalScale: number) => {
    // Only draw if zoomed out too much
    if (globalScale < 0.5) return
    
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
              const baseSize = 4
              const sizeFactor = Math.log(node.visitCount + 1) * 3
              return Math.max(baseSize, Math.min(baseSize + sizeFactor, 18))
            }}
            nodeRelSize={8}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const label = node.label
              const fontSize = 11 / globalScale
              ctx.font = `${fontSize}px 'Breeze Sans', Sans-Serif`
              
              const size = node.__bckgDimensions ? node.__bckgDimensions[0] : 4
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
              // Cluster boundaries disabled for cleaner view
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
    </div>
  )
}

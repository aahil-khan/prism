import { useEffect, useRef, useState, useCallback } from "react"
import ForceGraph2D from "react-force-graph-2d"
import { Search, X, ChevronDown, RotateCw, Sliders, ZoomIn, ZoomOut, Link } from "lucide-react"
import type { KnowledgeGraph, GraphNode } from "~/lib/knowledge-graph"
import { getClusterColor, generateClusterLabel } from "~/lib/knowledge-graph"
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
  const graphRef = useRef<any>()
  const containerRef = useRef<HTMLDivElement>(null)
  const hasUserInteractedRef = useRef(false)
  const lastGraphTimestampRef = useRef<number>(0)
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 })

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
  }, [])

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
    const interval = setInterval(loadGraph, 30000)
    return () => clearInterval(interval)
  }, [loadGraph])

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

  const filteredEdges = graph.edges.filter(e => 
    e.similarity >= minSimilarity &&
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
        </div>
      )}

      {/* Graph Container */}
      <div ref={containerRef} className="flex-1 relative bg-white overflow-hidden">
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
            enablePanInteraction={true}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
              No nodes match current filters
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

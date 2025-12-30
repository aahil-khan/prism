import { useEffect, useRef, useState, useCallback } from "react"
import ForceGraph2D from "react-force-graph-2d"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
  const graphRef = useRef<any>()
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 500, height: 500 })

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
        const height = 500
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
      <div className="w-full rounded-lg border bg-white p-6 shadow-sm text-center" style={{ borderColor: "#E5E5E5" }}>
        <p className="text-sm text-slate-500">Loading knowledge graph...</p>
      </div>
    )
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="w-full rounded-lg border bg-white p-6 shadow-sm text-center" style={{ borderColor: "#E5E5E5" }}>
        <p className="text-sm text-slate-500 mb-3">No pages available yet. Visit some pages to build the graph.</p>
        <Button size="sm" onClick={handleRefresh} className="bg-[#0072de] text-white hover:bg-[#0066c6]">
          Refresh Graph
        </Button>
      </div>
    )
  }

  const clusters = Array.from(new Set(graph.nodes.map(n => n.cluster)))
  const allClustersSelected = selectedClusters.size === 0

  // Filter graph data
  const filteredEdges = graph.edges.filter(e => e.similarity >= minSimilarity)
  const visibleNodeIds = new Set<string>()
  
  filteredEdges.forEach(e => {
    visibleNodeIds.add(e.source)
    visibleNodeIds.add(e.target)
  })

  // If no edges pass the threshold, show all nodes anyway
  const filteredNodes = graph.nodes.filter(n => {
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

  const handleNodeClick = (node: any) => {
    if (node.url) {
      chrome.tabs.create({ url: node.url })
    }
  }

  // Draw cluster boundaries for clusters with 2+ nodes
  const drawClusterBoundaries = (ctx: CanvasRenderingContext2D, globalScale: number) => {
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
      ctx.strokeStyle = color + '40' // 25% opacity
      ctx.lineWidth = 2 / globalScale
      ctx.setLineDash([5 / globalScale, 5 / globalScale])
      ctx.stroke()
      ctx.setLineDash([])
      
      ctx.fillStyle = color + '10' // 6% opacity
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

  return (
    <div className="w-full rounded-lg border bg-white shadow-sm" style={{ borderColor: "#E5E5E5" }}>
      <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: "#E5E5E5" }}>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Knowledge Graph</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-slate-700">{filteredNodes.length} nodes</span>
            <span className="text-slate-400">•</span>
            <span className="text-sm text-slate-700">{graphData.links.length} edges</span>
            <span className="text-slate-400">•</span>
            <span className="text-sm text-slate-700">{clusters.length} clusters</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">Filters</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Graph Filters</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                      <span>Min Similarity</span>
                      <span>{minSimilarity.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.2}
                      max={0.6}
                      step={0.05}
                      value={minSimilarity}
                      onChange={(e) => setMinSimilarity(parseFloat(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </label>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Clusters</p>
                  <div className="flex flex-wrap gap-2">
                    {clusters.map(clusterId => (
                      <button
                        key={clusterId}
                        onClick={() => toggleCluster(clusterId)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                          allClustersSelected || selectedClusters.has(clusterId)
                            ? "border-transparent text-white"
                            : "border-slate-300 text-slate-600 bg-white"
                        }`}
                        style={{
                          backgroundColor: allClustersSelected || selectedClusters.has(clusterId)
                            ? getClusterColor(clusterId)
                            : undefined
                        }}
                      >
                        Cluster {clusterId}
                      </button>
                    ))}
                  </div>
                  {!allClustersSelected && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearClusterFilter}
                      className="mt-3"
                    >
                      Show All Clusters
                    </Button>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button size="sm" onClick={handleRefresh} className="bg-[#0072de] text-white hover:bg-[#0066c6]">
            Refresh
          </Button>
        </div>
      </div>
      <div ref={containerRef} className="relative bg-white" style={{ height: "500px", width: "100%" }}>
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
              const fontSize = 12 / globalScale
              ctx.font = `${fontSize}px Sans-Serif`
              
              const size = node.__bckgDimensions ? node.__bckgDimensions[0] : 4
              
              // Draw node circle
              ctx.beginPath()
              ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false)
              ctx.fillStyle = node.color
              ctx.fill()
              
              // Draw border for emphasis
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
              ctx.lineWidth = 0.5 / globalScale
              ctx.stroke()
              
              // Draw label below node
              if (globalScale > 0.8) {
                ctx.textAlign = 'center'
                ctx.textBaseline = 'top'
                ctx.fillStyle = '#1e293b'
                ctx.fillText(label, node.x, node.y + size + 2)
              }
            }}
            nodeCanvasObjectMode={() => 'replace'}
            linkWidth={(link: any) => Math.max(0.5, link.value * 2)}
            linkColor={() => "#cbd5e1"}
            linkDirectionalParticles={0}
            onNodeClick={handleNodeClick}
            cooldownTicks={100}
            dagMode={null}
            d3VelocityDecay={0.3}
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
          <div className="flex items-center justify-center h-full text-sm text-slate-500">
            No nodes to display. Try lowering the similarity threshold.
          </div>
        )}
      </div>
      <div className="p-3 border-t text-xs text-slate-500" style={{ borderColor: "#E5E5E5" }}>
        Click nodes to open pages. Node size reflects visit count. Edge width shows similarity strength.
      </div>
    </div>
  )
}

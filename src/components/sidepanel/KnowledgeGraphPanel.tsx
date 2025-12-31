import React, { useEffect, useRef, useState } from "react"
import { ArrowLeft, Search, ZoomIn, ZoomOut } from "lucide-react"
import ForceGraph from "force-graph"
import { knowledgeGraphData } from "./knowledgeGraphData"

interface KnowledgeGraphPanelProps {
  isOpen: boolean
  onClose: () => void
}

const CATEGORY_COLORS: { [key: string]: string } = {
  Research: "#1428A0",
  Shopping: "#0066CC",
  Development: "#004E98",
  Entertainment: "#0099FF",
  Productivity: "#0066CC",
  Health: "#FF6B35",
}

export const KnowledgeGraphPanel: React.FC<KnowledgeGraphPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<any>(null)
  const [selectedNode, setSelectedNode] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [visibleNodes, setVisibleNodes] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!isOpen || !containerRef.current) return

    // Clear container before initializing
    if (containerRef.current) {
      containerRef.current.innerHTML = ""
    }

    let hoveredNode: any = null
    const nodeScales = new Map()

    // Filter nodes based on search and category
    const filteredNodes = knowledgeGraphData.nodes.filter((node) => {
      const matchesSearch =
        searchQuery === "" ||
        node.id.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory =
        selectedCategory === null || node.category === selectedCategory
      return matchesSearch && matchesCategory
    })

    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id))
    setVisibleNodes(visibleNodeIds)

    const filteredLinks = knowledgeGraphData.links.filter(
      (link) =>
        visibleNodeIds.has(link.source as string) &&
        visibleNodeIds.has(link.target as string)
    )

    const fg = (ForceGraph as any)()(containerRef.current)
      .width(containerRef.current.clientWidth)
      .height(containerRef.current.clientHeight)
      .backgroundColor("#ffffff")
      .d3AlphaDecay(0.05)
      .d3VelocityDecay(0.4)
      .nodeId("id")
      .nodeRelSize(6)
      .nodeVal((node: any) => {
        const currentScale = nodeScales.get(node.id) || 1
        return node === hoveredNode ? 3 : currentScale
      })
      .nodeColor((node: any) => {
        return CATEGORY_COLORS[node.category] || "#3B82F6"
      })
      .linkColor(() => "rgba(100,100,150,0.2)")
      .linkWidth((link: any) => {
        return 1
      })
      .onNodeHover((node: any) => {
        hoveredNode = node
        document.body.style.cursor = node ? "pointer" : "default"

        const animate = () => {
          let needsUpdate = false

          fg.graphData().nodes.forEach((n: any) => {
            const targetScale = n === hoveredNode ? 3 : 1
            const currentScale = nodeScales.get(n.id) || 1

            if (Math.abs(currentScale - targetScale) > 0.01) {
              const newScale = currentScale + (targetScale - currentScale) * 0.2
              nodeScales.set(n.id, newScale)
              needsUpdate = true
            } else {
              nodeScales.set(n.id, targetScale)
            }
          })

          if (needsUpdate) {
            fg.nodeVal((n: any) => nodeScales.get(n.id) || 1)
            requestAnimationFrame(animate)
          }
        }

        animate()
      })
      .onNodeClick((node: any) => {
        setSelectedNode(node)
      })
      .nodeCanvasObjectMode(() => "after")
      .nodeCanvasObject(
        (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const label = node.id
          const scale = nodeScales.get(node.id) || 1
          const fontSize = 6 + scale * 2
          const yOffset = -12 - (scale - 1) * 3

          ctx.font = `500 ${fontSize}px system-ui, -apple-system, sans-serif`
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"

          // Text background
          const metrics = ctx.measureText(label)
          const padding = 4
          const bgWidth = metrics.width + padding * 2
          const bgHeight = fontSize + padding

          ctx.fillStyle = "rgba(255, 255, 255, 0.9)"
          ctx.fillRect(
            node.x - bgWidth / 2,
            node.y + yOffset - bgHeight / 2,
            bgWidth,
            bgHeight
          )

          ctx.fillStyle = "rgba(0,0,0,0.85)"
          ctx.fillText(label, node.x, node.y + yOffset)
        }
      )

    fg.graphData({ nodes: filteredNodes, links: filteredLinks })
    graphRef.current = fg

    const handleResize = () => {
      if (containerRef.current) {
        fg.width(containerRef.current.clientWidth).height(
          containerRef.current.clientHeight
        )
      }
    }

    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
      fg._destructor?.()
    }
  }, [isOpen, searchQuery, selectedCategory])

  const handleZoom = (direction: "in" | "out") => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom()
      const zoomFactor = direction === "in" ? 1.2 : 0.8
      graphRef.current.zoom(currentZoom * zoomFactor, 300)
    }
  }

  const handleResetView = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-[750px] flex flex-col overflow-hidden">
        {/* Header with Controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
              title="Back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-gray-900 truncate">
                Knowledge Graph
              </h2>
              <p className="text-sm text-gray-600 truncate">
                Explore interconnected browsing patterns
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            {/* Search */}
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-300">
              <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-w-0 w-full sm:w-40 text-sm focus:outline-none"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory || ""}
              onChange={(e) =>
                setSelectedCategory(e.target.value === "" ? null : e.target.value)
              }
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">All Categories</option>
              {Object.keys(CATEGORY_COLORS).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-hidden relative">
          <div
            ref={containerRef}
            style={{
              width: "100%",
              height: "100%",
            }}
          />

          {/* Zoom Controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-1 bg-white border border-gray-300 rounded-lg shadow-lg p-1">
            <button
              onClick={() => handleZoom("in")}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4 text-gray-600" />
            </button>
            <button
              onClick={() => handleZoom("out")}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4 text-gray-600" />
            </button>
            <div className="border-t border-gray-300"></div>
            <button
              onClick={handleResetView}
              className="px-2 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors"
              title="Reset View"
            >
              Reset
            </button>
          </div>
          
          {/* Info Tooltip */}
          {selectedNode && (
            <div className="absolute bottom-4 left-4 bg-white border border-gray-300 rounded-lg shadow-lg p-3 max-w-xs">
              <p className="font-semibold text-gray-900 text-sm">{selectedNode.id}</p>
              <p className="text-xs text-gray-600 mt-1">
                Category: <span style={{ color: CATEGORY_COLORS[selectedNode.category] }} className="font-medium">{selectedNode.category}</span>
              </p>
              <button
                onClick={() => setSelectedNode(null)}
                className="mt-2 text-xs text-gray-600 hover:text-gray-900"
              >
                ✕ Clear
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

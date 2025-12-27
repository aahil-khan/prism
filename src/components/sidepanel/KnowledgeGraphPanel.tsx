import React, { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import ForceGraph from "force-graph"

interface KnowledgeGraphPanelProps {
  isOpen: boolean
  onClose: () => void
}

export const KnowledgeGraphPanel: React.FC<KnowledgeGraphPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<any>(null)
  const [selectedNode, setSelectedNode] = useState<any>(null)

  useEffect(() => {
    if (!isOpen || !containerRef.current) return

    let hoveredNode: any = null
    const nodeScales = new Map()

    const knowledgeGraphData = {
      nodes: [
        // Research & Learning Cluster
        { id: "Research & Learning", category: "Research" },
        { id: "Google Docs", category: "Research" },
        { id: "Wikipedia", category: "Research" },
        { id: "Stack Overflow", category: "Research" },
        { id: "MDN Web Docs", category: "Research" },
        { id: "GitHub", category: "Research" },

        // Shopping & E-commerce Cluster
        { id: "Shopping & E-commerce", category: "Shopping" },
        { id: "Amazon", category: "Shopping" },
        { id: "Flipkart", category: "Shopping" },
        { id: "eBay", category: "Shopping" },
        { id: "Product Reviews", category: "Shopping" },
        { id: "Price Comparison", category: "Shopping" },

        // Development & Tools Cluster
        { id: "Development Tools", category: "Development" },
        { id: "VS Code", category: "Development" },
        { id: "Figma Design", category: "Development" },
        { id: "Slack Communication", category: "Development" },
        { id: "Jira Project Management", category: "Development" },
        { id: "NPM Registry", category: "Development" },

        // Entertainment & Media Cluster
        { id: "Entertainment & Media", category: "Entertainment" },
        { id: "YouTube", category: "Entertainment" },
        { id: "Netflix", category: "Entertainment" },
        { id: "Twitter/X", category: "Entertainment" },
        { id: "Reddit", category: "Entertainment" },
        { id: "News Sites", category: "Entertainment" },

        // Productivity & Organization Cluster
        { id: "Productivity Tools", category: "Productivity" },
        { id: "Notion", category: "Productivity" },
        { id: "Google Calendar", category: "Productivity" },
        { id: "Asana", category: "Productivity" },
        { id: "Email", category: "Productivity" },
        { id: "Cloud Storage", category: "Productivity" },

        // Health & Wellness Cluster
        { id: "Health & Wellness", category: "Health" },
        { id: "Fitness Apps", category: "Health" },
        { id: "Nutrition Info", category: "Health" },
        { id: "Medical Resources", category: "Health" },
        { id: "Mental Health", category: "Health" },
      ],
      links: [
        // Research cluster internal
        { source: "Research & Learning", target: "Google Docs" },
        { source: "Research & Learning", target: "Wikipedia" },
        { source: "Research & Learning", target: "Stack Overflow" },
        { source: "Research & Learning", target: "MDN Web Docs" },
        { source: "Research & Learning", target: "GitHub" },
        { source: "Google Docs", target: "Stack Overflow" },
        { source: "GitHub", target: "Stack Overflow" },
        { source: "MDN Web Docs", target: "Google Docs" },

        // Shopping cluster internal
        { source: "Shopping & E-commerce", target: "Amazon" },
        { source: "Shopping & E-commerce", target: "Flipkart" },
        { source: "Shopping & E-commerce", target: "eBay" },
        { source: "Shopping & E-commerce", target: "Product Reviews" },
        { source: "Shopping & E-commerce", target: "Price Comparison" },
        { source: "Amazon", target: "Product Reviews" },
        { source: "Flipkart", target: "Price Comparison" },
        { source: "eBay", target: "Product Reviews" },

        // Development cluster internal
        { source: "Development Tools", target: "VS Code" },
        { source: "Development Tools", target: "Figma Design" },
        { source: "Development Tools", target: "Slack Communication" },
        { source: "Development Tools", target: "Jira Project Management" },
        { source: "Development Tools", target: "NPM Registry" },
        { source: "VS Code", target: "NPM Registry" },
        { source: "Figma Design", target: "Slack Communication" },
        { source: "Jira Project Management", target: "Slack Communication" },

        // Entertainment cluster internal
        { source: "Entertainment & Media", target: "YouTube" },
        { source: "Entertainment & Media", target: "Netflix" },
        { source: "Entertainment & Media", target: "Twitter/X" },
        { source: "Entertainment & Media", target: "Reddit" },
        { source: "Entertainment & Media", target: "News Sites" },
        { source: "YouTube", target: "Netflix" },
        { source: "Twitter/X", target: "Reddit" },
        { source: "Reddit", target: "News Sites" },

        // Productivity cluster internal
        { source: "Productivity Tools", target: "Notion" },
        { source: "Productivity Tools", target: "Google Calendar" },
        { source: "Productivity Tools", target: "Asana" },
        { source: "Productivity Tools", target: "Email" },
        { source: "Productivity Tools", target: "Cloud Storage" },
        { source: "Notion", target: "Asana" },
        { source: "Google Calendar", target: "Email" },
        { source: "Asana", target: "Cloud Storage" },

        // Health cluster internal
        { source: "Health & Wellness", target: "Fitness Apps" },
        { source: "Health & Wellness", target: "Nutrition Info" },
        { source: "Health & Wellness", target: "Medical Resources" },
        { source: "Health & Wellness", target: "Mental Health" },
        { source: "Fitness Apps", target: "Nutrition Info" },
        { source: "Medical Resources", target: "Mental Health" },

        // Cross-cluster connections (user navigation patterns)
        { source: "Google Docs", target: "Notion" },
        { source: "GitHub", target: "VS Code" },
        { source: "Stack Overflow", target: "NPM Registry" },
        { source: "Slack Communication", target: "Email" },
        { source: "YouTube", target: "Google Docs" },
        { source: "Product Reviews", target: "YouTube" },
        { source: "Fitness Apps", target: "YouTube" },
      ],
    }

    const fg = (ForceGraph as any)()(containerRef.current)
      .width(containerRef.current.clientWidth)
      .height(containerRef.current.clientHeight)
      .backgroundColor("#ffffff")
      .d3AlphaDecay(0.05)
      .d3VelocityDecay(0.4)
      .nodeId("id")
      .nodeRelSize(2.5)
      .nodeVal((node: any) => {
        const currentScale = nodeScales.get(node.id) || 1
        return node === hoveredNode ? 2.2 : currentScale
      })
      .nodeColor((node: any) => {
        const colorMap: { [key: string]: string } = {
          Research: "#3B82F6",
          Shopping: "#8B5CF6",
          Development: "#EC4899",
          Entertainment: "#F59E0B",
          Productivity: "#10B981",
          Health: "#EF4444",
        }
        return colorMap[node.category] || "#3B82F6"
      })
      .linkColor(() => "rgba(100,100,150,0.3)")
      .linkWidth(0.8)
      .onNodeHover((node: any) => {
        hoveredNode = node
        document.body.style.cursor = node ? "pointer" : "default"

        const animate = () => {
          let needsUpdate = false

          fg.graphData().nodes.forEach((n: any) => {
            const targetScale = n === hoveredNode ? 2.2 : 1
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
          const yOffset = -10 - (scale - 1) * 3

          ctx.font = `${fontSize}px system-ui, sans-serif`
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"

          ctx.fillStyle = "rgba(0,0,0,1)"
          ctx.fillText(label, node.x, node.y + yOffset)
        }
      )

    fg.graphData(knowledgeGraphData)
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
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[700px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Knowledge Graph
            </h2>
            <p className="text-sm text-gray-600">
              Explore interconnected concepts
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Canvas Container */}
        <div className="flex-1 overflow-hidden">
          <div
            ref={containerRef}
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          />
        </div>

        {/* Info Panel */}
        <div className="border-t border-gray-200 bg-gray-50 p-4 h-24 overflow-y-auto">
          {selectedNode ? (
            <div>
              <h3 className="font-semibold text-gray-900">{selectedNode.id}</h3>
              <p className="text-xs text-gray-500 mt-2">
                Category: <span className="font-medium">{selectedNode.category}</span>
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Click on nodes to explore connections
              </p>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">
              Hover over nodes to see details. Click on a node to select it.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_start"
}

export const getShadowHostId = () => "aegis-add-to-project-button"

interface Project {
  id: string
  name: string
  sites: Array<{ url: string }>
}

const AddToProjectButton = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [currentUrl, setCurrentUrl] = useState("")
  const [currentTitle, setCurrentTitle] = useState("")

  useEffect(() => {
    setCurrentUrl(window.location.href)
    setCurrentTitle(document.title)

    // Load projects
    chrome.storage.local.get(["aegis-projects"], (result) => {
      const projectsData = result["aegis-projects"] || []
      setProjects(projectsData)
    })

    // Listen for storage changes
    const handleStorageChange = (changes: any) => {
      if (changes["aegis-projects"]) {
        setProjects(changes["aegis-projects"].newValue || [])
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  const handleAddToProject = async (projectId: string) => {
    chrome.runtime.sendMessage({
      type: "ADD_SITE_TO_PROJECT",
      payload: {
        projectId,
        siteUrl: currentUrl,
        siteTitle: currentTitle,
        addedBy: "user"
      }
    }, (response) => {
      if (response?.success) {
        // Show success feedback
        console.log("✅ Site added to project")
        setIsOpen(false)
        
        // Show temporary success message
        const successMsg = document.createElement("div")
        successMsg.textContent = "✓ Added to project"
        successMsg.style.cssText = `
          position: fixed;
          bottom: 80px;
          right: 20px;
          background: #4CAF50;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          z-index: 999999;
          font-family: system-ui;
          animation: fadeInOut 3s ease-in-out;
        `
        document.body.appendChild(successMsg)
        setTimeout(() => successMsg.remove(), 3000)
      } else {
        console.error("❌ Failed to add site:", response?.error)
      }
    })
  }

  const isSiteInProject = (project: Project) => {
    return project.sites?.some(site => site.url === currentUrl)
  }

  if (projects.length === 0) return null

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 999998,
        fontFamily: "system-ui, -apple-system, sans-serif"
      }}>
      
      {/* Project Selection Dropdown */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            bottom: "70px",
            right: "0",
            background: "white",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
            padding: "8px",
            minWidth: "280px",
            maxHeight: "400px",
            overflowY: "auto",
            animation: "scaleIn 0.2s ease-out"
          }}>
          
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #eee",
              fontSize: "12px",
              fontWeight: "600",
              color: "#666",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
            Add to Project
          </div>

          {projects.map((project) => {
            const alreadyAdded = isSiteInProject(project)
            
            return (
              <button
                key={project.id}
                onClick={() => !alreadyAdded && handleAddToProject(project.id)}
                disabled={alreadyAdded}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "none",
                  background: alreadyAdded ? "#f5f5f5" : "transparent",
                  cursor: alreadyAdded ? "not-allowed" : "pointer",
                  textAlign: "left",
                  borderRadius: "8px",
                  fontSize: "14px",
                  color: alreadyAdded ? "#999" : "#080A0B",
                  transition: "background 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
                onMouseEnter={(e) => {
                  if (!alreadyAdded) {
                    e.currentTarget.style.background = "#f5f5f5"
                  }
                }}
                onMouseLeave={(e) => {
                  if (!alreadyAdded) {
                    e.currentTarget.style.background = "transparent"
                  }
                }}>
                
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{project.name}</div>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                    {project.sites?.length || 0} sites
                  </div>
                </div>

                {alreadyAdded && (
                  <span style={{ fontSize: "12px", color: "#4CAF50" }}>
                    ✓ Added
                  </span>
                )}
              </button>
            )
          })}

          {projects.length === 0 && (
            <div
              style={{
                padding: "24px",
                textAlign: "center",
                color: "#999",
                fontSize: "14px"
              }}>
              No projects yet
            </div>
          )}
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          border: "none",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          fontSize: "24px",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 0.2s, box-shadow 0.2s",
          position: "relative"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.1)"
          e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.3)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)"
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.2)"
        }}>
        
        {isOpen ? "×" : "+"}

        {/* Badge showing project count */}
        {!isOpen && projects.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              background: "#ff4757",
              color: "white",
              borderRadius: "50%",
              width: "20px",
              height: "20px",
              fontSize: "11px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid white"
            }}>
            {projects.length}
          </div>
        )}
      </button>

      <style>{`
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(10px); }
          10% { opacity: 1; transform: translateY(0); }
          90% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-10px); }
        }
      `}</style>
    </div>
  )
}

export default AddToProjectButton

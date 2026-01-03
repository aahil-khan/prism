import { X, Folder, Edit2, ExternalLink, Bell, BellOff, Trash2, Clock, ChevronDown } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { Session } from "~/types/session"
import type { Project } from "~/types/project"

const isNewTabUrl = (url?: string) => {
  if (!url) return true
  const normalized = url.toLowerCase()
  return normalized.startsWith("chrome://newtab") || normalized.startsWith("edge://newtab") || normalized === "about:blank"
}

async function sendMessage<T>(message: any): Promise<T> {
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

// Projects Panel Component
interface ProjectsPanelProps {
  projects: Project[]
  sessions: Session[]
  expandedProjects: string[]
  onToggleProject: (projectId: string) => void
  onDetectProjects: () => Promise<void>
  onUpdateProject: (projectId: string, updates: Partial<Project>) => Promise<void>
  onDeleteProject: (projectId: string) => Promise<void>
  onProjectsUpdate?: (projects: Project[]) => void
  currentPage: { url: string; title: string } | null
  quickAddRequest?: { url: string; title: string } | null
  onCompleteQuickAdd?: () => void
  onRefreshCurrentPage?: () => void
}

function ProjectsPanel({
  projects,
  sessions,
  expandedProjects,
  onToggleProject,
  onDetectProjects,
  onUpdateProject,
  onDeleteProject,
  onProjectsUpdate,
  currentPage,
  quickAddRequest,
  onCompleteQuickAdd,
  onRefreshCurrentPage
}: ProjectsPanelProps) {
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [adding, setAdding] = useState(false)
  const [addMessage, setAddMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [showCreateCard, setShowCreateCard] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDescription, setNewProjectDescription] = useState("")
  const [creating, setCreating] = useState(false)
  const [showCurrentPage, setShowCurrentPage] = useState(false)

  const fetchCurrentPageInPanel = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0]
      if (tab?.url && !isNewTabUrl(tab.url)) {
        // Update current page through props or local state if needed
      }
    })
  }

  // Check if sidebar should auto-open the add current page panel
  useEffect(() => {
    chrome.storage.local.get("sidepanel-show-add-current-page", (result) => {
      if (result["sidepanel-show-add-current-page"]) {
        setShowCurrentPage(true)
        // Clear the flag after using it
        chrome.storage.local.remove("sidepanel-show-add-current-page")
      }
    })
  }, [])

  const targetPage = useMemo(() => quickAddRequest || currentPage, [quickAddRequest, currentPage])

  useEffect(() => {
    if (projects.length > 0 && (!selectedProjectId || !projects.find((p) => p.id === selectedProjectId))) {
      setSelectedProjectId(projects[0].id)
    }
  }, [projects, selectedProjectId])

  useEffect(() => {
    if (quickAddRequest && projects.length > 0) {
      setSelectedProjectId(projects[0].id)
    }
  }, [quickAddRequest, projects])

  useEffect(() => {
    setAddMessage(null)
  }, [targetPage?.url, selectedProjectId])

  const handleStartEdit = (project: Project) => {
    setEditingProjectId(project.id)
    setEditName(project.name)
  }

  const handleSaveEdit = async (projectId: string) => {
    if (editName.trim()) {
      await onUpdateProject(projectId, { name: editName.trim() })
    }
    setEditingProjectId(null)
    setEditName("")
  }

  const handleCancelEdit = () => {
    setEditingProjectId(null)
    setEditName("")
  }

  const handleDelete = async (projectId: string) => {
    if (window.confirm("Delete this project? Sessions will not be deleted.")) {
      await onDeleteProject(projectId)
    }
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return

    setCreating(true)
    let created = false
    try {
      const response = await sendMessage<{ success: boolean; project?: Project }>({
        type: "ADD_PROJECT",
        payload: {
          name: newProjectName.trim(),
          description: newProjectDescription.trim() || undefined,
          sessionIds: [],
          sites: [],
          autoDetected: false
        }
      })

      if (response?.success) {
        created = true
        const projectsResponse = await sendMessage<{ projects: Project[] }>({
          type: "GET_PROJECTS"
        })

        if (projectsResponse?.projects) {
          onProjectsUpdate?.(projectsResponse.projects)
        }

        // Immediately close and reset the create card
        setShowCreateCard(false)
        setNewProjectName("")
        setNewProjectDescription("")
      }
    } catch (err) {
      console.error("Failed to create project:", err)
    } finally {
      if (created) {
        // Fallback: ensure card closes even if re-render timing is off
        setShowCreateCard(false)
      }
      setCreating(false)
    }
  }

  const handleAddCurrentPage = async () => {
    if (!targetPage || !selectedProjectId) return

    setAdding(true)
    setAddMessage(null)

    try {
      const response = await sendMessage<{ success: boolean; alreadyAdded?: boolean; error?: string }>({
        type: "ADD_SITE_TO_PROJECT",
        payload: {
          projectId: selectedProjectId,
          siteUrl: targetPage.url,
          siteTitle: targetPage.title,
          addedBy: "user"
        }
      })

      if (response?.success || response?.alreadyAdded) {
        setAddMessage({ type: "success", text: response?.alreadyAdded ? "Already in this project" : "Added to project" })
        
        // Reload projects to show updated site list
        try {
          const projectsResponse = await sendMessage<{ projects: Project[] }>({ 
            type: "GET_PROJECTS" 
          })
          if (projectsResponse?.projects) {
            // Update the projects in the parent component
            const updatedProject = projectsResponse.projects.find(p => p.id === selectedProjectId)
            if (updatedProject) {
              await onUpdateProject(selectedProjectId, { sites: updatedProject.sites })
            }
          }
        } catch (refreshErr) {
          console.error("Failed to refresh projects after adding site:", refreshErr)
        }
        
        onCompleteQuickAdd?.()
      } else {
        setAddMessage({ type: "error", text: response?.error || "Unable to add page" })
      }
    } catch (err) {
      setAddMessage({ type: "error", text: "Unable to add page" })
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Current Page Section - Now toggleable */}
      {showCurrentPage && targetPage && (
        <div
          className="rounded-xl border p-3 bg-white shadow-sm"
          style={{ borderColor: '#E5E5E5' }}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <div className="text-2xs mb-1" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'", fontSize: '10px' }}>
                Current page
              </div>
              <div className="text-sm font-semibold truncate" style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
                {targetPage.title || targetPage.url}
              </div>
              <div className="text-2xs truncate" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'", fontSize: '10px' }}>
                {targetPage.url}
              </div>
            </div>
            <button
              onClick={() => setShowCurrentPage(false)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Close">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#9A9FA6' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(() => {
              // Filter out projects that already have this site
              const availableProjects = targetPage 
                ? projects.filter(p => !p.sites.some(s => s.url === targetPage.url))
                : projects

              return (
                <>
                  <select
                    value={selectedProjectId && availableProjects.some(p => p.id === selectedProjectId) ? selectedProjectId : (availableProjects[0]?.id || "")}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="flex-1 min-w-[180px] px-3 py-2 text-sm rounded border"
                    style={{ borderColor: '#E5E5E5', color: '#080A0B', fontFamily: "'Breeze Sans'" }}
                    disabled={availableProjects.length === 0}>
                    {availableProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddCurrentPage}
                    disabled={!selectedProjectId || adding || availableProjects.length === 0}
                    className="px-3 py-2 text-sm rounded text-white transition-colors disabled:opacity-60"
                    style={{ backgroundColor: '#0072de', fontFamily: "'Breeze Sans'" }}>
                    {adding ? 'Adding...' : 'Add to project'}
                  </button>
                </>
              )
            })()}
          </div>

          {(() => {
            const availableProjects = targetPage 
              ? projects.filter(p => !p.sites.some(s => s.url === targetPage.url))
              : projects

            if (availableProjects.length === 0 && projects.length > 0) {
              return (
                <div className="text-2xs mt-2" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'", fontSize: '10px' }}>
                  This page is already in all your projects.
                </div>
              )
            }

            if (availableProjects.length === 0) {
              return (
                <div className="text-2xs mt-2" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'", fontSize: '10px' }}>
                  Create or detect a project to add this page.
                </div>
              )
            }

            return null
          })()}

          {addMessage && (
            <div
              className="text-2xs mt-2"
              style={{
                color: addMessage.type === 'success' ? '#0f9d58' : '#b00020',
                fontFamily: "'Breeze Sans'",
                fontSize: '10px'
              }}>
              {addMessage.text}
            </div>
          )}
        </div>
      )}

      {/* Header with Action Buttons - Sticky */}
      <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-white border-b" style={{ borderColor: '#E5E5E5' }}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowCurrentPage(!showCurrentPage)
              if (!showCurrentPage && !currentPage) {
                fetchCurrentPageInPanel()
              }
            }}
            disabled={!currentPage && !showCurrentPage}
            className="px-2 py-1 text-xs rounded-lg text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
            style={{ backgroundColor: showCurrentPage ? '#9A9FA6' : '#0072de', fontFamily: "'Breeze Sans'" }}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {showCurrentPage ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              )}
            </svg>
            {showCurrentPage ? 'Close' : 'Add Current Site'}
          </button>
          <button
            onClick={() => {
              setShowCreateCard(!showCreateCard)
              setNewProjectName("")
              setNewProjectDescription("")
            }}
            className="px-2 py-1 text-xs rounded-lg text-white transition-colors flex items-center gap-1.5"
            style={{ backgroundColor: showCreateCard ? '#9A9FA6' : '#0072de', fontFamily: "'Breeze Sans'" }}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {showCreateCard ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              )}
            </svg>
            {showCreateCard ? 'Cancel' : 'New Project'}
          </button>
        </div>
      </div>

      {/* Create Project Card */}
      {showCreateCard && (
        <div
          className="rounded-xl border p-4 bg-white shadow-sm"
          style={{ borderColor: '#0072de', borderWidth: '2px' }}>
          <div className="flex items-center gap-2 mb-3">
            <Folder className="h-5 w-5" style={{ color: '#0072de' }} />
            <h3 className="text-base font-semibold" style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
              Create New Project
            </h3>
          </div>
          
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: '#555', fontFamily: "'Breeze Sans'" }}>
                Project Name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g., Machine Learning Research"
                className="w-full px-3 py-2 text-sm rounded border"
                style={{ 
                  fontFamily: "'Breeze Sans'",
                  borderColor: '#E5E5E5',
                  backgroundColor: '#FFFFFF',
                  color: '#080A0B'
                }}
                autoFocus
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: '#555', fontFamily: "'Breeze Sans'" }}>
                Description (Optional)
              </label>
              <textarea
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                placeholder="Add notes about this project..."
                className="w-full px-3 py-2 text-sm rounded border resize-none"
                style={{ 
                  fontFamily: "'Breeze Sans'",
                  minHeight: '80px',
                  borderColor: '#E5E5E5',
                  backgroundColor: '#FFFFFF',
                  color: '#080A0B'
                }}
              />
            </div>
            
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowCreateCard(false)
                  setNewProjectName("")
                  setNewProjectDescription("")
                }}
                disabled={creating}
                className="px-3 py-2 text-sm rounded border transition-colors"
                style={{ 
                  borderColor: '#E5E5E5',
                  color: '#080A0B',
                  fontFamily: "'Breeze Sans'",
                  backgroundColor: '#FFFFFF'
                }}>
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim() || creating}
                className="px-3 py-2 text-sm rounded transition-colors disabled:opacity-50"
                style={{ 
                  backgroundColor: '#0072de',
                  color: 'white',
                  fontFamily: "'Breeze Sans'"
                }}>
                {creating ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Projects List */}
      {projects.length === 0 && !showCreateCard ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Folder className="h-12 w-12 opacity-30" style={{ color: '#9A9FA6' }} />
          <div className="text-center">
            <p className="text-sm mb-1" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
              No projects found
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {projects
            .sort((a, b) => b.startDate - a.startDate)
            .map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                sessions={sessions.filter(s => project.sessionIds.includes(s.id))}
                isExpanded={expandedProjects.includes(project.id)}
                onToggle={() => onToggleProject(project.id)}
                isEditing={editingProjectId === project.id}
                editName={editName}
                onEditNameChange={setEditName}
                onStartEdit={() => handleStartEdit(project)}
                onSaveEdit={() => handleSaveEdit(project.id)}
                onCancelEdit={handleCancelEdit}
                onDelete={() => handleDelete(project.id)}
                onRemoveSite={async (siteUrl) => {
                  const updatedSites = (project.sites || []).filter(s => s.url !== siteUrl)
                  await onUpdateProject(project.id, { sites: updatedSites })
                }}
              />
            ))}
        </div>
      )}
    </div>
  )
}

// Project Card Component
interface ProjectCardProps {
  project: Project
  sessions: Session[]
  isExpanded: boolean
  onToggle: () => void
  isEditing: boolean
  editName: string
  onEditNameChange: (name: string) => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
  onRemoveSite?: (siteUrl: string) => Promise<void>
}

function ProjectCard({
  project,
  sessions,
  isExpanded,
  onToggle,
  isEditing,
  editName,
  onEditNameChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onRemoveSite
}: ProjectCardProps) {
  const [editingDescription, setEditingDescription] = useState(false)
  const [editDescriptionValue, setEditDescriptionValue] = useState(project.description || "")
  const [showReminderDialog, setShowReminderDialog] = useState(false)
  const [reminderForm, setReminderForm] = useState({
    enabled: project.reminder?.enabled || false,
    type: project.reminder?.type || 'daily' as 'daily' | 'once' | 'weekly',
    time: project.reminder?.time || '09:00',
    date: project.reminder?.date || new Date().toISOString().split('T')[0],
    daysOfWeek: project.reminder?.daysOfWeek || [1, 2, 3, 4, 5] // Mon-Fri by default
  })

  const duration = Math.ceil((project.endDate - project.startDate) / (1000 * 60 * 60 * 24))
  const startDateStr = new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endDateStr = new Date(project.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const handleSaveDescription = async () => {
    console.log("Save description:", editDescriptionValue)
    
    // Update project with new description
    const updatedProject = {
      ...project,
      description: editDescriptionValue
    }
    
    // Get all projects and replace the current one
    const projects = await chrome.storage.local.get("aegis-projects")
    const allProjects = projects["aegis-projects"] || []
    const updatedProjects = allProjects.map((p: any) => 
      p.id === project.id ? updatedProject : p
    )
    
    // Save back to storage
    await chrome.storage.local.set({ "aegis-projects": updatedProjects })
    
    setEditingDescription(false)
  }

  const handleCancelDescription = () => {
    setEditDescriptionValue(project.description || "")
    setEditingDescription(false)
  }

  const handleSaveReminder = async () => {
    const reminder = {
      enabled: reminderForm.enabled,
      type: reminderForm.type,
      time: reminderForm.time,
      date: reminderForm.type === 'once' ? reminderForm.date : undefined,
      daysOfWeek: reminderForm.type === 'weekly' ? reminderForm.daysOfWeek : undefined,
      snoozeCount: 0,
      snoozedUntil: undefined,
      lastTriggered: undefined
    }
    
    // Update project with reminder
    const updatedProject = {
      ...project,
      reminder
    }
    
    // Get all projects and replace the current one
    const projects = await chrome.storage.local.get("aegis-projects")
    const allProjects = projects["aegis-projects"] || []
    const updatedProjects = allProjects.map((p: any) => 
      p.id === project.id ? updatedProject : p
    )
    
    // Save back to storage
    await chrome.storage.local.set({ "aegis-projects": updatedProjects })
    
    // Schedule/cancel reminder in background
    await chrome.runtime.sendMessage({
      type: reminder.enabled ? "SET_PROJECT_REMINDER" : "CANCEL_PROJECT_REMINDER",
      payload: {
        projectId: project.id,
        reminder
      }
    })
    
    setShowReminderDialog(false)
  }

  return (
    <div
      className="flex flex-col rounded-xl p-3 cursor-pointer transition-all hover:shadow-md"
      style={{ 
        backgroundColor: '#FAFAFA',
        border: '1px solid #E5E5E5'
      }}
      onClick={onToggle}>
      
      {/* Project Header - Compact Layout */}
      <div className="flex items-start gap-3 mb-2">
        <div className="flex-1 min-w-0">
          {/* Title Row */}
          <div className="flex items-center gap-2 mb-1">
            {isEditing ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => onEditNameChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-w-0 px-2 py-1 text-base font-semibold rounded border"
                style={{ 
                  color: 'var(--dark)', 
                  fontFamily: "'Breeze Sans'",
                  borderColor: '#0074FB'
                }}
                autoFocus
              />
            ) : (
              <>
                <h3 className="text-base font-semibold flex-1 min-w-0" style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
                  {project.name}
                </h3>
                
                {/* Snooze State Indicator - Inline */}
                {project.reminder?.snoozedUntil && Date.now() < project.reminder.snoozedUntil && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded" style={{ backgroundColor: '#F5F5F5' }}>
                    <Clock className="h-3 w-3" style={{ color: '#9A9FA6' }} />
                    <span className="text-2xs whitespace-nowrap" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'", fontSize: '10px' }}>
                      {Math.ceil((project.reminder.snoozedUntil - Date.now()) / 1000 / 60)} min
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        chrome.runtime.sendMessage({
                          type: "DISMISS_SNOOZE",
                          payload: { projectId: project.id }
                        }).catch(err => console.error("Failed to dismiss snooze:", err))
                      }}
                      className="hover:bg-gray-200 rounded p-0.5 transition-colors"
                      title="Dismiss snooze">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#9A9FA6' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Actions Row - Horizontal */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {isEditing ? (
            <>
              <button
                onClick={onSaveEdit}
                className="px-2 py-1 rounded text-xs font-medium"
                style={{ backgroundColor: '#0074FB', color: 'white' }}>
                Save
              </button>
              <button
                onClick={onCancelEdit}
                className="px-2 py-1 rounded text-xs font-medium"
                style={{ backgroundColor: '#E5E5E5', color: '#080A0B' }}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onStartEdit()
                }}
                className="hover:bg-white rounded p-1.5 transition-colors"
                title="Edit project">
                <Edit2 className="h-4 w-4" style={{ color: '#9A9FA6' }} />
              </button>
              
              {project.sites && project.sites.length > 0 && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation()
                    
                    const tabIds: number[] = []
                    for (const site of project.sites) {
                      const url = site.url.startsWith('http') ? site.url : `https://${site.url}`
                      const tab = await chrome.tabs.create({ url })
                      if (tab.id) tabIds.push(tab.id)
                    }
                    
                    if (tabIds.length > 0) {
                      const groupId = await chrome.tabs.group({ tabIds })
                      chrome.tabGroups.update(groupId, {
                        title: project.name,
                        collapsed: false
                      }).catch((error) => {
                        console.error('Failed to update tab group:', error)
                      })
                    }
                  }}
                  className="hover:bg-white rounded p-1.5 transition-colors"
                  title="Open all sites">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#9A9FA6' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              )}
              
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowReminderDialog(true)
                }}
                className="hover:bg-white rounded p-1.5 transition-colors relative"
                title={project.reminder?.enabled ? "Reminder active" : "Set reminder"}>
                {project.reminder?.enabled ? (
                  <Bell className="h-4 w-4" style={{ color: '#0074FB' }} />
                ) : (
                  <BellOff className="h-4 w-4" style={{ color: '#9A9FA6' }} />
                )}
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                className="hover:bg-red-100 rounded p-1.5 transition-colors"
                title="Delete project">
                <Trash2 className="h-4 w-4" style={{ color: '#9A9FA6' }} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Description */}
      {editingDescription ? (
        <div className="flex flex-col gap-2 mb-2" onClick={(e) => e.stopPropagation()}>
          <textarea
            value={editDescriptionValue}
            onChange={(e) => setEditDescriptionValue(e.target.value)}
            className="flex-1 px-2 py-1 text-xs rounded border"
            style={{ 
              color: 'var(--dark)', 
              fontFamily: "'Breeze Sans'",
              borderColor: '#0074FB',
              resize: 'vertical',
              minHeight: '60px'
            }}
            autoFocus
          />
          <div className="flex items-center gap-1">
            <button
              onClick={handleSaveDescription}
              className="px-2 py-1 rounded text-xs font-medium"
              style={{ backgroundColor: '#0074FB', color: 'white' }}>
              Save
            </button>
            <button
              onClick={handleCancelDescription}
              className="px-2 py-1 rounded text-xs font-medium"
              style={{ backgroundColor: '#E5E5E5', color: '#080A0B' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : project.description ? (
        <div 
          className="flex items-start justify-between gap-2 mb-2 p-2 rounded group hover:bg-gray-100 transition-colors"
          style={{ backgroundColor: '#FAFAFA' }}
          onClick={(e) => e.stopPropagation()}>
          <p className="text-xs flex-1" style={{ color: '#64748b', fontFamily: "'Breeze Sans'" }}>
            {project.description}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setEditingDescription(true)
              setEditDescriptionValue(project.description || "")
            }}
            className="hover:bg-gray-200 rounded p-1 transition-all flex-shrink-0"
            title="Edit description">
            <Edit2 className="h-3 w-3" style={{ color: '#9A9FA6' }} />
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setEditingDescription(true)
            setEditDescriptionValue("")
          }}
          className="text-xs mb-2 px-2 py-1 rounded text-left transition-colors hover:bg-gray-100"
          style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
          + Add description
        </button>
      )}



      {/* Sites List (shown when expanded) */}
      {isExpanded && project.sites && project.sites.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-3 pb-3 border-b" style={{ borderColor: '#E5E5E5' }}>
          <h4 className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Sites ({project.sites.length})
          </h4>
          {project.sites
            .sort((a, b) => b.addedAt - a.addedAt)
            .slice(0, isExpanded ? project.sites.length : 3)
            .map((site, index) => {
              const domain = new URL(site.url.startsWith('http') ? site.url : `https://${site.url}`).hostname

              return (
                <div
                  key={`${site.url}-${index}`}
                  className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 transition-colors group"
                  style={{ backgroundColor: '#FAFAFA', border: '1px solid #E5E5E5' }}
                  onClick={(e) => e.stopPropagation()}>
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      const fullUrl = site.url.startsWith('http') ? site.url : `https://${site.url}`
                      chrome.runtime.sendMessage({ type: 'SITE_OPENED_FROM_SIDEPANEL', payload: { url: fullUrl } })
                      chrome.tabs.create({ url: fullUrl })
                    }}
                    title={`Open ${site.url}`}>
                    <p className="text-xs truncate mb-0.5" style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'", fontWeight: 500 }}>
                      {site.title}
                    </p>
                    <p className="text-2xs truncate" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'", fontSize: '10px' }}>
                      {domain}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {onRemoveSite && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (window.confirm(`Remove ${site.title} from this project?`)) {
                            onRemoveSite(site.url)
                          }
                        }}
                        className="p-1 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100 transition-all"
                        title="Remove site">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#EF4444' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          {!isExpanded && project.sites.length > 3 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggle()
              }}
              className="text-2xs py-1 px-2 rounded text-left transition-colors hover:bg-gray-100"
              style={{ color: '#667eea', fontFamily: "'Breeze Sans'", fontSize: '10px' }}>
              + {project.sites.length - 3} more site{project.sites.length - 3 === 1 ? '' : 's'}
            </button>
          )}    
        </div>
      )}

      {/* Expand Icon */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        className="flex items-center justify-center w-full pt-2 border-t hover:bg-gray-50 transition-colors"
        style={{ borderColor: '#E5E5E5' }}>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          style={{ color: '#9A9FA6' }}
        />
      </button>

      {/* Reminder Dialog */}
      {showReminderDialog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          style={{ zIndex: 9999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowReminderDialog(false)
            }
          }}>
          <div
            className="bg-white rounded-xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
            style={{ border: '1px solid #E5E5E5', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
                Set Reminder
              </h3>
              <button
                onClick={() => setShowReminderDialog(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors">
                <X className="h-5 w-5" style={{ color: '#9A9FA6' }} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
                  Enable Reminder
                </span>
                <button
                  onClick={() => setReminderForm({ ...reminderForm, enabled: !reminderForm.enabled })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${reminderForm.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${reminderForm.enabled ? 'translate-x-7' : 'translate-x-1'}`}
                  />
                </button>
              </div>

              {reminderForm.enabled && (
                <>
                  {/* Schedule Type */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
                      Schedule
                    </label>
                    <div className="flex gap-2">
                      {(['daily', 'once', 'weekly'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setReminderForm({ ...reminderForm, type })}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${reminderForm.type === type ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                          style={{ fontFamily: "'Breeze Sans'" }}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time Picker */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
                      Time
                    </label>
                    <input
                      type="time"
                      value={reminderForm.time}
                      onChange={(e) => setReminderForm({ ...reminderForm, time: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{ borderColor: '#E5E5E5', fontFamily: "'Breeze Sans'" }}
                    />
                  </div>

                  {/* Date Picker (for once) */}
                  {reminderForm.type === 'once' && (
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
                        Date
                      </label>
                      <input
                        type="date"
                        value={reminderForm.date}
                        onChange={(e) => setReminderForm({ ...reminderForm, date: e.target.value })}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: '#E5E5E5', fontFamily: "'Breeze Sans'" }}
                      />
                    </div>
                  )}

                  {/* Days of Week (for weekly) */}
                  {reminderForm.type === 'weekly' && (
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--dark)', fontFamily: "'Breeze Sans'" }}>
                        Days of Week
                      </label>
                      <div className="flex gap-2">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => {
                          const isSelected = reminderForm.daysOfWeek.includes(index)
                          return (
                            <button
                              key={index}
                              onClick={() => {
                                const newDays = isSelected
                                  ? reminderForm.daysOfWeek.filter(d => d !== index)
                                  : [...reminderForm.daysOfWeek, index].sort((a, b) => a - b)
                                setReminderForm({ ...reminderForm, daysOfWeek: newDays })
                              }}
                              className={`flex-1 w-8 h-8 rounded-full text-xs font-medium transition-colors ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                              style={{ fontFamily: "'Breeze Sans'" }}>
                              {day}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowReminderDialog(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ backgroundColor: '#E5E5E5', color: '#080A0B', fontFamily: "'Breeze Sans'" }}>
                  Cancel
                </button>
                <button
                  onClick={handleSaveReminder}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ backgroundColor: '#0074FB', color: 'white', fontFamily: "'Breeze Sans'" }}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export { ProjectsPanel, ProjectCard }

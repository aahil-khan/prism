import { useEffect, useState } from "react"
import { ChevronDown, ChevronUp, Plus, Trash2, Download, Upload, Power, PowerOff, Edit2, X, Check } from "lucide-react"
import type { Blocklist, BlocklistEntry, BlocklistCategory, FocusModeState, CategoryStates } from "~/types/focus-mode"
import { CATEGORY_INFO } from "~/types/focus-mode"

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

export function FocusPanel() {
  const [focusState, setFocusState] = useState<FocusModeState>({
    isActive: false,
    enabledCategories: []
  })
  const [blocklist, setBlocklist] = useState<Blocklist | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedCategories, setExpandedCategories] = useState<Set<BlocklistCategory>>(new Set())
  const [editingEntry, setEditingEntry] = useState<{ index: number; entry: BlocklistEntry } | null>(null)
  const [addingEntry, setAddingEntry] = useState<BlocklistCategory | null>(null)
  const [newEntryForm, setNewEntryForm] = useState({ pattern: "", reason: "" })

  // Load focus state and blocklist on mount
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [stateResponse, blocklistResponse] = await Promise.all([
        sendMessage<{ state: FocusModeState }>({ type: "GET_FOCUS_STATE" }),
        sendMessage<{ blocklist: Blocklist }>({ type: "GET_BLOCKLIST" })
      ])
      
      console.log("[FocusPanel] State response:", stateResponse)
      console.log("[FocusPanel] Blocklist response:", blocklistResponse)
      
      if (stateResponse?.state) {
        setFocusState(stateResponse.state)
      }
      
      if (blocklistResponse?.blocklist) {
        console.log("[FocusPanel] Blocklist entries:", blocklistResponse.blocklist.entries.length)
        setBlocklist(blocklistResponse.blocklist)
      }
    } catch (err) {
      console.error("[FocusPanel] Failed to load data:", err)
    } finally {
      setLoading(false)
    }
  }

  const toggleFocusMode = async () => {
    try {
      console.log("[FocusPanel] Toggling focus mode, current state:", focusState.isActive)
      const response = await sendMessage<{ state: FocusModeState }>({ 
        type: "TOGGLE_FOCUS_MODE" 
      })
      console.log("[FocusPanel] Toggle response:", response)
      if (response?.state) {
        setFocusState(response.state)
      }
    } catch (err) {
      console.error("[FocusPanel] Failed to toggle focus mode:", err)
    }
  }

  const toggleCategory = async (category: BlocklistCategory) => {
    try {
      const response = await sendMessage<{ state: FocusModeState }>({
        type: "TOGGLE_CATEGORY",
        payload: { category }
      })
      if (response?.state) {
        setFocusState(response.state)
      }
    } catch (err) {
      console.error("[FocusPanel] Failed to toggle category:", err)
    }
  }

  const toggleCategoryExpanded = (category: BlocklistCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const addEntry = async (category: BlocklistCategory) => {
    if (!newEntryForm.pattern.trim()) return

    try {
      const entry: BlocklistEntry = {
        pattern: newEntryForm.pattern.trim(),
        type: "domain",
        addedAt: Date.now(),
        reason: newEntryForm.reason.trim() || undefined,
        category
      }

      const response = await sendMessage<{ success: boolean; blocklist: Blocklist }>({
        type: "ADD_BLOCKLIST_ENTRY",
        payload: { entry }
      })

      if (response?.success && response?.blocklist) {
        setBlocklist(response.blocklist)
        setAddingEntry(null)
        setNewEntryForm({ pattern: "", reason: "" })
      }
    } catch (err) {
      console.error("[FocusPanel] Failed to add entry:", err)
    }
  }

  const deleteEntry = async (index: number) => {
    try {
      const response = await sendMessage<{ success: boolean; blocklist: Blocklist }>({
        type: "DELETE_BLOCKLIST_ENTRY",
        payload: { index }
      })

      if (response?.success && response?.blocklist) {
        setBlocklist(response.blocklist)
      }
    } catch (err) {
      console.error("[FocusPanel] Failed to delete entry:", err)
    }
  }

  const exportBlocklist = async () => {
    try {
      const response = await sendMessage<{ blocklist: Blocklist }>({
        type: "EXPORT_BLOCKLIST"
      })

      if (response?.blocklist) {
        const dataStr = JSON.stringify(response.blocklist, null, 2)
        const blob = new Blob([dataStr], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `aegis-blocklist-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error("[FocusPanel] Failed to export blocklist:", err)
    }
  }

  const importBlocklist = async (file: File) => {
    try {
      const text = await file.text()
      const importedBlocklist = JSON.parse(text) as Blocklist

      const response = await sendMessage<{ success: boolean; blocklist: Blocklist }>({
        type: "IMPORT_BLOCKLIST",
        payload: { blocklist: importedBlocklist, mergeStrategy: "skip" }
      })

      if (response?.success && response?.blocklist) {
        setBlocklist(response.blocklist)
      }
    } catch (err) {
      console.error("[FocusPanel] Failed to import blocklist:", err)
    }
  }

  const handleFileImport = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        importBlocklist(file)
      }
    }
    input.click()
  }

  const getCategoryEntries = (category: BlocklistCategory) => {
    if (!blocklist) return []
    return blocklist.entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.category === category)
  }

  const isCategoryEnabled = (category: BlocklistCategory) => {
    return focusState.enabledCategories.includes(category)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-xs" style={{ color: '#9A9FA6', fontFamily: "'Breeze Sans'" }}>
          Loading focus mode...
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "'Breeze Sans'" }}>
      {/* Header with Focus Mode Toggle */}
      <div className="p-4 border-b" style={{ borderColor: '#E5E7EB' }}>
        {/* <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold" style={{ color: '#1F2937' }}>
            Focus Mode
          </h2>
          <div className="flex gap-2">
            <button
              onClick={exportBlocklist}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Export blocklist"
            >
              <Download className="h-4 w-4" style={{ color: '#6B7280' }} />
            </button>
            <button
              onClick={handleFileImport}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Import blocklist"
            >
              <Upload className="h-4 w-4" style={{ color: '#6B7280' }} />
            </button>
          </div>
        </div> */}

        {/* Large Focus Mode Toggle Button */}
        <button
          onClick={toggleFocusMode}
          className="w-full p-4 rounded-xl transition-all flex items-center justify-between"
          style={{
            backgroundColor: focusState.isActive ? '#0072de' : '#F3F4F6',
            color: focusState.isActive ? '#FFFFFF' : '#6B7280'
          }}
        >
          <div className="flex items-center gap-3">
            {focusState.isActive ? (
              <Power className="h-6 w-6" />
            ) : (
              <PowerOff className="h-6 w-6" />
            )}
            <div className="text-left">
              <div className="font-semibold text-base">
                {focusState.isActive ? "Focus Mode Active" : "Focus Mode Inactive"}
              </div>
              <div className="text-xs opacity-80">
                {focusState.isActive 
                  ? `Blocking ${focusState.enabledCategories.length} categories`
                  : "Click to activate website blocking"
                }
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Categories List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-2">
          {Object.values(CATEGORY_INFO).map((categoryInfo) => {
            const entries = getCategoryEntries(categoryInfo.id)
            const isExpanded = expandedCategories.has(categoryInfo.id)
            const isEnabled = isCategoryEnabled(categoryInfo.id)
            const isCategoryBlocklistEnabled = blocklist?.categoryStates[categoryInfo.id] ?? false

            return (
              <div
                key={categoryInfo.id}
                className="border rounded-lg overflow-hidden"
                style={{ borderColor: '#E5E7EB' }}
              >
                {/* Category Header */}
                <div className="flex items-center justify-between p-3 bg-gray-50">
                  <button
                    onClick={() => toggleCategoryExpanded(categoryInfo.id)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    <span className="text-xl">{categoryInfo.emoji}</span>
                    <div className="flex-1">
                      <div className="font-medium text-sm" style={{ color: '#1F2937' }}>
                        {categoryInfo.name}
                      </div>
                      <div className="text-xs" style={{ color: '#9A9FA6' }}>
                        {entries.length} {entries.length === 1 ? 'site' : 'sites'}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" style={{ color: '#6B7280' }} />
                    ) : (
                      <ChevronDown className="h-4 w-4" style={{ color: '#6B7280' }} />
                    )}
                  </button>
                  
                  {/* Category Enable/Disable Toggle */}
                  <button
                    onClick={() => toggleCategory(categoryInfo.id)}
                    className={`ml-2 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      isEnabled 
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    {isEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                {/* Category Entries (Expanded) */}
                {isExpanded && (
                  <div className="p-3 bg-white space-y-2">
                    {entries.length === 0 ? (
                      <p className="text-xs text-center py-4" style={{ color: '#9A9FA6' }}>
                        No sites in this category
                      </p>
                    ) : (
                      entries.map(({ entry, index }) => (
                        <div
                          key={index}
                          className="flex items-start justify-between p-2 rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-mono truncate" style={{ color: '#1F2937' }}>
                              {entry.pattern}
                            </div>
                            {entry.reason && (
                              <div className="text-xs truncate" style={{ color: '#9A9FA6' }}>
                                {entry.reason}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => deleteEntry(index)}
                            className="ml-2 p-1 rounded hover:bg-red-50 transition-colors"
                            title="Delete entry"
                          >
                            <Trash2 className="h-4 w-4" style={{ color: '#EF4444' }} />
                          </button>
                        </div>
                      ))
                    )}

                    {/* Add Entry Form */}
                    {addingEntry === categoryInfo.id ? (
                      <div className="p-3 border rounded-lg" style={{ borderColor: '#E5E7EB' }}>
                        <input
                          type="text"
                          placeholder="*.example.com or example.com/path/*"
                          value={newEntryForm.pattern}
                          onChange={(e) => setNewEntryForm({ ...newEntryForm, pattern: e.target.value })}
                          className="w-full px-3 py-2 text-sm border rounded-lg mb-2"
                          style={{ borderColor: '#E5E7EB' }}
                        />
                        <input
                          type="text"
                          placeholder="Reason (optional)"
                          value={newEntryForm.reason}
                          onChange={(e) => setNewEntryForm({ ...newEntryForm, reason: e.target.value })}
                          className="w-full px-3 py-2 text-sm border rounded-lg mb-2"
                          style={{ borderColor: '#E5E7EB' }}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => addEntry(categoryInfo.id)}
                            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                          >
                            <Check className="h-4 w-4 inline mr-1" />
                            Add Site
                          </button>
                          <button
                            onClick={() => {
                              setAddingEntry(null)
                              setNewEntryForm({ pattern: "", reason: "" })
                            }}
                            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-300"
                          >
                            <X className="h-4 w-4 inline" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingEntry(categoryInfo.id)}
                        className="w-full p-2 border-2 border-dashed rounded-lg text-xs font-medium transition-colors hover:bg-gray-50"
                        style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
                      >
                        <Plus className="h-4 w-4 inline mr-1" />
                        Add Site to {categoryInfo.name}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Info Footer
      <div className="p-3 border-t" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
        <p className="text-xs" style={{ color: '#6B7280' }}>
          💡 <strong>Tip:</strong> Use <code className="px-1 py-0.5 bg-gray-200 rounded">*.example.com</code> to block all subdomains
        </p>
      </div> */}
    </div>
  )
}

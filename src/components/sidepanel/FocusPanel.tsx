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
    <div className="flex flex-col h-full bg-gray-50" style={{ fontFamily: "'Breeze Sans'" }}>
      {/* Header with Focus Mode Toggle */}
      <div className="p-4 bg-white border-b" style={{ borderColor: '#E5E5E5' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: '#080A0B' }}>
            Focus Mode
          </h2>
          <div className="flex gap-2">
            <button
              onClick={exportBlocklist}
              className="p-2 rounded-lg hover:bg-blue-50 transition-all"
              title="Export blocklist"
              style={{ color: '#0072de' }}
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={handleFileImport}
              className="p-2 rounded-lg hover:bg-blue-50 transition-all"
              title="Import blocklist"
              style={{ color: '#0072de' }}
            >
              <Upload className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Large Focus Mode Toggle Button */}
        <button
          onClick={toggleFocusMode}
          className="w-full p-5 rounded-xl transition-all flex items-center justify-between shadow-sm hover:shadow-md"
          style={{
            backgroundColor: focusState.isActive ? '#0072de' : '#FFFFFF',
            color: focusState.isActive ? '#FFFFFF' : '#080A0B',
            border: focusState.isActive ? 'none' : '2px solid #E5E5E5'
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="p-3 rounded-lg"
              style={{
                backgroundColor: focusState.isActive ? 'rgba(255,255,255,0.2)' : '#F3F4F6'
              }}
            >
              {focusState.isActive ? (
                <Power className="h-6 w-6" />
              ) : (
                <PowerOff className="h-6 w-6" style={{ color: '#9A9FA6' }} />
              )}
            </div>
            <div className="text-left">
              <div className="font-semibold text-base">
                {focusState.isActive ? "Focus Mode Active" : "Focus Mode Inactive"}
              </div>
              <div className="text-xs mt-0.5" style={{ 
                color: focusState.isActive ? 'rgba(255,255,255,0.8)' : '#9A9FA6'
              }}>
                {focusState.isActive 
                  ? `${focusState.enabledCategories.length} ${focusState.enabledCategories.length === 1 ? 'category' : 'categories'} blocking sites`
                  : "Activate to block distracting websites"
                }
              </div>
            </div>
          </div>
          <div
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: focusState.isActive ? 'rgba(255,255,255,0.2)' : '#F3F4F6',
              color: focusState.isActive ? '#FFFFFF' : '#080A0B'
            }}
          >
            {focusState.isActive ? 'ON' : 'OFF'}
          </div>
        </button>
      </div>

      {/* Categories List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">
          {Object.values(CATEGORY_INFO).map((categoryInfo) => {
            const entries = getCategoryEntries(categoryInfo.id)
            const isExpanded = expandedCategories.has(categoryInfo.id)
            const isEnabled = isCategoryEnabled(categoryInfo.id)
            const isCategoryBlocklistEnabled = blocklist?.categoryStates[categoryInfo.id] ?? false

            return (
              <div
                key={categoryInfo.id}
                className="bg-white rounded-xl shadow-sm overflow-hidden border hover:shadow-md transition-shadow"
                style={{ borderColor: '#E5E5E5' }}
              >
                {/* Category Header */}
                <div className="flex items-center justify-between p-4">
                  <button
                    onClick={() => toggleCategoryExpanded(categoryInfo.id)}
                    className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity"
                  >
                    <div
                      className="w-10 h-10 flex items-center justify-center rounded-lg text-xl"
                      style={{ backgroundColor: '#F3F4F6' }}
                    >
                      {categoryInfo.emoji}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm" style={{ color: '#080A0B' }}>
                        {categoryInfo.name}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: '#9A9FA6' }}>
                        {entries.length} {entries.length === 1 ? 'site' : 'sites'}
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      style={{ color: '#9A9FA6' }}
                    />
                  </button>
                  
                  {/* Category Enable/Disable Toggle */}
                  <button
                    onClick={() => toggleCategory(categoryInfo.id)}
                    className={`ml-3 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                      isEnabled 
                        ? 'shadow-sm' 
                        : ''
                    }`}
                    style={{
                      backgroundColor: isEnabled ? '#0072de' : '#F3F4F6',
                      color: isEnabled ? '#FFFFFF' : '#080A0B'
                    }}
                  >
                    {isEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Category Entries (Expanded) */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-2 border-t" style={{ borderColor: '#F3F4F6' }}>
                    <div className="pt-3 space-y-2">
                      {entries.length === 0 ? (
                        <p className="text-xs text-center py-6" style={{ color: '#9A9FA6' }}>
                          No sites blocked yet
                        </p>
                      ) : (
                        entries.map(({ entry, index }) => (
                          <div
                            key={index}
                            className="flex items-start justify-between p-3 rounded-lg border hover:border-blue-200 transition-all"
                            style={{ borderColor: '#E5E5E5', backgroundColor: '#FAFAFA' }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-mono truncate font-medium" style={{ color: '#080A0B' }}>
                                {entry.pattern}
                              </div>
                              {entry.reason && (
                                <div className="text-xs truncate mt-1" style={{ color: '#9A9FA6' }}>
                                  {entry.reason}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => deleteEntry(index)}
                              className="ml-3 p-2 rounded-lg hover:bg-red-50 transition-colors"
                              title="Delete entry"
                            >
                              <Trash2 className="h-4 w-4" style={{ color: '#EF4444' }} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Entry Form */}
                    {addingEntry === categoryInfo.id ? (
                      <div className="p-4 border rounded-xl" style={{ borderColor: '#E5E5E5', backgroundColor: '#FAFAFA' }}>
                        <input
                          type="text"
                          placeholder="*.example.com or example.com/path/*"
                          value={newEntryForm.pattern}
                          onChange={(e) => setNewEntryForm({ ...newEntryForm, pattern: e.target.value })}
                          className="w-full px-4 py-3 text-sm border rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          style={{ borderColor: '#E5E5E5', fontFamily: "'Breeze Sans'" }}
                        />
                        <input
                          type="text"
                          placeholder="Reason (optional)"
                          value={newEntryForm.reason}
                          onChange={(e) => setNewEntryForm({ ...newEntryForm, reason: e.target.value })}
                          className="w-full px-4 py-3 text-sm border rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          style={{ borderColor: '#E5E5E5', fontFamily: "'Breeze Sans'" }}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => addEntry(categoryInfo.id)}
                            className="flex-1 px-4 py-3 rounded-lg text-sm font-semibold transition-all shadow-sm hover:shadow"
                            style={{ backgroundColor: '#0072de', color: '#FFFFFF' }}
                          >
                            <Check className="h-4 w-4 inline mr-2" />
                            Add Site
                          </button>
                          <button
                            onClick={() => {
                              setAddingEntry(null)
                              setNewEntryForm({ pattern: "", reason: "" })
                            }}
                            className="px-4 py-3 rounded-lg text-sm font-semibold transition-all"
                            style={{ backgroundColor: '#F3F4F6', color: '#080A0B' }}
                          >
                            <X className="h-4 w-4 inline" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingEntry(categoryInfo.id)}
                        className="w-full p-3 border-2 border-dashed rounded-lg text-sm font-medium transition-all hover:border-blue-300 hover:bg-blue-50"
                        style={{ borderColor: '#E5E5E5', color: '#0072de' }}
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

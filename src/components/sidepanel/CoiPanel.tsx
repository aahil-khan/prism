import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { EphemeralBehaviorState } from "~/types/ephemeral-behavior"
import type { Session } from "~/types/session"
import {
  type CoiWeights,
  computePageCoi,
  computeSessionCoi,
  getDefaultWeights,
  loadCoiWeights,
  saveCoiWeights,
  normalizeWeights,
} from "~/lib/coi"

interface CoiPanelProps {
  sessions: Session[]
}

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

export function CoiPanel({ sessions }: CoiPanelProps) {
  const [weights, setWeights] = useState<CoiWeights>(getDefaultWeights())
  const [behavior, setBehavior] = useState<EphemeralBehaviorState | undefined>(undefined)
  const [liveScores, setLiveScores] = useState<{ page?: number; session?: number } | null>(null)

  useEffect(() => {
    loadCoiWeights().then(setWeights).catch((err) => {
      console.warn("Failed to load COI weights, using defaults", err)
    })
  }, [])

  useEffect(() => {
    sendMessage<{ state?: EphemeralBehaviorState }>({ type: "GET_BEHAVIOR_STATE" })
      .then((res) => setBehavior(res?.state))
      .catch((err) => console.warn("Failed to get behavior state", err))
  }, [])

  // Persist weights whenever they change
  useEffect(() => {
    saveCoiWeights(weights)
  }, [weights])

  const latestSession = useMemo(() => {
    if (!sessions.length) return undefined
    return sessions[sessions.length - 1]
  }, [sessions])

  const latestPageIndex = useMemo(() => {
    if (!latestSession || !latestSession.pages.length) return -1
    return latestSession.pages.length - 1
  }, [latestSession])

  const sessionResult = useMemo(() => {
    if (!latestSession) return null
    return computeSessionCoi(latestSession, behavior, weights)
  }, [latestSession, behavior, weights])

  const pageResult = useMemo(() => {
    if (!latestSession || latestPageIndex < 0) return null
    return computePageCoi(latestSession, latestPageIndex, behavior, weights)
  }, [latestSession, latestPageIndex, behavior, weights])

  const handleReset = () => {
    const defaults = getDefaultWeights()
    setWeights(defaults)
  }

  const updateWeight = (scope: "page" | "session", key: string, value: number) => {
    setWeights((prev) => {
      const next = {
        ...prev,
        [scope]: {
          ...prev[scope],
          [key]: value,
        },
      }
      return normalizeWeights(next)
    })
  }

  const formatScore = (val: number | undefined | null) =>
    val === undefined || val === null ? "—" : val.toFixed(2)

  const renderWeights = (scope: "page" | "session") => {
    const entries = Object.entries(weights[scope])
    return (
      <div className="flex flex-col gap-4">
        {entries.map(([key, value]) => (
          <label key={`${scope}-${key}`} className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm font-medium text-slate-700">
              <span>{key}</span>
              <span>{value.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={value}
              onChange={(e) => updateWeight(scope, key, parseFloat(e.target.value))}
              className="w-full accent-blue-600"
            />
          </label>
        ))}
      </div>
    )
  }

  return (
    <div className="w-full rounded-lg border bg-white p-3 shadow-sm" style={{ borderColor: "#E5E5E5" }}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Cognitive Overload Index</p>
          <div className="flex items-center gap-3 mt-1">
            <div className="text-sm text-slate-700">Page</div>
            <div className="text-lg font-semibold" style={{ color: "#0072de" }}>
              {formatScore(liveScores?.page ?? pageResult?.score)}
            </div>
            <div className="text-sm text-slate-700">Session</div>
            <div className="text-lg font-semibold" style={{ color: "#0072de" }}>
              {formatScore(liveScores?.session ?? sessionResult?.score)}
            </div>
          </div>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#0072de] text-white hover:bg-[#0066c6]">COI Settings</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Edit COI weights</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-sm font-semibold mb-2">Page weights</p>
                {renderWeights("page")}
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Session weights</p>
                {renderWeights("session")}
              </div>
              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={handleReset}>Reset to default</Button>
                <div className="text-xs text-slate-500">Values persist in settings</div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {/* Live updates listener */}
      <LiveCoiListener setBehavior={setBehavior} setWeights={setWeights} setScores={setLiveScores} />
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <span>Last page: {latestSession?.pages[latestPageIndex]?.title ?? "—"}</span>
        <span>Session pages: {latestSession?.pages.length ?? 0}</span>
      </div>
    </div>
  )
}

// Component to listen for COI_UPDATE and storage changes
function LiveCoiListener({ setBehavior, setWeights, setScores }: { setBehavior: (b: EphemeralBehaviorState | undefined) => void; setWeights: (w: CoiWeights) => void; setScores: (s: { page?: number; session?: number } | null) => void }) {
  useEffect(() => {
    const onMessage = (message: any) => {
      if (message?.type === "COI_UPDATE" && message?.payload) {
        const pageScore = message.payload.page?.score as number | undefined
        const sessionScore = message.payload.session?.score as number | undefined
        setScores({ page: pageScore, session: sessionScore })
      }
      if (message?.type === "GET_BEHAVIOR_STATE_RESPONSE" && message.state) {
        setBehavior(message.state as EphemeralBehaviorState)
      }
    }
    chrome.runtime.onMessage.addListener(onMessage)

    const onStorageChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes["coi-weights"]) {
        const newVal = changes["coi-weights"].newValue as CoiWeights
        if (newVal) setWeights(normalizeWeights(newVal))
      }
    }
    chrome.storage.onChanged.addListener(onStorageChange)

    // Poll behavior state every 5s as fallback
    const timer = setInterval(() => {
      chrome.runtime.sendMessage({ type: "GET_BEHAVIOR_STATE" }, (res) => {
        if (!chrome.runtime.lastError && res?.state) {
          setBehavior(res.state as EphemeralBehaviorState)
        }
      })
    }, 5000)

    return () => {
      chrome.runtime.onMessage.removeListener(onMessage)
      chrome.storage.onChanged.removeListener(onStorageChange)
      clearInterval(timer)
    }
  }, [setBehavior, setWeights])
  return null
}

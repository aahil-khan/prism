import type { EphemeralBehaviorState } from "~/types/ephemeral-behavior"
import type { Session } from "~/types/session"
import type { DerivedPageMetrics, DerivedSessionMetrics } from "~/derived/types"
import { derivePageMetrics, deriveSessionMetrics } from "~/derived"

export type CoiWeights = {
  page: {
    tabSwitch: number
    idleTransitions: number
    scrollBurst: number
    shallowDepth: number
    dwell: number
    position: number
    revisit: number
  }
  session: {
    tabSwitch: number
    idleTransitions: number
    scrollBurst: number
    shallowDepth: number
    dwellVariance: number
    domainChurn: number
    revisit: number
    duration: number
    foregroundDrop: number
  }
}

export type CoiFeatureVector = Record<string, number>

export type CoiResult = {
  score: number
  features: CoiFeatureVector
}

const STORAGE_KEY = "coi-weights"
const DEFAULT_MAX_DWELL_MS = 10 * 60 * 1000 // 10 minutes

export function getDefaultWeights(): CoiWeights {
  return {
    page: {
      tabSwitch: 0.2,
      idleTransitions: 0.2,
      scrollBurst: 0.15,
      shallowDepth: 0.15,
      dwell: 0.2,
      position: 0.05,
      revisit: 0.05,
    },
    session: {
      tabSwitch: 0.2,
      idleTransitions: 0.2,
      scrollBurst: 0.1,
      shallowDepth: 0.1,
      dwellVariance: 0.15,
      domainChurn: 0.1,
      revisit: 0.05,
      duration: 0.05,
      foregroundDrop: 0.05,
    },
  }
}

export async function loadCoiWeights(): Promise<CoiWeights> {
  const defaults = getDefaultWeights()
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY)
    if (result && result[STORAGE_KEY]) {
      const merged = mergeWeights(defaults, result[STORAGE_KEY] as CoiWeights)
      return normalizeWeights(merged)
    }
  } catch (err) {
    console.warn("Failed to load COI weights, using defaults", err)
  }
  return normalizeWeights(defaults)
}

export async function saveCoiWeights(weights: CoiWeights): Promise<void> {
  try {
    const normalized = normalizeWeights(weights)
    await chrome.storage.local.set({ [STORAGE_KEY]: normalized })
  } catch (err) {
    console.warn("Failed to save COI weights", err)
  }
}

function mergeWeights(base: CoiWeights, incoming: Partial<CoiWeights>): CoiWeights {
  return {
    page: { ...base.page, ...(incoming.page ?? {}) },
    session: { ...base.session, ...(incoming.session ?? {}) },
  }
}

function clamp01(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function normalizeScope<T extends Record<string, number>>(scope: T): T {
  const keys = Object.keys(scope)
  const sum = keys.reduce((s, k) => s + Math.max(0, scope[k]), 0)
  if (sum <= 0) {
    // If everything is zero, distribute uniformly
    const uniform = 1 / Math.max(keys.length, 1)
    const out: any = {}
    keys.forEach((k) => (out[k] = uniform))
    return out as T
  }
  const out: any = {}
  keys.forEach((k) => {
    const v = Math.max(0, scope[k])
    out[k] = v / sum
  })
  return out as T
}

export function normalizeWeights(w: CoiWeights): CoiWeights {
  return {
    page: normalizeScope(w.page),
    session: normalizeScope(w.session),
  }
}

function depthScore(bucket: EphemeralBehaviorState["scroll"]["maxDepthBucket"] | undefined): number {
  if (bucket === "top") return 1
  if (bucket === "middle") return 0.5
  if (bucket === "bottom") return 0
  return 0
}

function coefOfVariation(values: number[]): number {
  if (!values.length) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  if (mean === 0) return 0
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length
  const std = Math.sqrt(variance)
  return std / mean
}

export function computeSessionCoi(
  session: Session,
  behavior: EphemeralBehaviorState | undefined,
  weights: CoiWeights
): CoiResult {
  // Ensure weights sum to 1 per scope
  weights = normalizeWeights(weights)
  const derived: DerivedSessionMetrics = deriveSessionMetrics(session)
  const durationMs = Math.max(derived.sessionDurationMs, 1)
  const durationHours = durationMs / 3_600_000
  const pageCount = Math.max(derived.pageCount, 1)

  const tabSwitchCount = behavior?.tabSwitchCount ?? 0
  const idleTransitions = behavior?.idleTransitions ?? 0
  const scrollBurst = behavior?.scroll?.burstCount ?? 0
  const shallowDepth = depthScore(behavior?.scroll?.maxDepthBucket)

  // Dwell variance using page-level metrics
  const pageMetrics = derivePageMetrics(session)
  const dwellValues = pageMetrics
    .map((p) => p.dwellTimeMs)
    .filter((v): v is number => typeof v === "number")
  const dwellCV = coefOfVariation(dwellValues)

  const domainChurn = clamp01(derived.uniqueDomainCount / pageCount)
  const revisit = clamp01(pageMetrics.some((p) => p.revisitCount > 0) ? 1 : 0)
  const foregroundDrop = clamp01(
    derived.foregroundRatio !== undefined ? 1 - derived.foregroundRatio : 0
  )

  const features: CoiFeatureVector = {
    tabSwitch: clamp01(tabSwitchCount / Math.max(durationHours, 0.1)),
    idleTransitions: clamp01(idleTransitions / Math.max(durationHours, 0.1)),
    scrollBurst: clamp01(scrollBurst / pageCount),
    shallowDepth,
    dwellVariance: clamp01(Math.min(dwellCV, 2) / 2),
    domainChurn,
    revisit,
    duration: clamp01(durationHours / 4),
    foregroundDrop,
  }

  const score = Object.entries(weights.session).reduce((sum, [key, weight]) => {
    const feature = features[key] ?? 0
    return sum + weight * feature
  }, 0)

  return { score, features }
}

export function computePageCoi(
  session: Session,
  pageIndex: number,
  behavior: EphemeralBehaviorState | undefined,
  weights: CoiWeights
): CoiResult {
  // Ensure weights sum to 1 per scope
  weights = normalizeWeights(weights)
  const pageMetrics = derivePageMetrics(session)
  const derivedSession = deriveSessionMetrics(session)
  const page = pageMetrics[pageIndex]

  if (!page) {
    return { score: 0, features: {} }
  }

  const durationHours = Math.max((derivedSession.sessionDurationMs || 1) / 3_600_000, 0.1)
  const pageCount = Math.max(derivedSession.pageCount, 1)
  const tabSwitchCount = behavior?.tabSwitchCount ?? 0
  const idleTransitions = behavior?.idleTransitions ?? 0
  const scrollBurst = behavior?.scroll?.burstCount ?? 0
  const shallowDepth = depthScore(behavior?.scroll?.maxDepthBucket)

  const dwellNorm = clamp01((page.dwellTimeMs ?? DEFAULT_MAX_DWELL_MS) / DEFAULT_MAX_DWELL_MS)
  const revisit = clamp01(page.revisitCount > 0 ? 1 : 0)
  const position = clamp01(page.positionInSession)

  const features: CoiFeatureVector = {
    tabSwitch: clamp01(tabSwitchCount / Math.max(durationHours, 0.1)),
    idleTransitions: clamp01(idleTransitions / Math.max(durationHours, 0.1)),
    scrollBurst: clamp01(scrollBurst / pageCount),
    shallowDepth,
    dwell: dwellNorm,
    position,
    revisit,
  }

  const score = Object.entries(weights.page).reduce((sum, [key, weight]) => {
    const feature = features[key] ?? 0
    return sum + weight * feature
  }, 0)

  return { score, features }
}

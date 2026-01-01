import type { Session } from "~/types/session"
import type { Project } from "~/types/project"
import {
  aggregateResourcesAcrossSessions,
  filterMeaningfulResources,
  isRoutineResource,
  type ResourceIdentifier
} from "~/lib/resource-extractor"

// Detection thresholds
const THRESHOLDS = {
  MIN_SESSIONS: 2, // At least 2 sessions
  MIN_RESOURCES: 2, // At least 2 specific resources
  MIN_RESOURCE_VISITS: 2, // Each resource visited 2+ times
  MIN_SCORE: 50, // Minimum confidence score (out of 100)
  MIN_DURATION_HOURS: 2, // At least 2 hours between first and last session
  MAX_DURATION_DAYS: 30, // Don't cluster sessions > 30 days apart
  ACTIVE_THRESHOLD_DAYS: 7, // No activity for 7 days = stale
  COMPLETED_THRESHOLD_DAYS: 30 // No activity for 30 days = completed
}

const STORAGE_KEY = "aegis-projects"

/**
 * Project candidate during detection phase
 */
type ProjectCandidate = {
  resources: ResourceIdentifier[]
  sessions: Session[]
  score: number
  startDate: number
  endDate: number
  keywords: string[]
  topDomains: string[]
  dominantLabel?: string
}

/**
 * Generate a unique project ID
 */
function generateProjectId(): string {
  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Extract keywords from page titles in sessions
 */
function extractKeywords(sessions: Session[]): string[] {
  const wordCounts = new Map<string, number>()

  sessions.forEach(session => {
    session.pages.forEach(page => {
      if (!page.title) return

      // Extract words (lowercase, filter common words)
      const words = page.title
        .toLowerCase()
        .split(/[\s\-_.,;:!?()[\]{}'"]+/)
        .filter(w => w.length > 3) // Skip short words
        .filter(w => !isCommonWord(w)) // Skip common words

      words.forEach(word => {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
      })
    })
  })

  // Return top 10 keywords by frequency
  return Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word)
}

/**
 * Check if a word is too common to be meaningful
 */
function isCommonWord(word: string): boolean {
  const common = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'been',
    'will', 'your', 'their', 'what', 'which', 'when', 'where', 'how',
    'page', 'site', 'home', 'web', 'http', 'https', 'www', 'html'
  ])
  return common.has(word)
}

/**
 * Get top domains from resources
 */
function getTopDomains(resources: ResourceIdentifier[], limit: number = 5): string[] {
  const domainCounts = new Map<string, number>()

  resources.forEach(resource => {
    domainCounts.set(resource.domain, (domainCounts.get(resource.domain) || 0) + resource.visitCount)
  })

  return Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([domain]) => domain)
}

/**
 * Cluster sessions into potential projects based on resource overlap and temporal proximity
 */
function clusterSessions(sessions: Session[]): ProjectCandidate[] {
  // Get all meaningful resources across sessions
  const allResources = aggregateResourcesAcrossSessions(sessions)
  const meaningfulResources = filterMeaningfulResources(
    allResources,
    THRESHOLDS.MIN_RESOURCE_VISITS,
    THRESHOLDS.MIN_SESSIONS
  ).filter(r => !isRoutineResource(r))

  const candidates: ProjectCandidate[] = []
  const assignedSessions = new Set<string>()

  // Group resources by temporal proximity and session overlap
  meaningfulResources.forEach(resource => {
    // Get sessions for this resource
    const resourceSessions = sessions.filter(s => resource.sessionIds.has(s.id))

    // Skip if already assigned to another candidate
    const unassignedSessions = resourceSessions.filter(s => !assignedSessions.has(s.id))
    if (unassignedSessions.length < THRESHOLDS.MIN_SESSIONS) return

    // Find overlapping candidate
    let targetCandidate = candidates.find(c => {
      // Check session overlap
      const sessionOverlap = c.sessions.some(s => resource.sessionIds.has(s.id))
      if (sessionOverlap) return true

      // Check temporal overlap (within max duration)
      const timeDiff = Math.abs(c.endDate - resource.lastVisit)
      const daysApart = timeDiff / (24 * 60 * 60 * 1000)
      return daysApart <= THRESHOLDS.MAX_DURATION_DAYS
    })

    if (targetCandidate) {
      // Add to existing candidate
      targetCandidate.resources.push(resource)
      unassignedSessions.forEach(s => {
        if (!targetCandidate!.sessions.find(cs => cs.id === s.id)) {
          targetCandidate!.sessions.push(s)
          assignedSessions.add(s.id)
        }
      })
      targetCandidate.startDate = Math.min(targetCandidate.startDate, resource.firstVisit)
      targetCandidate.endDate = Math.max(targetCandidate.endDate, resource.lastVisit)
    } else {
      // Create new candidate
      const newCandidate: ProjectCandidate = {
        resources: [resource],
        sessions: unassignedSessions,
        score: 0,
        startDate: resource.firstVisit,
        endDate: resource.lastVisit,
        keywords: [],
        topDomains: [],
        dominantLabel: undefined
      }
      candidates.push(newCandidate)
      unassignedSessions.forEach(s => assignedSessions.add(s.id))
    }
  })

  return candidates
}

/**
 * Score a project candidate (0-100)
 */
function scoreCandidate(candidate: ProjectCandidate): number {
  let score = 0

  // 1. Resource specificity (40 points max)
  const specificResources = candidate.resources.filter(
    r => (r.specificity === 'specific' || r.specificity === 'deep') && r.visitCount >= 3
  )
  score += Math.min(specificResources.length * 8, 40)

  // 2. Temporal consistency (30 points max)
  const durationMs = candidate.endDate - candidate.startDate
  const durationDays = durationMs / (24 * 60 * 60 * 1000)
  const durationHours = durationMs / (60 * 60 * 1000)

  if (durationHours < THRESHOLDS.MIN_DURATION_HOURS) {
    score += 5 // Too short, very weak signal
  } else if (durationDays >= 2 && durationDays <= 14) {
    score += 30 // Sweet spot: multi-day focused work
  } else if (durationDays > 14 && durationDays <= 30) {
    score += 20 // Longer projects
  } else {
    score += 10 // Either very short or very long
  }

  // 3. Session consistency (20 points max)
  if (candidate.sessions.length >= 5) {
    score += 20
  } else if (candidate.sessions.length >= 3) {
    score += 15
  } else if (candidate.sessions.length === 2) {
    score += 10
  }

  // 4. Label consistency (10 points max)
  const labels = candidate.sessions.map(s => s.labelId).filter(Boolean)
  const uniqueLabels = new Set(labels)
  if (uniqueLabels.size === 1 && labels.length >= 2) {
    score += 10 // All sessions have same label
    candidate.dominantLabel = labels[0]
  } else if (labels.length > 0) {
    score += 5 // Some labeling consistency
  }

  return Math.min(score, 100)
}

/**
 * Generate project name from resources and keywords
 */
function generateProjectName(candidate: ProjectCandidate): string {
  // Try to use top keyword if meaningful
  if (candidate.keywords.length > 0) {
    const topKeyword = candidate.keywords[0]
    return topKeyword.charAt(0).toUpperCase() + topKeyword.slice(1)
  }

  // Fall back to domain
  if (candidate.topDomains.length > 0) {
    const domain = candidate.topDomains[0].replace(/\.(com|org|net|dev|io)$/, '')
    return domain.charAt(0).toUpperCase() + domain.slice(1) + " Project"
  }

  return "Research Project"
}

/**
 * Determine project status based on last activity
 */
function determineStatus(endDate: number): 'active' | 'stale' | 'completed' {
  const now = Date.now()
  const daysSinceActivity = (now - endDate) / (24 * 60 * 60 * 1000)

  if (daysSinceActivity <= THRESHOLDS.ACTIVE_THRESHOLD_DAYS) {
    return 'active'
  } else if (daysSinceActivity <= THRESHOLDS.COMPLETED_THRESHOLD_DAYS) {
    return 'stale'
  } else {
    return 'completed'
  }
}

/**
 * Detect projects from sessions
 */
export function detectProjects(sessions: Session[]): Project[] {
  if (sessions.length < THRESHOLDS.MIN_SESSIONS) {
    return []
  }

  // Cluster sessions into candidates
  const candidates = clusterSessions(sessions)

  // Score and filter candidates
  const projects: Project[] = []

  candidates.forEach(candidate => {
    // Extract metadata
    candidate.keywords = extractKeywords(candidate.sessions)
    candidate.topDomains = getTopDomains(candidate.resources)

    // Score the candidate
    candidate.score = scoreCandidate(candidate)

    // Check if meets minimum thresholds
    if (candidate.score < THRESHOLDS.MIN_SCORE) return
    if (candidate.sessions.length < THRESHOLDS.MIN_SESSIONS) return
    if (candidate.resources.length < THRESHOLDS.MIN_RESOURCES) return

    // Create project
    const project: Project = {
      id: generateProjectId(),
      name: generateProjectName(candidate),
      startDate: candidate.startDate,
      endDate: candidate.endDate,
      sessionIds: candidate.sessions.map(s => s.id),
      keywords: candidate.keywords,
      topDomains: candidate.topDomains,
      status: determineStatus(candidate.endDate),
      createdAt: Date.now(),
      autoDetected: true,
      score: candidate.score
    }

    projects.push(project)
  })

  return projects
}

/**
 * Load projects from storage
 */
export async function loadProjects(): Promise<Project[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const projects = result[STORAGE_KEY]
      if (projects && Array.isArray(projects)) {
        resolve(projects)
      } else {
        resolve([])
      }
    })
  })
}

/**
 * Save projects to storage
 */
export async function saveProjects(projects: Project[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: projects }, () => {
      const err = chrome.runtime.lastError
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

/**
 * Add a new project
 */
export async function addProject(project: Omit<Project, 'id' | 'createdAt'>): Promise<Project> {
  const projects = await loadProjects()
  const newProject: Project = {
    ...project,
    id: generateProjectId(),
    createdAt: Date.now()
  }
  projects.push(newProject)
  await saveProjects(projects)
  return newProject
}

/**
 * Update an existing project
 */
export async function updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
  const projects = await loadProjects()
  const index = projects.findIndex(p => p.id === projectId)
  if (index !== -1) {
    projects[index] = { ...projects[index], ...updates }
    await saveProjects(projects)
  }
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string): Promise<void> {
  const projects = await loadProjects()
  const filtered = projects.filter(p => p.id !== projectId)
  await saveProjects(filtered)
}

/**
 * Get project by ID
 */
export async function getProjectById(projectId: string): Promise<Project | null> {
  const projects = await loadProjects()
  return projects.find(p => p.id === projectId) || null
}

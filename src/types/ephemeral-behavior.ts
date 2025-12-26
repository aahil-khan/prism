export type ScrollDepthBucket = "top" | "middle" | "bottom"

export type EphemeralBehaviorState = {
  sessionId: string
  tabSwitchCount: number
  idleTransitions: number
  scroll: {
    maxDepthBucket: ScrollDepthBucket
    burstCount: number
  }
}

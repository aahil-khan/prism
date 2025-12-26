import {
  setupPageVisitListener,
} from "./page-event-listeners"
import {
  setupSidepanelClosedListener,
  setupOpenSidepanelListener
} from "./sidepanel-listeners"
import { setupConsentListener } from "./consent-listener"

// Initialize all listeners
setupPageVisitListener()
setupConsentListener()
setupSidepanelClosedListener()
setupOpenSidepanelListener()

export {}

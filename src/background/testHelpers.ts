/**
 * Dev-only helpers for testing project detection features
 * Use these in the browser console via background page
 */

import { createTestCandidate, clearAllCandidates } from "./candidateDetector"
import { addProject, loadProjects } from "./projectManager"

/**
 * SCENARIO 1: Test new project detection with score breakdown
 * Creates a candidate that will trigger on next visit
 */
export async function testNewProjectDetection() {
  console.log("🧪 TEST 1: New Project Detection")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  
  await clearAllCandidates()
  console.log("✓ Cleared existing candidates")
  
  // Create candidate for github.com/aahil-khan/prism with high score
  await createTestCandidate(
    "github.com",
    ["prism", "typescript", "extension"],
    4, // 4 visits
    65  // score
  )
  console.log("✓ Created test candidate")
  console.log("📍 Action: Visit https://github.com/aahil-khan/prism")
  console.log("✅ Expected: Purple notification with score breakdown")
  console.log("")
}

/**
 * SCENARIO 2: Test multi-project per domain
 * Creates TWO different GitHub repo candidates
 */
export async function testMultiProjectPerDomain() {
  console.log("🧪 TEST 2: Multiple Projects Per Domain")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  
  await clearAllCandidates()
  
  // Candidate 1: prism repo
  await createTestCandidate(
    "github.com",
    ["prism", "chrome", "extension"],
    4,
    65
  )
  console.log("✓ Created candidate 1: prism repo")
  
  // Candidate 2: another repo (different resource identifier)
  await createTestCandidate(
    "github.com",
    ["react", "dashboard", "admin"],
    4,
    65
  )
  console.log("✓ Created candidate 2: react-dashboard repo")
  
  console.log("📍 Actions:")
  console.log("  1. Visit https://github.com/aahil-khan/prism → Get notification 1")
  console.log("  2. Visit https://github.com/aahil-khan/react-dashboard → Get notification 2")
  console.log("✅ Expected: TWO separate project notifications")
  console.log("")
}

/**
 * SCENARIO 3: Test smart suggestions
 * Creates a project, then visit related site to trigger suggestion
 */
export async function testSmartSuggestions() {
  console.log("🧪 TEST 3: Smart Suggestions")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  
  await clearAllCandidates()
  
  // Create a project manually
  const project = await addProject({
    name: "React Dashboard Project",
    description: "Building an admin dashboard",
    startDate: Date.now() - 24 * 60 * 60 * 1000,
    endDate: Date.now(),
    sessionIds: ["test-session-1"],
    keywords: ["react", "dashboard", "admin", "typescript"],
    topDomains: ["github.com"],
    sites: [{
      url: "github.com/user/react-dashboard",
      title: "React Dashboard Repo",
      addedAt: Date.now(),
      addedBy: 'auto',
      visitCount: 10
    }],
    status: 'active',
    autoDetected: false,
    score: 100
  })
  
  console.log("✓ Created test project:", project.name)
  console.log("📍 Actions:")
  console.log("  1. Visit https://react.dev/learn (related keywords: react)")
  console.log("  2. Or visit https://tailwindcss.com/docs (related to dashboard styling)")
  console.log("✅ Expected: Green notification suggesting to add site to project")
  console.log("")
}

/**
 * SCENARIO 4: Test idempotent notifications
 * Verify same session doesn't get notified twice
 */
export async function testIdempotentNotifications() {
  console.log("🧪 TEST 4: Idempotent Notifications")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  
  await clearAllCandidates()
  
  await createTestCandidate(
    "github.com",
    ["prism", "typescript"],
    4,
    65
  )
  
  console.log("✓ Created test candidate")
  console.log("📍 Actions:")
  console.log("  1. Visit https://github.com/aahil-khan/prism → Get notification")
  console.log("  2. Dismiss notification")
  console.log("  3. Visit same URL again (same session)")
  console.log("✅ Expected: NO second notification in same session")
  console.log("  4. Wait 30 min or switch tabs (new session)")
  console.log("  5. Visit again")
  console.log("✅ Expected: NEW notification in new session")
  console.log("")
}

/**
 * SCENARIO 5: Test snooze functionality
 */
export async function testSnooze() {
  console.log("🧪 TEST 5: Snooze Functionality")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  
  await clearAllCandidates()
  
  await createTestCandidate(
    "github.com",
    ["prism", "typescript"],
    3, // Just at threshold
    60
  )
  
  console.log("✓ Created test candidate at threshold")
  console.log("📍 Actions:")
  console.log("  1. Visit https://github.com/aahil-khan/prism → Get notification")
  console.log("  2. Click 'Not Now' (snooze)")
  console.log("  3. Visit 2 more times → No notification yet")
  console.log("  4. Visit 3rd time → Notification appears again")
  console.log("✅ Expected: Snooze requires 2 more visits per snooze count")
  console.log("")
}

/**
 * SCENARIO 6: Test full workflow
 * Complete end-to-end: detection → accept → suggestion → add site
 */
export async function testFullWorkflow() {
  console.log("🧪 TEST 6: Full Workflow")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  
  await clearAllCandidates()
  const projects = await loadProjects()
  console.log(`Current projects: ${projects.length}`)
  
  await createTestCandidate(
    "github.com",
    ["prism", "chrome", "extension"],
    4,
    65
  )
  
  console.log("✓ Setup complete")
  console.log("")
  console.log("📍 FULL WORKFLOW:")
  console.log("  1. Visit https://github.com/aahil-khan/prism")
  console.log("     → Purple notification appears with score breakdown")
  console.log("  2. Click 'Track Project'")
  console.log("     → Sidepanel opens to Projects tab")
  console.log("     → New project created with 1 site")
  console.log("  3. Visit https://plasmo.com/docs (related: chrome extension)")
  console.log("     → Green notification: 'Related to prism project'")
  console.log("  4. Click 'Add to Project'")
  console.log("     → Site added to project.sites[]")
  console.log("     → Green success message")
  console.log("  5. Check sidepanel → Project now has 2 sites")
  console.log("")
}

/**
 * RUN ALL TESTS
 */
export async function runAllTests() {
  console.clear()
  console.log("%c🚀 PROJECT DETECTION TEST SUITE", "font-size: 20px; font-weight: bold; color: #4CAF50")
  console.log("%c═══════════════════════════════════════════════", "color: #888")
  console.log("")
  
  await testNewProjectDetection()
  await new Promise(r => setTimeout(r, 1000))
  
  await testMultiProjectPerDomain()
  await new Promise(r => setTimeout(r, 1000))
  
  await testSmartSuggestions()
  await new Promise(r => setTimeout(r, 1000))
  
  await testIdempotentNotifications()
  await new Promise(r => setTimeout(r, 1000))
  
  await testSnooze()
  await new Promise(r => setTimeout(r, 1000))
  
  await testFullWorkflow()
  
  console.log("%c═══════════════════════════════════════════════", "color: #888")
  console.log("%c✅ All test scenarios ready!", "font-size: 16px; color: #4CAF50; font-weight: bold")
  console.log("")
  console.log("%cTIP: Run individual tests via:", "color: #2196F3; font-weight: bold")
  console.log("  %ctestHelpers.testNewProjectDetection()", "color: #666")
  console.log("  %ctestHelpers.testMultiProjectPerDomain()", "color: #666")
  console.log("  %ctestHelpers.testSmartSuggestions()", "color: #666")
  console.log("  %ctestHelpers.testIdempotentNotifications()", "color: #666")
  console.log("  %ctestHelpers.testSnooze()", "color: #666")
  console.log("  %ctestHelpers.testFullWorkflow()", "color: #666")
}

/**
 * Interactive test runner - guides user step by step
 */
export async function interactiveTest() {
  console.clear()
  console.log("%c🎯 INTERACTIVE TEST MODE", "font-size: 20px; font-weight: bold; color: #FF9800")
  console.log("%c═══════════════════════════════════════════════", "color: #888")
  console.log("")
  console.log("%cThis will guide you through testing step-by-step.", "color: #666")
  console.log("%cAfter each step, you'll be prompted to continue.", "color: #666")
  console.log("")
  console.log("%c⏳ Starting in 3 seconds...", "color: #888")
  
  await new Promise(r => setTimeout(r, 3000))
  
  // Test 1
  console.log("")
  console.log("%c━━━ STEP 1/5: Detection ━━━", "font-weight: bold; color: #2196F3")
  await testNewProjectDetection()
  console.log("%c⏸️  Complete this test, then type: next()", "background: #FF9800; color: white; padding: 4px 8px; font-weight: bold")
  
  ;(window as any).next = async () => {
    // Test 2
    console.log("")
    console.log("%c━━━ STEP 2/5: Multi-Domain ━━━", "font-weight: bold; color: #2196F3")
    await testMultiProjectPerDomain()
    console.log("%c⏸️  Complete this test, then type: next()", "background: #FF9800; color: white; padding: 4px 8px; font-weight: bold")
    
    ;(window as any).next = async () => {
      // Test 3
      console.log("")
      console.log("%c━━━ STEP 3/5: Suggestions ━━━", "font-weight: bold; color: #2196F3")
      await testSmartSuggestions()
      console.log("%c⏸️  Complete this test, then type: next()", "background: #FF9800; color: white; padding: 4px 8px; font-weight: bold")
      
      ;(window as any).next = async () => {
        // Test 4
        console.log("")
        console.log("%c━━━ STEP 4/5: No Spam ━━━", "font-weight: bold; color: #2196F3")
        await testIdempotentNotifications()
        console.log("%c⏸️  Complete this test, then type: next()", "background: #FF9800; color: white; padding: 4px 8px; font-weight: bold")
        
        ;(window as any).next = async () => {
          // Test 5
          console.log("")
          console.log("%c━━━ STEP 5/5: Full Workflow ━━━", "font-weight: bold; color: #2196F3")
          await testFullWorkflow()
          console.log("")
          console.log("%c✅ ALL TESTS COMPLETE!", "font-size: 18px; background: #4CAF50; color: white; padding: 8px 16px; font-weight: bold")
          console.log("")
          console.log("%cVerify these work:", "font-weight: bold")
          console.log("  ✓ Purple notifications with score breakdown")
          console.log("  ✓ Green suggestions for related sites")
          console.log("  ✓ Multiple projects per domain")
          console.log("  ✓ No spam in same session")
          console.log("  ✓ Sidepanel opens correctly")
          console.log("  ✓ Sites added to projects")
          
          delete (window as any).next
        }
      }
    }
  }
}

// Export for console access
if (typeof window !== 'undefined') {
  (window as any).testHelpers = {
    testNewProjectDetection,
    testMultiProjectPerDomain,
    testSmartSuggestions,
    testIdempotentNotifications,
    testSnooze,
    testFullWorkflow,
    runAllTests,
    interactiveTest
  }
}

# Copilot Instructions for Prism Base App

## Project Overview
This is a Chrome extension built with **Plasmo** (a React-based framework for browser extensions). The extension uses Manifest V3, TypeScript, and React 18.

**Key Build Tool**: Plasmo handles all bundling and extension compilation—no manual webpack/vite configuration needed.

## Architecture Overview

The extension follows Plasmo's file-based routing convention:

- **`src/popup.tsx`**: Extension popup UI (shown when clicking the extension icon)
- **`src/background.ts`**: Service worker background script (persistent, no DOM access)
- **`src/newtab.tsx`**: New tab override page (replaces browser's default new tab)
- **`src/options.tsx`**: Settings/options page (user configuration)
- **`src/contents/plasmo.ts`**: Content script injected into web pages
- **`src/style.css`**: Shared styles for React components

## Key Patterns & Conventions

### React Components
All UI files (popup, newtab, options) export a default React component using hooks. Example pattern:
```tsx
import { useState } from "react"

function IndexPopup() {
  const [data, setData] = useState("")
  return <div>{/* JSX */}</div>
}

export default IndexPopup
```

### Content Scripts
Content scripts use `PlasmoCSConfig` to define injection rules:
```typescript
import type { PlasmoCSConfig } from "plasmo"
export const config: PlasmoCSConfig = { matches: ["https://example.com/*"] }
```
Modify `matches` array to target specific domains.

### Background Script
Service workers are stateless and cannot access the DOM. Use `console.log()` to debug—logs appear in Chrome DevTools under the extension's service worker.

## Development Workflow

| Task | Command | Notes |
|------|---------|-------|
| **Start dev** | `pnpm dev` | Hot-reloads extension in `build/chrome-mv3-dev/` |
| **Build prod** | `pnpm build` | Creates optimized bundle for distribution |
| **Package** | `pnpm package` | Prepares extension for store submission |

After running `pnpm dev`, load `build/chrome-mv3-dev/` manually in Chrome's `chrome://extensions/` with "Developer mode" enabled.

## Path Aliases
Configured in `tsconfig.json`: `~/*` maps to `src/*`
- Import as: `import Component from "~/components/Button"` instead of relative paths

## Chrome Permissions
Currently configured in `package.json` manifest:
- `host_permissions`: `https://*/*` (all HTTPS sites)
- `permissions`: `["tabs"]` (access to tabs API)

Add new permissions to `package.json` under `manifest.permissions` or `manifest.host_permissions` before adding Chrome API calls.

## Extension Reload Workflow
After code changes:
1. Plasmo dev server auto-compiles changes to `build/chrome-mv3-dev/`
2. Reload extension in Chrome DevTools (circular arrow icon)
3. For manifest changes: Fully restart dev server (`pnpm dev`)

## Common Modifications

### Adding a New UI Page
Create `src/yourpage.tsx` with default React export—Plasmo automatically routes it.

### Communicating Between Popup and Background
Use Chrome's messaging API (not yet implemented):
```typescript
// In popup.tsx
chrome.runtime.sendMessage({ action: "getData" }, (response) => { ... })

// In background.ts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "getData") sendResponse({ ... })
})
```

### Adding Storage
Use `chrome.storage.local` for persisting data across sessions (requires `"storage"` permission).

## Dependencies
- **plasmo** 0.90.5: Framework & build system
- **react** 18.2.0 & **react-dom** 18.2.0: UI
- **TypeScript** 5.3.3: Type safety
- **prettier** 3.2.4: Code formatting (with import sorting plugin)

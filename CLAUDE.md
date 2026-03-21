# CLAUDE.md — Project rules for MZ YouTube AI Summary Chrome Extension

## Project overview

Chrome Manifest V3 extension that extracts YouTube video subtitles and sends them to an AI service (ChatGPT, Claude, Gemini, Grok) for summarization. No build step, no bundler, no dependencies — plain JavaScript only.

## Architecture

### Entry points
- **background.js** — Service worker. Handles messages from YouTube button and popup (`chrome.runtime.onMessage`), context menu, subtitle extraction via `chrome.scripting.executeScript`, and prompt building.
- **popup.html / popup.js** — Toolbar popup. On YouTube video page: shows template list if 2+ templates, or auto-triggers summarization with single template. On non-YouTube page: shows error.
- **youtube-button.js** — Content script on `youtube.com`. Injects "AI Summary" button next to voice search. With 1 template sends directly; with 2+ templates shows dropdown menu. Sends `{ action: "summarize", videoId, templateId }` message to background.
- **inject.js** — Content script on AI service pages (ChatGPT, Claude, Gemini, Grok). Reads prompt from `chrome.storage.local`, inserts into input field, clicks send.
- **options.html / options.js** — Settings page. Auto-saves on every change (no save button). Manages multiple named prompt templates (add, rename, delete). Opened via right-click context menu on extension icon.

### Critical: PO Token extraction
YouTube requires a Proof of Origin token for timedtext API since 2025. The extraction works by:
1. `extractSubtitlesWithPOToken()` runs in **MAIN world** (not isolated) via `chrome.scripting.executeScript({ world: "MAIN" })`
2. Clears `performance.clearResourceTimings()`
3. Clicks CC button twice (on/off) to trigger YouTube's own subtitle fetch
4. Polls `performance.getEntriesByType("resource")` for `/api/timedtext?` entries
5. Extracts `pot` parameter from the captured URL
6. Fetches subtitles with `baseUrl + &pot={token}&c=WEB`

**Do NOT try to fetch timedtext URLs without a PO token** — YouTube returns 200 with empty body.
**Do NOT use DOMParser on YouTube** — Trusted Types policy blocks it. Use regex for XML parsing.
**Do NOT fetch timedtext from background service worker** — YouTube's session-bound tokens won't work outside page context.

### Storage keys (`chrome.storage.local`)
| Key | Type | Description |
|-----|------|-------------|
| `ytAiService` | `string` | Selected AI: `chatgpt` \| `claude` \| `gemini` \| `grok` |
| `ytPromptTemplates` | `array` | Array of `{ id, name, prompt }` objects. `id`: `"default"` or `"t_" + timestamp`. Migrated from old `ytPromptTemplate` on first run. |
| `ytTimestamps` | `boolean` | Whether to include `[MM:SS]` timestamps |
| `ytSummaryPrompt` | `string` | Built prompt ready for injection (temporary, consumed by inject.js) |
| `ytSummaryTimestamp` | `number` | `Date.now()` when prompt was stored (expires after 5 min) |

### Localization (i18n)
- `_locales/en/messages.json` — English (default)
- `_locales/cs/messages.json` — Czech
- Manifest uses `__MSG_*__` placeholders
- HTML uses `data-i18n` (textContent), `data-i18n-html` (innerHTML with `<code>` wrapping), and `data-i18n-placeholder` (placeholder attribute)
- JS uses `chrome.i18n.getMessage(key)`
- **All user-facing strings must be in both locale files.** Never hardcode UI text.

## Coding rules

- **No build tools, no npm, no bundler.** All files are plain JS/HTML/CSS loaded directly by Chrome.
- **No external libraries.** No jQuery, no React, no lodash.
- **Manifest V3 only.** No Manifest V2 APIs (no `chrome.browserAction`, no persistent background pages).
- **Service worker constraints:** `background.js` has no DOM access. No `document`, no `DOMParser`, no `window`. Use regex for any parsing.
- **MAIN world scripts** (`extractSubtitlesWithPOToken`) must be self-contained functions — they cannot reference variables or imports from background.js scope.
- **Content scripts** (`youtube-button.js`, `inject.js`) run in isolated world by default. They can use `chrome.runtime.sendMessage` and `chrome.storage` but not page JS variables.
- Settings auto-save immediately on change. Prompt textarea uses 500ms debounce.
- When bumping version in `manifest.json`, GitHub Actions automatically creates a release with ZIP.

## AI service injection (inject.js)

Each AI service has different DOM selectors for input field and send button, defined in `SERVICE_CONFIG`. When adding a new AI service:
1. Add URL to `AI_URLS` in `background.js`
2. Add URL pattern to `content_scripts.matches` in `manifest.json`
3. Add selectors to `SERVICE_CONFIG` in `inject.js`
4. Test that prompt insertion and auto-send work

## Timestamp formatting

When timestamps are enabled, subtitles are grouped in ~20-second chunks with sentence-boundary detection (`formatWithTimestamps`). The algorithm:
- Accumulates segments until elapsed time >= 20s
- Looks for last sentence end (`.` `!` `?`) in the chunk
- If found past 40% of chunk length, splits there and carries remainder to next chunk
- Format: `[MM:SS] text` or `[HH:MM:SS] text` for videos over 1 hour

## Testing checklist

- [ ] Toolbar icon click on YouTube video (1 template) → auto-triggers summarization
- [ ] Toolbar icon click on YouTube video (2+ templates) → shows popup with template list
- [ ] Toolbar icon click on non-YouTube page → shows error in popup
- [ ] YouTube page button click (1 template) → sends directly without dropdown
- [ ] YouTube page button click (2+ templates) → shows dropdown menu with template names
- [ ] Click outside dropdown → closes dropdown
- [ ] Navigation to another video → closes dropdown
- [ ] Right-click icon → "Settings" opens options page
- [ ] Options: change AI service → saved immediately
- [ ] Options: toggle timestamps → saved immediately
- [ ] Options: add/rename/delete templates → saved immediately
- [ ] Options: cannot delete last template → shows error
- [ ] Options: edit prompt textarea → saved after 500ms
- [ ] Options: reset prompt → restores localized default for selected template
- [ ] Upgrade from old version with custom prompt → migrates as 2nd template
- [ ] Video without subtitles → shows "ERR" badge
- [ ] Each AI service (ChatGPT, Claude, Gemini, Grok) → prompt inserted and sent
- [ ] Timestamps on → `[MM:SS]` format with ~20s grouping
- [ ] Czech Chrome → Czech UI strings and default prompt
- [ ] English Chrome → English UI strings and default prompt

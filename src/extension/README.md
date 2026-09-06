# FocusBuddy Blocker (Chrome extension)

Companion extension that blocks distracting sites in Chrome while a FocusBuddy
session is running, without touching `/etc/hosts` or prompting for a password.

## How it works

- The Electron app runs a tiny local HTTP server (`src/main/block-server.js`)
  on `127.0.0.1:47990` that answers `GET /status` with the current
  block state and domain list.
- This extension polls that endpoint (via `chrome.alarms`, every 30s, plus on
  browser/extension startup) and adds or clears `declarativeNetRequest` block
  rules to match.
- The app is the only thing that can turn blocking on — the extension is
  read-only against `/status`.

## Load it (unpacked, dev)

1. `chrome://extensions`
2. Enable "Developer mode" (top right)
3. "Load unpacked" → select `src/extension/`

## Known limitation

Content a site's service worker has already cached for offline use (e.g. a
YouTube feed loaded before the session started) can still render without a
new network request, so blocking has nothing to intercept. See "Known
limitations" in the root `CLAUDE.md`.

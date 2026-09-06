# FocusBuddy Blocker (Chrome extension)

Companion extension that blocks distracting sites in Chrome while a FocusBuddy
session is running, without touching `/etc/hosts` or prompting for a password.

## How it works

- The Electron app runs a tiny local HTTP server (`src/main/block-server.js`)
  on `127.0.0.1:47990` that answers `GET /status` with the current
  block state and domain list.
- This extension polls that endpoint (via `chrome.alarms`, every 30s, plus on
  browser/extension startup) and adds or clears `declarativeNetRequest` rules
  to match. Top-level page loads are redirected to a bundled `blocked.html`
  page ("this page is taking a break, wait for your Pomodoro to finish") that
  polls `/status` for the current task name. There's no countdown on this
  page anymore — its own poll and the alarm-driven sync run on different,
  drifting cadences, so a synced timer would read as broken next to the
  desktop widget's. Non-navigation requests (XHR, images, sub-frames, etc.)
  are just blocked outright.
- When a session starts, `background.js` also reloads any already-open tabs
  sitting on a soon-to-be-blocked domain (dNR only intercepts *new*
  navigations, so an already-loaded tab wouldn't otherwise notice). When a
  session ends, it remembers the pre-redirect URL for each tab it sent to
  `blocked.html` (via `chrome.webNavigation.onBeforeNavigate`, since that
  fires before the dNR redirect) and navigates those tabs straight back,
  instead of leaving the user stuck on the extension page.
- The app is the only thing that can turn blocking on — the extension is
  read-only against `/status`.
- `manifest.json` grants broad `http(s)://*/*` host permissions. This isn't
  for reading page content — Chrome's `declarativeNetRequest` `redirect`
  action (used for the top-level "taking a break" page) only fires on hosts
  the extension has permission for, and the blocklist is user-configurable
  via `config.js`/env var, so it can't be scoped to a fixed domain list.
  Block-only rules (XHR/images/sub-frames) don't need this, but redirects do.

## Load it (unpacked, dev)

1. `chrome://extensions`
2. Enable "Developer mode" (top right)
3. "Load unpacked" → select `src/extension/`

## Known limitation

Content a site's service worker has already cached for offline use (e.g. a
YouTube feed loaded before the session started) can still render without a
new network request, so blocking has nothing to intercept. See "Known
limitations" in the root `CLAUDE.md`.

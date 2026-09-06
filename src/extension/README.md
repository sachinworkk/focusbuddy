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
  polls `/status` itself and shows the live countdown/task; once the session
  ends it stops polling and shows a "session's over" message instead of
  reloading (reloading would just reload this same extension page, not the
  originally-blocked site, which would loop forever). Non-navigation requests
  (XHR, images, sub-frames, etc.) are just blocked outright.
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

# FocusBuddy — Project Spec

## What this is

A floating desktop focus-timer widget with a cute animated avatar. Fetches tasks
from TickTick, runs a standalone Pomodoro timer, optionally blocks distracting
sites during a session, and logs completed sessions back to TickTick as focus
records. Inspired by Cold Turkey (Windows-only, sorely missed on Linux) and
Tina Huang's desktop-companion-style AI setups.

Primary dev machine: Linux (Ubuntu). Must remain portable to macOS/Windows later
— isolate OS-specific code now so that port is a small diff, not a rewrite.

## Tech stack

- Electron + Node.js (chosen over Tauri specifically because the dev is
  comfortable in JS/Python and wants to avoid a Rust glue layer)
- Plain React or vanilla JS for the renderer — no heavy state library needed
- electron-builder for packaging
- electron's `safeStorage` API for storing TickTick OAuth tokens
- Distraction blocking is a companion Chrome extension (`src/extension/`)
  using `declarativeNetRequest`, not a hosts-file edit — see constraint 2 and
  build order item 5. No privilege escalation dependency needed anymore
  (`sudo-prompt` was removed 2026-09-06 along with `src/platform/hosts.js`).

## Hard constraints (do not violate these)

1. **Never attempt to remotely start or stop TickTick's own Pomodoro timer**
   (i.e. never poll/control a live, in-progress TickTick timer session). The
   in-app timer is built entirely in this app; TickTick is only used for
   (a) reading tasks, and (b) writing a _completed_ focus record after the
   fact via `POST /open/v1/focus` once this app's own countdown ends — that
   endpoint is real and documented (confirmed 2026-09-06 against
   developer.ticktick.com/docs/openapi.md; an earlier version of this file
   incorrectly claimed no such endpoint existed and blocked it — build order
   item 4 was always the intended behavior).
2. **Blocking is done by the FocusBuddy Chrome extension (`src/extension/`),
   not a hosts-file edit** (changed 2026-09-06 — the hosts-file approach
   required a sudo/UAC password prompt on every session start and couldn't
   cleanly reverse itself; declarativeNetRequest needs neither). The Electron
   app is the sole source of truth for block state: it runs a loopback-only
   HTTP status server (`src/main/block-server.js`, port from
   `config.js`'s `blocking.serverPort`) that the extension polls and mirrors
   into its dynamic rules. The extension can only read that state, never set
   it. This mechanism is inherently cross-platform (Chrome behaves the same
   on Linux/macOS/Windows), so there is no OS-specific branch left to isolate
   here — if a non-Chrome or non-extension blocking path is ever added later,
   isolate *that* platform-specific logic in its own module the way
   `src/platform/hosts.js` used to.
3. **Blocking must be reversible and scoped.** The extension may only ever
   hold `declarativeNetRequest` dynamic rules sourced from the block-server's
   current domain list — never rules a user or another extension added, and
   never anything written outside Chrome's own rule store (no hosts file, no
   other persistent OS state).
4. **No always-on background daemon for v1.** The app only acts when the user
   opens it / starts a session — no silent polling or telemetry. (The
   extension's 30s poll of the local status server only runs while Chrome
   itself is open, and only ever reads; it doesn't count as a new daemon.)

## Feature build order (do not skip ahead)

1. Floating widget shell: transparent, frameless, always-on-top window with a
   placeholder avatar, working drag, and click-to-expand into a panel window.
   Get this feeling right before any real data is wired in.
2. TickTick OAuth + task fetch: display real tasks in the panel, selectable.
3. In-app Pomodoro timer: start/pause/reset, countdown UI in panel, small
   progress indicator reflected on the floating avatar.
4. TickTick logging: on session completion, write a completed focus record
   (task, duration, start/end time) via TickTick's API. Success = small
   celebratory animation on the avatar.
5. Optional distraction blocking: toggle at session start; the app flips its
   local block-server state and the FocusBuddy Chrome extension
   (`src/extension/`) picks it up and applies/clears its
   `declarativeNetRequest` rules, per the constraints above.
6. Avatar polish: swap placeholder for real sprite/Lottie animation, add
   mood states (idle / focused / celebrating / gentle nudge for overdue tasks).

## Explicitly out of scope for v1

- Habit tracking (handled separately via TickTick's native habit check-ins,
  not this app)
- Any Hermes/agent orchestration — this app is a standalone tool for now
- Cross-device sync — local, single-machine tool
- Live2D/Rive avatar rigging — stretch goal only, not required for launch

## Known limitations

- **Even navigation-layer blocking can't defeat browser-cached PWA content.**
  Sites like YouTube ship a service worker that caches feed/subscription data
  for offline viewing — that's served straight from local cache with no
  network request, so neither a hosts-file redirect nor the
  `declarativeNetRequest` rules in `src/extension/` have anything to
  intercept. `config.js`'s `blocking.domains`, expanded via
  `src/main/blocklist.js`'s `KNOWN_ALIASES`, covers the API/CDN subdomains
  needed to stop *live* browsing (search, fresh videos, new feed data) for
  YouTube/Twitter/Reddit/Facebook/Instagram, but previously-cached content can
  still surface. The extension (added 2026-09-06, replacing hosts-file
  blocking) is the planned v2 companion mentioned in the older version of
  this note — it's done, and this cache limitation is what's left over even
  with it in place. It's also Chrome-only; other browsers get no blocking.

## Style / conventions

- Keep the codebase small and readable over clever — this is a personal tool,
  not a product with a team maintaining it.
- Comment any platform-specific branch clearly (`// WINDOWS ONLY`, etc.)
- Prefer explicit config (a `config.js`/`.env`) for things like the block-list
  domains and default Pomodoro duration, rather than hardcoding inline.

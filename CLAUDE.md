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
- `sudo-prompt` (or equivalent) for the one privilege-escalation need (hosts file edit)

## Hard constraints (do not violate these)

1. **Never attempt to remotely start or stop TickTick's own Pomodoro timer.**
   TickTick's official Open API v1 has no create/stop endpoint for focus
   sessions — this was confirmed by testing and by MCP server changelogs
   explicitly removing those commands for this reason. The in-app timer is
   built entirely in this app; TickTick is only used for (a) reading tasks,
   and (b) writing a _completed_ focus record after the fact.
2. **Isolate all OS-specific logic in one module** (hosts file path, privilege
   elevation method). Everything else must be platform-agnostic.
   - Linux/macOS hosts path: `/etc/hosts`, elevate via sudo
   - Windows hosts path: `C:\Windows\System32\drivers\etc\hosts`, elevate via UAC
3. **Blocking must be reversible and scoped.** Every hosts-file line this app
   adds must be tagged with a marker comment (e.g. `# focusbuddy-block`) and
   only lines with that marker may ever be removed by the unblock routine.
4. **No always-on background daemon for v1.** The app only acts when the user
   opens it / starts a session — no silent polling or telemetry.

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
5. Optional distraction blocking: toggle at session start, hosts-file
   append/remove per the constraints above.
6. Avatar polish: swap placeholder for real sprite/Lottie animation, add
   mood states (idle / focused / celebrating / gentle nudge for overdue tasks).

## Explicitly out of scope for v1

- Habit tracking (handled separately via TickTick's native habit check-ins,
  not this app)
- Any Hermes/agent orchestration — this app is a standalone tool for now
- Cross-device sync — local, single-machine tool
- Live2D/Rive avatar rigging — stretch goal only, not required for launch

## Known limitations

- **Hosts-file blocking can't defeat browser-cached PWA content.** Sites like
  YouTube ship a service worker that caches feed/subscription data for offline
  viewing — that's served straight from local cache with no network request,
  so a `/etc/hosts` redirect has nothing to intercept. `config.js`'s
  `KNOWN_ALIASES` (in `src/platform/hosts.js`) covers the API/CDN subdomains
  needed to stop *live* browsing (search, fresh videos, new feed data) for
  YouTube/Twitter/Reddit/Facebook/Instagram, but previously-cached content can
  still surface until a browser extension-based blocker (navigation-layer,
  not DNS-layer) is built as a v2 companion — planned but not started.

## Style / conventions

- Keep the codebase small and readable over clever — this is a personal tool,
  not a product with a team maintaining it.
- Comment any platform-specific branch clearly (`// WINDOWS ONLY`, etc.)
- Prefer explicit config (a `config.js`/`.env`) for things like the block-list
  domains and default Pomodoro duration, rather than hardcoding inline.

// Must match src/config.js's blocking.serverPort.
const STATUS_URL = 'http://127.0.0.1:47990/status';
const POLL_MS = 2000;

const taskEl = document.getElementById('task');
const avatarEl = document.getElementById('avatar');

// No countdown here anymore — it drifted from the desktop widget's timer
// (this page only polls every 2s, and background.js's own sync is on a
// 30s alarm), which read as broken. background.js now sends this tab
// straight back to the original site the moment the session ends, so this
// page just needs to show *that* it's blocked, not a synced countdown.
async function poll() {
  let status;
  try {
    const res = await fetch(STATUS_URL, { cache: 'no-store' });
    status = await res.json();
  } catch (_) {
    // FocusBuddy app isn't reachable — nothing to show, keep waiting.
    return;
  }

  if (!status.active) {
    // Normally background.js navigates this tab away before this ever runs.
    // This is just a fallback in case that missed (e.g. tab was backgrounded).
    clearInterval(pollId);
    avatarEl.classList.add('is-done');
    taskEl.textContent = 'Session\'s over — you can head back.';
    return;
  }

  taskEl.textContent = status.taskTitle ? `Task: ${status.taskTitle}` : 'Stay focused!';
}

poll();
const pollId = setInterval(poll, POLL_MS);

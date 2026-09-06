// Must match src/config.js's blocking.serverPort.
const STATUS_URL = 'http://127.0.0.1:47990/status';
const POLL_MS = 2000;

const timerEl = document.getElementById('timer');
const taskEl = document.getElementById('task');

function formatSeconds(total) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

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
    // Session ended or blocking was turned off. Reloading would just
    // reload this same extension page (not the originally-blocked site),
    // which re-triggers poll() and loops forever — so stop polling and
    // let the user navigate away themselves instead.
    clearInterval(pollId);
    timerEl.textContent = "Session's over!";
    taskEl.textContent = 'You can close this tab or head back.';
    return;
  }

  if (typeof status.remainingSeconds === 'number') {
    timerEl.textContent = formatSeconds(status.remainingSeconds);
  }
  taskEl.textContent = status.taskTitle ? `Task: ${status.taskTitle}` : '';
}

poll();
const pollId = setInterval(poll, POLL_MS);

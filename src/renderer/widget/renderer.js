const avatar = document.getElementById('avatar');

// Manual drag instead of -webkit-app-region: drag: on Linux, a CSS drag
// region swallows the click needed to open the panel (the native window-move
// captures the gesture before a plain click can fire). Tracking movement
// ourselves lets a real drag move the window while a stationary click still
// opens the panel.
const DRAG_THRESHOLD = 4;
let drag = null;

avatar.addEventListener('mousedown', (event) => {
  drag = {
    startScreenX: event.screenX,
    startScreenY: event.screenY,
    winX: null,
    winY: null,
    moved: false,
  };
  window.focusbuddy.getPosition().then(([winX, winY]) => {
    if (!drag) return; // mouseup already happened before this resolved
    drag.winX = winX;
    drag.winY = winY;
  });
});

window.addEventListener('mousemove', (event) => {
  if (!drag) return;
  const dx = event.screenX - drag.startScreenX;
  const dy = event.screenY - drag.startScreenY;
  if (!drag.moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
    drag.moved = true;
  }
  if (drag.moved && drag.winX !== null) {
    window.focusbuddy.move(drag.winX + dx, drag.winY + dy);
  }
});

window.addEventListener('mouseup', () => {
  if (drag && !drag.moved) {
    window.focusbuddy.togglePanel();
  }
  drag = null;
});

const progressRing = document.getElementById('progressRing');

let timerState = { status: 'idle', durationSeconds: 0, remainingSeconds: 0 };
let hasOverdueTask = false;

function moodFor(state, overdue) {
  if (state.status === 'running') return 'focused';
  if (state.status === 'paused') return 'paused';
  if (state.status === 'completed') return 'celebrating';
  return overdue ? 'nudge' : 'idle';
}

function render() {
  const percent = timerState.durationSeconds > 0
    ? Math.min(100, Math.round(((timerState.durationSeconds - timerState.remainingSeconds) / timerState.durationSeconds) * 100))
    : 0;
  progressRing.style.setProperty('--progress', percent);
  avatar.dataset.mood = moodFor(timerState, hasOverdueTask);
}

function updateTimerDisplay(state) {
  timerState = state;
  render();
}

function updateOverdueState(overdue) {
  hasOverdueTask = overdue;
  render();
}

window.focusbuddy.timer.getState().then(updateTimerDisplay);
window.focusbuddy.timer.onState(updateTimerDisplay);
window.focusbuddy.avatar.onOverdueState(updateOverdueState);

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

function updateTimerDisplay(state) {
  const percent = state.durationSeconds > 0
    ? Math.min(100, Math.round(((state.durationSeconds - state.remainingSeconds) / state.durationSeconds) * 100))
    : 0;
  progressRing.style.setProperty('--progress', percent);
  avatar.classList.toggle('running', state.status === 'running');
  avatar.classList.toggle('paused', state.status === 'paused');
  avatar.classList.toggle('completed', state.status === 'completed');
}

window.focusbuddy.timer.getState().then(updateTimerDisplay);
window.focusbuddy.timer.onState(updateTimerDisplay);

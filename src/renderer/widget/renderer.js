const avatar = document.getElementById('avatar');

// Manual drag instead of -webkit-app-region: drag: on Linux, a CSS drag
// region swallows the click needed to open the panel (the native window-move
// captures the gesture before a plain click can fire). Tracking movement
// ourselves lets a real drag move the window while a stationary click still
// opens the panel.
const DRAG_THRESHOLD = 4;
let drag = null;
let isDragging = false;

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
    isDragging = true;
    render();
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
  if (isDragging) {
    isDragging = false;
    render();
  }
});

const progressRingCircle = document.querySelector('.progress-ring-circle');
const RING_CIRCUMFERENCE = 301.59;

let timerState = { status: 'idle', durationSeconds: 0, remainingSeconds: 0 };
let hasOverdueTask = false;
let isHovering = false;
let bubbleShown = false;

avatar.addEventListener('mouseenter', () => {
  isHovering = true;
  render();
});

avatar.addEventListener('mouseleave', () => {
  isHovering = false;
  render();
});

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
  progressRingCircle.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - percent / 100);
  const mood = moodFor(timerState, hasOverdueTask);
  avatar.dataset.mood = mood;

  const taskTitle = timerState.task?.title;
  const shouldShowBubble = mood === 'focused' && Boolean(taskTitle) && isHovering && !isDragging;

  // The bubble lives in its own overlay window (see src/main/windows.js),
  // so it can be positioned/flipped near screen edges without resizing or
  // shifting the widget window itself — which would eat into drag range.
  if (shouldShowBubble) {
    window.focusbuddy.bubble.show(taskTitle);
    bubbleShown = true;
  } else if (bubbleShown) {
    window.focusbuddy.bubble.hide();
    bubbleShown = false;
  }
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

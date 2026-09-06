const ticktickStatusEl = document.getElementById('ticktick-status');
const connectBtn = document.getElementById('ticktick-connect-btn');
const logoutBtn = document.getElementById('ticktick-logout-btn');
const refreshTasksBtn = document.getElementById('refresh-tasks-btn');
const tasksStatusEl = document.getElementById('tasks-status');
const taskListEl = document.getElementById('task-list');
const timerTaskEl = document.getElementById('timer-task');
const timerDisplayEl = document.getElementById('timer-display');
const timerMinutesInput = document.getElementById('timer-minutes');
const timerStartBtn = document.getElementById('timer-start-btn');
const timerPauseBtn = document.getElementById('timer-pause-btn');
const timerResumeBtn = document.getElementById('timer-resume-btn');
const timerResetBtn = document.getElementById('timer-reset-btn');
const markCompleteCheckbox = document.getElementById('mark-complete-checkbox');
const blockSitesCheckbox = document.getElementById('block-sites-checkbox');
const sessionStatusEl = document.getElementById('session-status');
const blockingStatusEl = document.getElementById('blocking-status');
const unblockNowBtn = document.getElementById('unblock-now-btn');
const blockingDomainsHintEl = document.getElementById('blocking-domains-hint');

let selectedTaskId = null;
let currentTasks = [];

function renderConnected(connected) {
  ticktickStatusEl.textContent = connected ? 'Connected to TickTick.' : 'Not connected to TickTick.';
  connectBtn.hidden = connected;
  logoutBtn.hidden = !connected;
  refreshTasksBtn.hidden = !connected;

  if (!connected) {
    taskListEl.hidden = true;
    taskListEl.innerHTML = '';
    tasksStatusEl.hidden = false;
    tasksStatusEl.textContent = 'Connect TickTick to see your tasks.';
    window.focusbuddy.avatar.setOverdueState(false);
  }
}

function updateOverdueState(tasks) {
  const now = new Date();
  const overdue = tasks.some((task) => task.dueDate && new Date(task.dueDate) < now);
  window.focusbuddy.avatar.setOverdueState(overdue);
}

function bucketTasksByDate(tasks) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfToday.getDate() + 1);

  const overdue = [];
  const today = [];
  const upcoming = [];
  const noDueDate = [];

  for (const task of tasks) {
    if (!task.dueDate) {
      noDueDate.push(task);
      continue;
    }
    const due = new Date(task.dueDate);
    if (due < startOfToday) overdue.push(task);
    else if (due < startOfTomorrow) today.push(task);
    else upcoming.push(task);
  }

  const byDueDate = (a, b) => new Date(a.dueDate) - new Date(b.dueDate);
  overdue.sort(byDueDate);
  today.sort(byDueDate);
  upcoming.sort(byDueDate);

  return { overdue, today, upcoming, noDueDate };
}

function createTaskItem(task) {
  const item = document.createElement('li');
  item.className = 'task-item';
  item.dataset.taskId = task.id;
  if (task.id === selectedTaskId) item.classList.add('selected');

  const complete = document.createElement('input');
  complete.type = 'checkbox';
  complete.className = 'task-complete-checkbox';
  complete.addEventListener('click', (event) => event.stopPropagation());
  complete.addEventListener('change', async () => {
    complete.disabled = true;
    try {
      await window.focusbuddy.ticktick.completeTask(task.projectId, task.id);
      window.focusbuddySounds.celebrate();
      if (task.id === selectedTaskId) selectedTaskId = null;
      renderTasks(currentTasks.filter((t) => t.id !== task.id));
    } catch (err) {
      complete.checked = false;
      complete.disabled = false;
      tasksStatusEl.hidden = false;
      tasksStatusEl.textContent = `Couldn't mark "${task.title}" complete: ${err.message}`;
    }
  });

  const title = document.createElement('span');
  title.className = 'task-title';
  title.textContent = task.title;

  const project = document.createElement('span');
  project.className = 'task-project';
  project.textContent = task.projectName;

  item.appendChild(complete);
  item.appendChild(title);
  item.appendChild(project);
  item.addEventListener('click', () => {
    window.focusbuddySounds.select();
    selectedTaskId = task.id === selectedTaskId ? null : task.id;
    renderTasks(currentTasks);
  });

  return item;
}

function appendTaskSection(label, tasks) {
  if (!tasks.length) return;

  const heading = document.createElement('li');
  heading.className = 'task-section-title';
  heading.textContent = `${label} (${tasks.length})`;
  taskListEl.appendChild(heading);

  for (const task of tasks) {
    taskListEl.appendChild(createTaskItem(task));
  }
}

function renderTasks(tasks) {
  currentTasks = tasks;
  taskListEl.innerHTML = '';
  updateOverdueState(tasks);

  if (!tasks.length) {
    tasksStatusEl.hidden = false;
    tasksStatusEl.textContent = 'No open tasks — nice work.';
    taskListEl.hidden = true;
    return;
  }

  tasksStatusEl.hidden = true;
  taskListEl.hidden = false;

  const { overdue, today, upcoming, noDueDate } = bucketTasksByDate(tasks);
  appendTaskSection('Overdue', overdue);
  appendTaskSection('Today', today);
  appendTaskSection('Upcoming', upcoming);
  appendTaskSection('No due date', noDueDate);
}

async function loadTasks() {
  tasksStatusEl.hidden = false;
  tasksStatusEl.textContent = 'Loading tasks…';
  taskListEl.hidden = true;

  try {
    const tasks = await window.focusbuddy.ticktick.getTasks();
    renderTasks(tasks);
  } catch (err) {
    tasksStatusEl.textContent = `Couldn't load tasks: ${err.message}`;
  }
}

async function refreshConnectionState() {
  const connected = await window.focusbuddy.ticktick.isAuthenticated();
  renderConnected(connected);
  if (connected) await loadTasks();
}

connectBtn.addEventListener('click', async () => {
  connectBtn.disabled = true;
  ticktickStatusEl.textContent = 'Opening browser to connect…';
  try {
    await window.focusbuddy.ticktick.connect();
    await refreshConnectionState();
  } catch (err) {
    ticktickStatusEl.textContent = `Connection failed: ${err.message}`;
  } finally {
    connectBtn.disabled = false;
  }
});

logoutBtn.addEventListener('click', async () => {
  await window.focusbuddy.ticktick.logout();
  await refreshConnectionState();
});

refreshTasksBtn.addEventListener('click', loadTasks);

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const panelAvatar = document.getElementById('panel-avatar');

function moodFor(state) {
  if (state.status === 'running') return 'focused';
  if (state.status === 'paused') return 'paused';
  if (state.status === 'completed') return 'celebrating';
  return 'idle';
}

function renderTimerState(state) {
  const displaySeconds = state.status === 'idle'
    ? Number(timerMinutesInput.value || 0) * 60
    : state.remainingSeconds;
  timerDisplayEl.textContent = formatTime(displaySeconds);
  timerTaskEl.textContent = state.task ? state.task.title : 'No task selected';
  panelAvatar.dataset.mood = moodFor(state);

  const running = state.status === 'running';
  const paused = state.status === 'paused';

  timerStartBtn.hidden = running || paused;
  timerPauseBtn.hidden = !running;
  timerResumeBtn.hidden = !paused;
  timerResetBtn.hidden = state.status === 'idle';
  timerMinutesInput.disabled = running || paused;
  markCompleteCheckbox.disabled = running || paused;
  blockSitesCheckbox.disabled = running || paused;
}

function renderBlockingState(active) {
  blockingStatusEl.textContent = active ? 'Distracting sites are blocked.' : 'Sites not blocked.';
  unblockNowBtn.hidden = !active;
}

async function initBlocking() {
  const domains = await window.focusbuddy.blocking.getDomains();
  blockingDomainsHintEl.textContent = `Blocks: ${domains.join(', ')}`;
  blockSitesCheckbox.checked = await window.focusbuddy.blocking.getEnabledDefault();
  renderBlockingState(await window.focusbuddy.blocking.isActive());
  window.focusbuddy.blocking.onState(renderBlockingState);
}

unblockNowBtn.addEventListener('click', async () => {
  renderBlockingState(await window.focusbuddy.blocking.unblockNow());
});

timerMinutesInput.addEventListener('input', () => {
  if (timerMinutesInput.disabled) return;
  timerDisplayEl.textContent = formatTime(Number(timerMinutesInput.value || 0) * 60);
});

async function initTimer() {
  const defaultMinutes = await window.focusbuddy.timer.getDefaultMinutes();
  timerMinutesInput.value = defaultMinutes;
  markCompleteCheckbox.checked = await window.focusbuddy.timer.getMarkCompleteDefault();

  const state = await window.focusbuddy.timer.getState();
  renderTimerState(state);
  window.focusbuddy.timer.onState(renderTimerState);
  window.focusbuddy.timer.onSessionCompleted(renderSessionCompleted);
}

function renderSessionCompleted({ entry, ticktickSynced, ticktickError, focusSynced, focusError }) {
  window.focusbuddySounds.celebrate();
  sessionStatusEl.hidden = false;

  const parts = ['Session logged.'];
  if (entry.task) {
    if (ticktickSynced) parts.push(`"${entry.task.title}" marked complete in TickTick.`);
    else if (ticktickError) parts.push(`Couldn't mark task complete: ${ticktickError}`);
  }
  if (focusSynced) parts.push('Focus session saved to TickTick.');
  else if (focusError) parts.push(`Couldn't save focus session to TickTick: ${focusError}`);

  sessionStatusEl.textContent = parts.join(' ');
}

timerStartBtn.addEventListener('click', async () => {
  window.focusbuddySounds.start();
  const minutes = Number(timerMinutesInput.value) || 25;
  const task = currentTasks.find((t) => t.id === selectedTaskId) || null;
  sessionStatusEl.hidden = true;
  timerStartBtn.disabled = true;
  try {
    renderTimerState(
      await window.focusbuddy.timer.start(minutes, task, markCompleteCheckbox.checked, blockSitesCheckbox.checked)
    );
  } catch (err) {
    sessionStatusEl.hidden = false;
    sessionStatusEl.textContent = `Couldn't start session: ${err.message}`;
  } finally {
    timerStartBtn.disabled = false;
  }
});

timerPauseBtn.addEventListener('click', async () => {
  window.focusbuddySounds.click();
  renderTimerState(await window.focusbuddy.timer.pause());
});

timerResumeBtn.addEventListener('click', async () => {
  window.focusbuddySounds.click();
  renderTimerState(await window.focusbuddy.timer.resume());
});

timerResetBtn.addEventListener('click', async () => {
  window.focusbuddySounds.click();
  sessionStatusEl.hidden = true;
  renderTimerState(await window.focusbuddy.timer.reset());
});

document.getElementById('panel-close-btn').addEventListener('click', () => window.focusbuddy.panel.hide());
window.focusbuddy.panel.onWillShow((anchorSide) => {
  document.body.dataset.anchor = anchorSide === 'right' ? 'left' : 'right';
  document.body.classList.remove('panel-visible');
  void document.body.offsetWidth;
  document.body.classList.add('panel-visible');
});

refreshConnectionState();
initTimer();
initBlocking();

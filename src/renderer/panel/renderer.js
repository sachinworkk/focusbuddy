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
const defaultMinutesInput = document.getElementById('default-minutes-input');
const defaultMarkCompleteCheckbox = document.getElementById('default-mark-complete-checkbox');
const defaultBlockSitesCheckbox = document.getElementById('default-block-sites-checkbox');
const settingsSavedHintEl = document.getElementById('settings-saved-hint');
const settingsSection = document.getElementById('settings-section');
const settingsToggleBtn = document.getElementById('settings-toggle-btn');

let selectedTaskId = null;
let currentTasks = [];
let currentTimerState = null;

function updateIdleTaskLabel() {
  if (currentTimerState && currentTimerState.status !== 'idle') return;
  const selected = currentTasks.find((t) => t.id === selectedTaskId);
  timerTaskEl.textContent = selected ? selected.title : 'No task selected';
}

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

function isOverdue(task) {
  return Boolean(task.dueDate && new Date(task.dueDate) < new Date());
}

function updateOverdueState(tasks) {
  window.focusbuddy.avatar.setOverdueState(tasks.some(isOverdue));
}

function todayYMD() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function updateTaskDueDate(task, dueDateISO, isAllDay) {
  const previousDueDate = task.dueDate;
  const previousIsAllDay = task.isAllDay;
  task.dueDate = dueDateISO;
  task.isAllDay = isAllDay;
  renderTasks(currentTasks);
  try {
    await window.focusbuddy.ticktick.updateDueDate(task.projectId, task.id, dueDateISO, isAllDay);
  } catch (err) {
    task.dueDate = previousDueDate;
    task.isAllDay = previousIsAllDay;
    renderTasks(currentTasks);
    tasksStatusEl.hidden = false;
    tasksStatusEl.textContent = `Couldn't update due date for "${task.title}": ${err.message}`;
  }
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

function formatDueLabel(task, bucket) {
  const due = new Date(task.dueDate);
  if (bucket === 'today') {
    return task.isAllDay ? 'All day' : due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const weekday = due.toLocaleDateString([], { weekday: 'short' });
  if (bucket === 'upcoming') {
    if (task.isAllDay) return weekday;
    return `${weekday} ${due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  return '';
}

function createDueControl(task, bucket) {
  const control = document.createElement('span');
  control.className = 'task-due-control';

  const label = document.createElement('button');
  label.type = 'button';
  label.className = 'link-btn task-due-label';
  label.textContent = bucket === 'noDueDate' ? '📅' : formatDueLabel(task, bucket);

  const input = document.createElement('input');
  input.className = 'task-due-input';
  input.addEventListener('click', (event) => event.stopPropagation());

  if (bucket === 'noDueDate') {
    input.type = 'date';
    input.addEventListener('change', () => {
      if (!input.value) return;
      updateTaskDueDate(task, `${input.value}T00:00:00.000+0000`, true);
    });
  } else {
    input.type = 'datetime-local';
    const due = new Date(task.dueDate);
    const pad = (n) => String(n).padStart(2, '0');
    input.value = `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}T${pad(due.getHours())}:${pad(due.getMinutes())}`;
    input.addEventListener('change', () => {
      if (!input.value) return;
      updateTaskDueDate(task, `${input.value}:00.000+0000`, false);
    });
  }

  label.addEventListener('click', (event) => {
    event.stopPropagation();
    input.showPicker();
  });

  control.appendChild(label);
  control.appendChild(input);
  return control;
}

function createTaskItem(task, bucket) {
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

  if (bucket === 'overdue') {
    const todayBtn = document.createElement('button');
    todayBtn.type = 'button';
    todayBtn.className = 'link-btn task-today-btn';
    todayBtn.textContent = 'Today';
    todayBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      updateTaskDueDate(task, `${todayYMD()}T00:00:00.000+0000`, true);
    });
    item.appendChild(todayBtn);
  } else {
    item.appendChild(createDueControl(task, bucket));
  }

  item.addEventListener('click', () => {
    window.focusbuddySounds.select();
    selectedTaskId = task.id === selectedTaskId ? null : task.id;
    renderTasks(currentTasks);
    updateIdleTaskLabel();
  });

  return item;
}

function appendTaskSection(label, tasks, bucket, sectionAction) {
  if (!tasks.length) return;

  const heading = document.createElement('li');
  heading.className = 'task-section-title';
  const labelSpan = document.createElement('span');
  labelSpan.textContent = `${label} (${tasks.length})`;
  heading.appendChild(labelSpan);
  if (sectionAction) heading.appendChild(sectionAction);
  taskListEl.appendChild(heading);

  for (const task of tasks) {
    taskListEl.appendChild(createTaskItem(task, bucket));
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
    updateIdleTaskLabel();
    return;
  }

  tasksStatusEl.hidden = true;
  taskListEl.hidden = false;

  const { overdue, today, upcoming, noDueDate } = bucketTasksByDate(tasks);

  let moveAllBtn = null;
  if (overdue.length) {
    moveAllBtn = document.createElement('button');
    moveAllBtn.type = 'button';
    moveAllBtn.className = 'link-btn task-move-all-today-btn';
    moveAllBtn.textContent = 'Move all to Today';
    moveAllBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      moveAllBtn.disabled = true;
      const todayDate = `${todayYMD()}T00:00:00.000+0000`;
      // Sequential so a mid-batch failure doesn't leave a hard-to-reason-about
      // half-applied state and error messages don't race each other.
      for (const task of [...overdue]) {
        await updateTaskDueDate(task, todayDate, true);
      }
    });
  }

  appendTaskSection('Overdue', overdue, 'overdue', moveAllBtn);
  appendTaskSection('Today', today, 'today');
  appendTaskSection('Upcoming', upcoming, 'upcoming');
  appendTaskSection('No due date', noDueDate, 'noDueDate');
  updateIdleTaskLabel();
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
  currentTimerState = state;
  const displaySeconds = state.status === 'idle'
    ? Number(timerMinutesInput.value || 0) * 60
    : state.remainingSeconds;
  timerDisplayEl.textContent = formatTime(displaySeconds);
  if (state.status === 'idle') updateIdleTaskLabel();
  else timerTaskEl.textContent = state.task ? state.task.title : 'No task selected';
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

let settingsSavedTimeout = null;
function flashSettingsSaved() {
  settingsSavedHintEl.hidden = false;
  clearTimeout(settingsSavedTimeout);
  settingsSavedTimeout = setTimeout(() => {
    settingsSavedHintEl.hidden = true;
  }, 1500);
}

async function initSettings() {
  const settings = await window.focusbuddy.settings.get();
  defaultMinutesInput.value = settings.defaultMinutes;
  defaultMarkCompleteCheckbox.checked = settings.markTaskCompleteByDefault;
  defaultBlockSitesCheckbox.checked = settings.blockSitesByDefault;
}

// Only overwrite the live start-session controls while idle, so changing
// defaults never clobbers a running/paused session's chosen values.
function applySettingsToLiveTimer(settings) {
  if (currentTimerState && currentTimerState.status !== 'idle') return;
  if (settings.defaultMinutes !== undefined) {
    timerMinutesInput.value = settings.defaultMinutes;
    timerDisplayEl.textContent = formatTime(Number(timerMinutesInput.value || 0) * 60);
  }
  if (settings.markTaskCompleteByDefault !== undefined) {
    markCompleteCheckbox.checked = settings.markTaskCompleteByDefault;
  }
  if (settings.blockSitesByDefault !== undefined) {
    blockSitesCheckbox.checked = settings.blockSitesByDefault;
  }
}

defaultMinutesInput.addEventListener('change', async () => {
  const settings = await window.focusbuddy.settings.update({ defaultMinutes: defaultMinutesInput.value });
  defaultMinutesInput.value = settings.defaultMinutes;
  applySettingsToLiveTimer({ defaultMinutes: settings.defaultMinutes });
  flashSettingsSaved();
});

defaultMarkCompleteCheckbox.addEventListener('change', async () => {
  await window.focusbuddy.settings.update({ markTaskCompleteByDefault: defaultMarkCompleteCheckbox.checked });
  applySettingsToLiveTimer({ markTaskCompleteByDefault: defaultMarkCompleteCheckbox.checked });
  flashSettingsSaved();
});

defaultBlockSitesCheckbox.addEventListener('change', async () => {
  await window.focusbuddy.settings.update({ blockSitesByDefault: defaultBlockSitesCheckbox.checked });
  applySettingsToLiveTimer({ blockSitesByDefault: defaultBlockSitesCheckbox.checked });
  flashSettingsSaved();
});

settingsToggleBtn.addEventListener('click', () => {
  const open = settingsSection.hidden;
  settingsSection.hidden = !open;
  settingsToggleBtn.setAttribute('aria-pressed', String(open));
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
initSettings();

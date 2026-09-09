const { ipcMain } = require('electron');
const { togglePanelWindow, getWidgetWindow, getPanelWindow } = require('./windows');
const ticktickAuth = require('./ticktick/auth');
const ticktickApi = require('./ticktick/api');
const timer = require('./timer');
const sessionLog = require('./session-log');
const blockServer = require('./block-server');
const config = require('../config');
const store = require('./store');

function broadcastTimerState(state) {
  for (const win of [getWidgetWindow(), getPanelWindow()]) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('timer:state', state);
    }
  }
}

function broadcastSessionCompleted(payload) {
  for (const win of [getWidgetWindow(), getPanelWindow()]) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('session:completed', payload);
    }
  }
}

function broadcastBlockingState(active) {
  for (const win of [getWidgetWindow(), getPanelWindow()]) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('blocking:state', active);
    }
  }
}

function unblockAndNotify() {
  blockServer.setActive(false);
  broadcastBlockingState(blockServer.isActive());
}

async function handleTimerCompleted({ task, durationSeconds, startedAt, endedAt, markTaskComplete }) {
  const entry = { task, durationSeconds, startedAt, endedAt };
  sessionLog.appendSession(entry);

  let ticktickSynced = false;
  let ticktickError = null;

  if (markTaskComplete && task?.id && task?.projectId) {
    try {
      await ticktickApi.completeTask(task.projectId, task.id);
      ticktickSynced = true;
    } catch (err) {
      ticktickError = err.message;
    }
  }

  let focusSynced = false;
  let focusError = null;

  try {
    await ticktickApi.createFocusRecord({
      taskId: task?.id,
      startTime: startedAt,
      endTime: endedAt,
      durationSeconds,
    });
    focusSynced = true;
  } catch (err) {
    focusError = err.message;
  }

  unblockAndNotify();
  broadcastSessionCompleted({ entry, ticktickSynced, ticktickError, focusSynced, focusError });
}

function registerIpcHandlers() {
  ipcMain.on('widget:toggle-panel', () => {
    togglePanelWindow();
  });

  ipcMain.handle('widget:get-position', () => {
    const widget = getWidgetWindow();
    return widget ? widget.getPosition() : [0, 0];
  });

  ipcMain.on('widget:move', (event, x, y) => {
    const widget = getWidgetWindow();
    if (widget) widget.setPosition(Math.round(x), Math.round(y));
  });

  ipcMain.on('panel:hide', () => {
    const panel = getPanelWindow();
    if (panel && !panel.isDestroyed()) panel.hide();
  });

  ipcMain.handle('ticktick:is-authenticated', () => {
    return ticktickAuth.isAuthenticated();
  });

  ipcMain.handle('ticktick:connect', async () => {
    await ticktickAuth.startAuthFlow();
    return true;
  });

  ipcMain.handle('ticktick:logout', () => {
    ticktickAuth.logout();
    return true;
  });

  ipcMain.handle('ticktick:get-tasks', async () => {
    return ticktickApi.getAllTasks();
  });

  ipcMain.handle('ticktick:complete-task', async (event, { projectId, taskId }) => {
    await ticktickApi.completeTask(projectId, taskId);
    return true;
  });

  ipcMain.handle('ticktick:update-due-date', async (event, { projectId, taskId, dueDate, isAllDay, startDate }) => {
    await ticktickApi.updateTaskDueDate(projectId, taskId, dueDate, isAllDay, startDate);
    return true;
  });

  ipcMain.handle('ticktick:get-projects', () => {
    return ticktickApi.getProjects();
  });

  ipcMain.handle('ticktick:create-task', async (event, { title, projectId }) => {
    return ticktickApi.createTask({ title, projectId });
  });

  ipcMain.handle('ticktick:update-task', async (event, { taskId, currentProjectId, title, projectId }) => {
    await ticktickApi.updateTask(taskId, currentProjectId, { title, projectId });
    return true;
  });

  ipcMain.handle('ticktick:delete-task', async (event, { projectId, taskId }) => {
    await ticktickApi.deleteTask(projectId, taskId);
    return true;
  });

  ipcMain.on('avatar:set-overdue-state', (event, overdue) => {
    const widget = getWidgetWindow();
    if (widget && !widget.isDestroyed()) {
      widget.webContents.send('avatar:overdue-state', !!overdue);
    }
  });

  timer.onChange(broadcastTimerState);
  timer.onCompleted(handleTimerCompleted);

  ipcMain.handle('timer:get-default-minutes', () => store.getSettings().defaultMinutes);
  ipcMain.handle('timer:get-mark-complete-default', () => store.getSettings().markTaskCompleteByDefault);
  ipcMain.handle('timer:get-state', () => timer.getState());
  ipcMain.handle('timer:start', async (event, { minutes, task, markTaskComplete, blockSites }) => {
    if (blockSites) {
      blockServer.setActive(true);
      broadcastBlockingState(blockServer.isActive());
    }
    return timer.start(minutes, task, { markTaskComplete });
  });
  ipcMain.handle('timer:pause', () => timer.pause());
  ipcMain.handle('timer:resume', () => timer.resume());
  ipcMain.handle('timer:reset', () => {
    const state = timer.reset();
    unblockAndNotify();
    return state;
  });

  ipcMain.handle('blocking:get-domains', () => config.blocking.domains);
  ipcMain.handle('blocking:get-enabled-default', () => store.getSettings().blockSitesByDefault);
  ipcMain.handle('blocking:is-active', () => blockServer.isActive());
  ipcMain.handle('blocking:unblock-now', () => {
    unblockAndNotify();
    return blockServer.isActive();
  });

  ipcMain.handle('settings:get', () => store.getSettings());
  ipcMain.handle('settings:update', (event, partial) => {
    const clean = {};
    if (partial && Number.isFinite(Number(partial.defaultMinutes))) {
      clean.defaultMinutes = Math.min(180, Math.max(1, Math.round(Number(partial.defaultMinutes))));
    }
    if (partial && typeof partial.markTaskCompleteByDefault === 'boolean') {
      clean.markTaskCompleteByDefault = partial.markTaskCompleteByDefault;
    }
    if (partial && typeof partial.blockSitesByDefault === 'boolean') {
      clean.blockSitesByDefault = partial.blockSitesByDefault;
    }
    return store.setSettings(clean);
  });
}

module.exports = { registerIpcHandlers };

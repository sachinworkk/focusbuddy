const { ipcMain } = require('electron');
const { togglePanelWindow, getWidgetWindow, getPanelWindow } = require('./windows');
const ticktickAuth = require('./ticktick/auth');
const ticktickApi = require('./ticktick/api');
const timer = require('./timer');
const sessionLog = require('./session-log');
const hosts = require('../platform/hosts');
const config = require('../config');

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

async function unblockAndNotify() {
  if (!hosts.isBlockingActive()) return;
  try {
    await hosts.unblockDomains();
  } finally {
    broadcastBlockingState(hosts.isBlockingActive());
  }
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

  await unblockAndNotify();
  broadcastSessionCompleted({ entry, ticktickSynced, ticktickError });
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

  ipcMain.on('avatar:set-overdue-state', (event, overdue) => {
    const widget = getWidgetWindow();
    if (widget && !widget.isDestroyed()) {
      widget.webContents.send('avatar:overdue-state', !!overdue);
    }
  });

  timer.onChange(broadcastTimerState);
  timer.onCompleted(handleTimerCompleted);

  ipcMain.handle('timer:get-default-minutes', () => config.pomodoro.defaultMinutes);
  ipcMain.handle('timer:get-mark-complete-default', () => config.pomodoro.markTaskCompleteByDefault);
  ipcMain.handle('timer:get-state', () => timer.getState());
  ipcMain.handle('timer:start', async (event, { minutes, task, markTaskComplete, blockSites }) => {
    if (blockSites) {
      try {
        await hosts.blockDomains(config.blocking.domains);
      } finally {
        broadcastBlockingState(hosts.isBlockingActive());
      }
    }
    return timer.start(minutes, task, { markTaskComplete });
  });
  ipcMain.handle('timer:pause', () => timer.pause());
  ipcMain.handle('timer:resume', () => timer.resume());
  ipcMain.handle('timer:reset', async () => {
    const state = timer.reset();
    await unblockAndNotify();
    return state;
  });

  ipcMain.handle('blocking:get-domains', () => config.blocking.domains);
  ipcMain.handle('blocking:get-enabled-default', () => config.blocking.enabledByDefault);
  ipcMain.handle('blocking:is-active', () => hosts.isBlockingActive());
  ipcMain.handle('blocking:unblock-now', async () => {
    await unblockAndNotify();
    return hosts.isBlockingActive();
  });
}

module.exports = { registerIpcHandlers };

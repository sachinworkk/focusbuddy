const { ipcMain } = require('electron');
const { togglePanelWindow, getWidgetWindow, getPanelWindow } = require('./windows');
const ticktickAuth = require('./ticktick/auth');
const ticktickApi = require('./ticktick/api');
const timer = require('./timer');
const config = require('../config');

function broadcastTimerState(state) {
  for (const win of [getWidgetWindow(), getPanelWindow()]) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('timer:state', state);
    }
  }
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

  timer.onChange(broadcastTimerState);

  ipcMain.handle('timer:get-default-minutes', () => config.pomodoro.defaultMinutes);
  ipcMain.handle('timer:get-state', () => timer.getState());
  ipcMain.handle('timer:start', (event, { minutes, task }) => timer.start(minutes, task));
  ipcMain.handle('timer:pause', () => timer.pause());
  ipcMain.handle('timer:resume', () => timer.resume());
  ipcMain.handle('timer:reset', () => timer.reset());
}

module.exports = { registerIpcHandlers };

const { app, BrowserWindow } = require('electron');
const { createWidgetWindow, getWidgetWindow } = require('./windows');
const { registerIpcHandlers } = require('./ipc');
const { createTray } = require('./tray');
const blockServer = require('./block-server');
const blocklist = require('./blocklist');
const timer = require('./timer');
const config = require('../config');

function bootstrap() {
  registerIpcHandlers();
  createWidgetWindow();
  createTray();
  blockServer.start(
    config.blocking.serverPort,
    () => blocklist.expandDomains(config.blocking.domains),
    () => timer.getState(),
  );
}

app.whenReady().then(bootstrap);

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 || !getWidgetWindow()) {
    createWidgetWindow();
  }
});

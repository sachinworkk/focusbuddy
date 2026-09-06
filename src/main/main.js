const { app, BrowserWindow } = require('electron');
const { createWidgetWindow, getWidgetWindow } = require('./windows');
const { registerIpcHandlers } = require('./ipc');
const { createTray } = require('./tray');

function bootstrap() {
  registerIpcHandlers();
  createWidgetWindow();
  createTray();
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

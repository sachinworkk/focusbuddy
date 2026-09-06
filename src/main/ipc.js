const { ipcMain } = require('electron');
const { togglePanelWindow, getWidgetWindow } = require('./windows');

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
}

module.exports = { registerIpcHandlers };

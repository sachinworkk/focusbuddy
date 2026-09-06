const path = require('path');
const { Tray, Menu, app } = require('electron');
const { getWidgetWindow, createWidgetWindow } = require('./windows');

let tray = null; // must keep a module-level reference or Electron GCs the icon

function createTray() {
  // TODO(platform): macOS wants a template image (file name ending "Template.png",
  // nativeImage.setTemplateImage(true)) so the icon adapts to light/dark menu bars.
  // Windows conventionally uses a multi-res .ico. Only Linux needs to work today.
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'tray-icon.png');
  tray = new Tray(iconPath);
  tray.setToolTip('FocusBuddy');

  const menu = Menu.buildFromTemplate([
    {
      label: 'Show Widget',
      click: () => {
        const widget = getWidgetWindow();
        if (widget) {
          widget.show();
        } else {
          createWidgetWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ]);
  tray.setContextMenu(menu);

  return tray;
}

module.exports = { createTray };

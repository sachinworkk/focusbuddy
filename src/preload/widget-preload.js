const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('focusbuddy', {
  togglePanel: () => ipcRenderer.send('widget:toggle-panel'),
  getPosition: () => ipcRenderer.invoke('widget:get-position'),
  move: (x, y) => ipcRenderer.send('widget:move', x, y),
});

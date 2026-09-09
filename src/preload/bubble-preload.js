const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('focusbuddyBubble', {
  onSetText: (callback) => {
    const handler = (event, text) => callback(text);
    ipcRenderer.on('bubble:set-text', handler);
    return () => ipcRenderer.removeListener('bubble:set-text', handler);
  },
  onUpdate: (callback) => {
    const handler = (event, payload) => callback(payload);
    ipcRenderer.on('bubble:update', handler);
    return () => ipcRenderer.removeListener('bubble:update', handler);
  },
});

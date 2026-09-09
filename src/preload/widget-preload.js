const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('focusbuddy', {
  togglePanel: () => ipcRenderer.send('widget:toggle-panel'),
  getPosition: () => ipcRenderer.invoke('widget:get-position'),
  move: (x, y) => ipcRenderer.send('widget:move', x, y),
  bubble: {
    show: (text) => ipcRenderer.send('widget:bubble-show', text),
    hide: () => ipcRenderer.send('widget:bubble-hide'),
  },
  timer: {
    getState: () => ipcRenderer.invoke('timer:get-state'),
    onState: (callback) => {
      const handler = (event, state) => callback(state);
      ipcRenderer.on('timer:state', handler);
      return () => ipcRenderer.removeListener('timer:state', handler);
    },
  },
  avatar: {
    onOverdueState: (callback) => {
      const handler = (event, overdue) => callback(overdue);
      ipcRenderer.on('avatar:overdue-state', handler);
      return () => ipcRenderer.removeListener('avatar:overdue-state', handler);
    },
  },
});

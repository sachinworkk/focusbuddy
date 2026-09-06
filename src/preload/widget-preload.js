const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('focusbuddy', {
  togglePanel: () => ipcRenderer.send('widget:toggle-panel'),
  getPosition: () => ipcRenderer.invoke('widget:get-position'),
  move: (x, y) => ipcRenderer.send('widget:move', x, y),
  timer: {
    getState: () => ipcRenderer.invoke('timer:get-state'),
    onState: (callback) => {
      const handler = (event, state) => callback(state);
      ipcRenderer.on('timer:state', handler);
      return () => ipcRenderer.removeListener('timer:state', handler);
    },
  },
});

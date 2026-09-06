const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('focusbuddy', {
  ticktick: {
    isAuthenticated: () => ipcRenderer.invoke('ticktick:is-authenticated'),
    connect: () => ipcRenderer.invoke('ticktick:connect'),
    logout: () => ipcRenderer.invoke('ticktick:logout'),
    getTasks: () => ipcRenderer.invoke('ticktick:get-tasks'),
  },
  timer: {
    getDefaultMinutes: () => ipcRenderer.invoke('timer:get-default-minutes'),
    getState: () => ipcRenderer.invoke('timer:get-state'),
    start: (minutes, task) => ipcRenderer.invoke('timer:start', { minutes, task }),
    pause: () => ipcRenderer.invoke('timer:pause'),
    resume: () => ipcRenderer.invoke('timer:resume'),
    reset: () => ipcRenderer.invoke('timer:reset'),
    onState: (callback) => {
      const handler = (event, state) => callback(state);
      ipcRenderer.on('timer:state', handler);
      return () => ipcRenderer.removeListener('timer:state', handler);
    },
  },
});

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('focusbuddy', {
  panel: {
    hide: () => ipcRenderer.send('panel:hide'),
    onWillShow: (callback) => {
      const handler = (event, anchorSide) => callback(anchorSide);
      ipcRenderer.on('panel:will-show', handler);
      return () => ipcRenderer.removeListener('panel:will-show', handler);
    },
  },
  ticktick: {
    isAuthenticated: () => ipcRenderer.invoke('ticktick:is-authenticated'),
    connect: () => ipcRenderer.invoke('ticktick:connect'),
    logout: () => ipcRenderer.invoke('ticktick:logout'),
    getTasks: () => ipcRenderer.invoke('ticktick:get-tasks'),
    completeTask: (projectId, taskId) => ipcRenderer.invoke('ticktick:complete-task', { projectId, taskId }),
    updateDueDate: (projectId, taskId, dueDate, isAllDay, startDate) =>
      ipcRenderer.invoke('ticktick:update-due-date', { projectId, taskId, dueDate, isAllDay, startDate }),
  },
  avatar: {
    setOverdueState: (overdue) => ipcRenderer.send('avatar:set-overdue-state', overdue),
  },
  timer: {
    getDefaultMinutes: () => ipcRenderer.invoke('timer:get-default-minutes'),
    getMarkCompleteDefault: () => ipcRenderer.invoke('timer:get-mark-complete-default'),
    getState: () => ipcRenderer.invoke('timer:get-state'),
    start: (minutes, task, markTaskComplete, blockSites) =>
      ipcRenderer.invoke('timer:start', { minutes, task, markTaskComplete, blockSites }),
    pause: () => ipcRenderer.invoke('timer:pause'),
    resume: () => ipcRenderer.invoke('timer:resume'),
    reset: () => ipcRenderer.invoke('timer:reset'),
    onState: (callback) => {
      const handler = (event, state) => callback(state);
      ipcRenderer.on('timer:state', handler);
      return () => ipcRenderer.removeListener('timer:state', handler);
    },
    onSessionCompleted: (callback) => {
      const handler = (event, payload) => callback(payload);
      ipcRenderer.on('session:completed', handler);
      return () => ipcRenderer.removeListener('session:completed', handler);
    },
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (partial) => ipcRenderer.invoke('settings:update', partial),
  },
  blocking: {
    getDomains: () => ipcRenderer.invoke('blocking:get-domains'),
    getEnabledDefault: () => ipcRenderer.invoke('blocking:get-enabled-default'),
    isActive: () => ipcRenderer.invoke('blocking:is-active'),
    unblockNow: () => ipcRenderer.invoke('blocking:unblock-now'),
    onState: (callback) => {
      const handler = (event, active) => callback(active);
      ipcRenderer.on('blocking:state', handler);
      return () => ipcRenderer.removeListener('blocking:state', handler);
    },
  },
});

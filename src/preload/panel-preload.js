const { contextBridge } = require('electron');

// Placeholder bridge for the panel window. Future phases will add IPC
// channels here for task list data, timer control, and settings.
contextBridge.exposeInMainWorld('focusbuddy', {});

// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
// preload.js
const { contextBridge, app } = require('electron');
const os = require('os');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
  isDev: !app.isPackaged,
  homeDir: os.homedir(),
  getAppDataPath: () => app.getPath('userData'),
});
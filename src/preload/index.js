// src/preload/index.js

const { contextBridge } = require('electron');
const os = require('os');
const path = require('path');

const homeDir = os.homedir();

const systemPaths = {
  home: homeDir,
  appData: process.platform === 'win32'
    ? (process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'))
    : process.platform === 'darwin'
      ? path.join(homeDir, 'Library', 'Application Support')
      : path.join(homeDir, '.config'),
  documents: path.join(homeDir, 'Documents'),
  downloads: path.join(homeDir, 'Downloads'),
  pictures: path.join(homeDir, 'Pictures'),
  desktop: path.join(homeDir, 'Desktop'),
};

contextBridge.exposeInMainWorld('systemPaths', systemPaths);

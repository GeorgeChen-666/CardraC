import { readFileToData } from './functions';
import Store from 'electron-store';
import { ipcMain } from 'electron';

const { app, BrowserWindow } = require('electron');
const { registerRendererActionHandlers, isDev } = require('./ActionHandlers')

const fs = require('fs');
const path = require('path');

function getAppVersion() {
  const workingDirectory = process.cwd();
  const packageJsonPath = path.join(workingDirectory, 'package.json');
  const packageJson = fs.readFileSync(packageJsonPath, 'utf-8');
  const { version } = JSON.parse(packageJson);
  return version;
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    icon: 'icon',
    width: 1280,
    height: 800,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    },
  });
  const renderLog = (...args) => setTimeout(() => mainWindow.webContents.send('console', args), 2000) ;

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  if(isDev) {
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
  } else {
    //mainWindow.webContents.openDevTools();
    mainWindow.menuBarVisible = false;
    mainWindow.webContents.on('context-menu', (e, params) => {
      e.preventDefault(); // 阻止默认的右键菜单
    });
  }



  registerRendererActionHandlers(mainWindow);
  const templateStore = new Store({name: 'templates'});
  ipcMain.on('set-template', async (event, args) => {
    const { Config, templateName: TemplateName } = args;
    delete Config.globalBackground;
    const lastStore = templateStore.get();
    const newStore = { templates: [...(lastStore.templates || []).filter(t=> t.TemplateName !== TemplateName), {
        id: new Date().getTime(),
        TemplateName,
        Config
      }]}
    templateStore.set(newStore);
    mainWindow.webContents.send(args.returnChannel);
  });
  ipcMain.on('edit-template', async (event, args) => {
    const { id, templateName: TemplateName } = args;
    const lastStore = templateStore.get();
    const editingItem = (lastStore.templates || []).find(t=> t.id === id);
    if(editingItem) {
      editingItem.TemplateName = TemplateName;
      templateStore.set(lastStore);
    }
    mainWindow.webContents.send(args.returnChannel);
  });
  ipcMain.on('delete-template', async (event, args) => {
    const { id } = args;
    const lastStore = templateStore.get();
    const newStore =  { templates: (lastStore.templates || []).filter(t=> t.id !== id) }
    templateStore.set(newStore);
    mainWindow.webContents.send(args.returnChannel);
  });
  ipcMain.on('get-template', async (event, args) => {
    const lastStore = templateStore.get();
    mainWindow.webContents.send(args.returnChannel, (lastStore.templates || []));
  });

  ipcMain.on('version', async (event, args) => {
    mainWindow.webContents.send(args.returnChannel, getAppVersion());
  });

  const filePath = process.argv.find(arg => arg.endsWith('.cpnp'))
  if (filePath) {
    setTimeout(()=>{
      readFileToData(filePath).then(toRenderData => {
        renderLog(filePath, toRenderData);
        mainWindow.webContents.send('open-project-file', toRenderData);
      });
    },100)
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

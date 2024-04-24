const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const url = require('url')

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // and load the index.html of the app.
  const startUrl = process.env.WEB_URL || url.format({
    pathname: path.join(__dirname, './build/index.html'),
    protocol: 'file',
    slashes: true
  })
  mainWindow.loadURL(startUrl);

  mainWindow.on("ready-to-show", () => {
    mainWindow.webContents.openDevTools();
  });

  ipcMain.on('open-image', (event, args) => {
    const { properties = [], returnChannel } = args;
    dialog.showOpenDialog({
      filters: [
        { name: 'Image File', extensions: ['jpg', 'png', 'gif'] }
      ],
      properties: ['openFile', ...properties],
    }).then((result) => {
      if (!result.canceled) {
        mainWindow.webContents.send(returnChannel, result.filePaths);
      }
    }).catch((err) => {
      console.error(err);
    });
  });
};

app.whenReady().then(() => {
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});



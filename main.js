const { app, BrowserWindow, dialog, ipcMain } = require('electron');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    webPreferences: {
      webSecurity:false,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow.loadURL('http://localhost:3000/');
}
app.whenReady().then(() => {
  createWindow()
})

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

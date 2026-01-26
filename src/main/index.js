import electron, { app, BrowserWindow, shell, protocol } from 'electron';
import { registerRendererActionHandlers } from './ele_action';
import { OverviewStorage } from './ele_action/handlers/file_render/Utils';
import { ImageStorage } from './ele_action/handlers/file_render/Utils';

if (typeof electron === 'string') {
  throw new TypeError('Not running in an Electron environment!');
}

const {env} = process; // eslint-disable-line n/prefer-global/process
const isEnvSet = 'ELECTRON_IS_DEV' in env;
const getFromEnv = Number.parseInt(env.ELECTRON_IS_DEV, 10) === 1;
export const isDev = isEnvSet ? getFromEnv : !electron?.app?.isPackaged;



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

};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {

  // ✅ 注册 cardrac:// 协议（使用 registerBufferProtocol）
  protocol.registerBufferProtocol('cardrac', (request, callback) => {
    try {
      const url = request.url;
      console.log('Protocol handler called:', url);

      const urlObj = new URL(url);
      const pathname = urlObj.pathname; // /image/C%3A...
      const quality = urlObj.searchParams.get('quality') || 'high';

      // ✅ 解码 URL 编码的路径
      let imagePath = decodeURIComponent(pathname.replace('/image/', ''));
      if (imagePath.startsWith('/')) {
        imagePath = imagePath.substring(1);
      }
      console.log('Decoded image path:', imagePath);

      // ✅ 根据清晰度选择存储
      const storage = quality === 'low' ? OverviewStorage : ImageStorage;
      const imageData = storage[imagePath];

      if (imageData) {
        // ✅ 将 base64 转换为 Buffer
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // ✅ 根据扩展名确定 MIME 类型
        const ext = imagePath.split('.').pop().toLowerCase();
        const mimeTypes = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp'
        };
        const mimeType = mimeTypes[ext] || 'image/png';

        console.log('Returning image, size:', buffer.length, 'type:', mimeType);
        callback({ data: buffer, mimeType });
      } else {
        console.error('Image not found in storage:', imagePath);
        console.log('Available keys:', Object.keys(storage).slice(0, 5));
        callback({ error: -6 }); // FILE_NOT_FOUND
      }
    } catch (error) {
      console.error('Protocol handler error:', error);
      callback({ error: -2 }); // FAILED
    }
  });

  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('web-contents-created', (event, webContents) => {
  webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
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

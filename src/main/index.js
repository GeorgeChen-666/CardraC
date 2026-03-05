import { app, BrowserWindow, shell, protocol } from 'electron';
import { registerRendererActionHandlers } from './ele_action';
import { OverviewStorage } from './file_render/utils';
import { ImageStorage } from './file_render/utils';
import { waitCondition } from '../shared/functions';
import { run } from './server';
import { isDev } from './functions';

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
  run();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {

  protocol.handle('cardrac', async (request) => {
    const createResponse = (data, mimeType) => {
      const emptySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <rect width="100" height="100" fill="transparent"/>
</svg>`;

      return new Response(data ?? emptySvg, {
        headers: {
          'Content-Type': mimeType,
        }
      });
    };

    try {
      const url = request.url;
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const quality = urlObj.searchParams.get('quality') || 'high';

      let imagePath = decodeURIComponent(pathname.replace('/image/', ''));
      if (imagePath.startsWith('/')) {
        imagePath = imagePath.substring(1);
      }
      const storage = quality === 'low' ? OverviewStorage : ImageStorage;

      const pathVariants = [
        imagePath,
        imagePath.replace(/\//g, '\\'),
        imagePath.replace(/\\/g, '/'),
        imagePath.replaceAll('\\', ''),
      ];

      let imageData = null;
      let foundPath = null;

      for (const variant of pathVariants) {
        if (storage[variant]) {
          imageData = storage[variant];
          foundPath = variant;
          break;
        }
      }

      if (!imageData) {
        await waitCondition(
          () => {
            for (const variant of pathVariants) {
              if (storage[variant]) {
                imageData = storage[variant];
                foundPath = variant;
                return true;
              }
            }
            return false;
          },
          50,
          3000
        );
      }

      if (!imageData) {
        return createResponse(null, 'image/svg+xml');
      }

      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const ext = imagePath.split('.').pop().toLowerCase();
      const mimeTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp'
      };
      const mimeType = mimeTypes[ext] || 'image/png';

      return createResponse(buffer, mimeType);

    } catch (error) {
      console.error('Protocol handler error:', error);
      return createResponse(null, 'image/svg+xml');
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

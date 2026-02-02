import { dialog, ipcMain } from 'electron';
import { eleActions } from '../../../shared/constants';
import { getConfigStore, saveDataToFile } from '../functions';
import fs from 'fs';
import { defaultImageStorage, ImageStorage, OverviewStorage } from './file_render/utils';


const refreshCardStorage = (CardList, globalBackground) => {
  const usedImagePath = new Set();
  CardList.forEach(card => {
    const {face,back} = card;
    const facePathKey  = face?.path.replaceAll('\\','');
    const backPathKey  = back?.path.replaceAll('\\','');
    usedImagePath.add(facePathKey);
    usedImagePath.add(backPathKey);
  });

  if(globalBackground?.path) {
    const globalBackPathKey = globalBackground?.path?.replaceAll('\\','');
    usedImagePath.add(globalBackPathKey);
  }

  OverviewStorage.keys().filter(key => !usedImagePath.has(key)).forEach(key => {
    delete OverviewStorage[key];
  });

  ImageStorage.keys().filter(key => !usedImagePath.has(key)).forEach(key => {
    delete ImageStorage[key];
  });
}
const loadCpnpFile = async (filePath, { onProgress, onFinish, onError }) => {
  try {
    const { size } = fs.statSync(filePath);
    const readStream = fs.createReadStream(filePath);
    let resultString = '';

    //使用 Promise 包装流式读取
    await new Promise((resolve, reject) => {
      readStream.on('data', (chunk) => {
        resultString += chunk;
        onProgress && onProgress(resultString.length / size);
      });

      readStream.on('end', () => resolve());
      readStream.on('error', (err) => reject(err));
    });

    //解析 JSON
    const projectJson = JSON.parse(resultString);

    //清空现有存储
    ImageStorage.clear();
    OverviewStorage.clear();

    //加载 ImageStorage（过滤空对象）
    if (projectJson.ImageStorage) {
      Object.entries(projectJson.ImageStorage).forEach(([key, value]) => {
        //检查值是否有效
        if (value && typeof value === 'string' && value.length > 0) {
          ImageStorage[key] = value;
        } else if (value && typeof value === 'object' && Object.keys(value).length === 0) {
          console.warn(`⚠️ Skipping empty object for key: ${key}`);
        } else {
          console.warn(`⚠️ Invalid value for key: ${key}`, value);
        }
      });

      // 确保默认图片存在
      if (!ImageStorage['_emptyImg']) {
        ImageStorage['_emptyImg'] = defaultImageStorage['_emptyImg'];
      }
    }

    //加载 OverviewStorage
    if (projectJson.OverviewStorage) {
      Object.entries(projectJson.OverviewStorage).forEach(([key, value]) => {
        if (value && typeof value === 'string' && value.length > 0) {
          OverviewStorage[key] = value;
        } else {
          console.warn(`⚠️ Invalid overview value for key: ${key}`);
        }
      });
    }

    //处理特殊值
    if (projectJson.Config?.globalBackground?.path === '_emptyImg') {
      projectJson.Config.globalBackground = null;
    }

    projectJson.CardList?.forEach(c => {
      if (c.face?.path === '_emptyImg') c.face = null;
      if (c.back?.path === '_emptyImg') c.back = null;
    });

    //清理临时数据
    delete projectJson.ImageStorage;
    delete projectJson.OverviewStorage;

    //现在才调用 onFinish
    onFinish && onFinish(projectJson);

  } catch (e) {
    console.error('Failed to load project:', e);
    onError && onError();
  }
};

export default (mainWindow) => {
  const renderLog = (...args) => setTimeout(() => mainWindow.webContents.send('console', args), 2000) ;

  const filePath = process.argv.find(arg => arg.endsWith('.cpnp'));
  if (filePath) {
    setTimeout(() => {
      loadCpnpFile(filePath, {
        //onProgress: (v) => mainWindow.webContents.send(progressChannel, v),
        onFinish: (projectJson) => mainWindow.webContents.send('open-project-file', projectJson),
        onError: () => {
          mainWindow.webContents.send('notification', {
            status: 'error',
            description: "util.invalidFile"
          });
          //mainWindow.webContents.send(returnChannel, null);
        }
      });
    }, 1000);

  }

  ipcMain.on(eleActions.saveProject, async (event, args) => {
    const { CardList, globalBackground, returnChannel, progressChannel } = args;

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Project',
      defaultPath: 'myProject.cpnp',
      filters: [
        { name: 'Project file', extensions: ['cpnp'] }
      ]
    });

    if (result.canceled) {
      mainWindow.webContents.send(returnChannel, false);
      return;
    }

    try {
      const projectPath = result.filePath;
      const { Config } = getConfigStore();
      Config.globalBackground = globalBackground;
      const projectData = { Config, CardList };

      // 清理未使用的图片
      refreshCardStorage(CardList, globalBackground);

      //使用异步版本，等待所有磁盘写入完成
      console.log('📦 Preparing to save project...');
      progressChannel && mainWindow.webContents.send(progressChannel, 0.1);

      const imageStorageObj = await ImageStorage.toPlainObjectAsync();
      progressChannel && mainWindow.webContents.send(progressChannel, 0.5);

      const overviewStorageObj = await OverviewStorage.toPlainObjectAsync();
      progressChannel && mainWindow.webContents.send(progressChannel, 0.8);

      //验证数据完整性
      const emptyImageKeys = Object.keys(imageStorageObj).filter(key => {
        const value = imageStorageObj[key];
        return !value || (typeof value === 'object' && Object.keys(value).length === 0);
      });

      if (emptyImageKeys.length > 0) {
        console.error(`❌ Found ${emptyImageKeys.length} empty image values:`, emptyImageKeys);
        throw new Error(`Failed to save: ${emptyImageKeys.length} images have no data`);
      }

      await saveDataToFile({
        ...projectData,
        ImageStorage: imageStorageObj,
        OverviewStorage: overviewStorageObj
      }, projectPath);

      progressChannel && mainWindow.webContents.send(progressChannel, 1);
      console.log('✅ Project saved successfully');
      mainWindow.webContents.send(returnChannel, true);

    } catch (e) {
      console.error('❌ Save project failed:', e);
      mainWindow.webContents.send('notification', {
        status: 'error',
        description: "util.operationFailed"
      });
      mainWindow.webContents.send(returnChannel, false);
    }
  });

  ipcMain.on(eleActions.openProject, async (event, args) => {
    const { properties = [], returnChannel, progressChannel } = args;
    const result = await dialog.showOpenDialog(mainWindow,{
      filters: [
        { name: 'Project File', extensions: ['cpnp'] }
      ],
      properties: ['openFile', ...properties],
    });
    if (result.canceled) {
      mainWindow.webContents.send(returnChannel, null);
    }
    else {
      await loadCpnpFile(result.filePaths[0], {
        onProgress: (v) => mainWindow.webContents.send(progressChannel, v),
        onFinish: (projectJson) => mainWindow.webContents.send(returnChannel, projectJson),
        onError: () => {
          mainWindow.webContents.send('notification', {
            status: 'error',
            description: "util.invalidFile"
          });
          mainWindow.webContents.send(returnChannel, null);
        }
      });

    }


  });
}
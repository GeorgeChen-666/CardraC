import { dialog, ipcMain } from 'electron';
import { eleActions } from '../../../shared/constants';
import { getConfigStore, saveDataToFile } from '../functions';
import fs from 'fs';
import { defaultImageStorage, ImageStorage, OverviewStorage } from './file_render/utils';
import { parser } from 'stream-json';
import { streamObject } from 'stream-json/streamers/StreamObject';


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

    // ✅ 清空现有存储
    ImageStorage.clear();
    OverviewStorage.clear();

    // ✅ 用于存储非图片数据
    const projectData = {};
    let processedBytes = 0;
    let imageCount = 0;
    let overviewCount = 0;

    // ✅ 创建流式 JSON 解析器
    const pipeline = readStream
      .pipe(parser())
      .pipe(streamObject());

    // ✅ 监听每个 key-value 对
    pipeline.on('data', ({ key, value }) => {
      // 更新进度（基于已处理的数据量估算）
      processedBytes += JSON.stringify(value).length;
      onProgress && onProgress(Math.min(processedBytes / size, 0.95));

      if (key === 'ImageStorage') {
        // ✅ 流式处理 ImageStorage
        if (value && typeof value === 'object') {
          Object.entries(value).forEach(([imgKey, imgValue]) => {
            if (imgValue && typeof imgValue === 'string' && imgValue.length > 0) {
              ImageStorage[imgKey] = imgValue;
              imageCount++;

              // 每处理 10 张图片输出一次日志
              if (imageCount % 10 === 0) {
                console.log(`📦 Loaded ${imageCount} images...`);
              }
            } else if (imgValue && typeof imgValue === 'object' && Object.keys(imgValue).length === 0) {
              console.warn(`⚠️ Skipping empty object for key: ${imgKey}`);
            } else {
              console.warn(`⚠️ Invalid value for key: ${imgKey}`, imgValue);
            }
          });
        }

        // 确保默认图片存在
        if (!ImageStorage['_emptyImg']) {
          ImageStorage['_emptyImg'] = defaultImageStorage['_emptyImg'];
        }

        console.log(`✅ Loaded ${imageCount} images from ImageStorage`);
      }
      else if (key === 'OverviewStorage') {
        // ✅ 流式处理 OverviewStorage
        if (value && typeof value === 'object') {
          Object.entries(value).forEach(([ovKey, ovValue]) => {
            if (ovValue && typeof ovValue === 'string' && ovValue.length > 0) {
              OverviewStorage[ovKey] = ovValue;
              overviewCount++;
            } else {
              console.warn(`⚠️ Invalid overview value for key: ${ovKey}`);
            }
          });
        }

        console.log(`✅ Loaded ${overviewCount} overviews from OverviewStorage`);
      }
      else {
        // ✅ 其他数据直接存储
        projectData[key] = value;
      }
    });

    // ✅ 流处理完成
    await new Promise((resolve, reject) => {
      pipeline.on('end', resolve);
      pipeline.on('error', reject);
    });

    // ✅ 处理特殊值
    if (projectData.Config?.globalBackground?.path === '_emptyImg') {
      projectData.Config.globalBackground = null;
    }

    projectData.CardList?.forEach(c => {
      if (c.face?.path === '_emptyImg') c.face = null;
      if (c.back?.path === '_emptyImg') c.back = null;
    });

    // ✅ 完成
    onProgress && onProgress(1);
    console.log(`✅ Project loaded: ${imageCount} images, ${overviewCount} overviews`);
    onFinish && onFinish(projectData);

  } catch (e) {
    console.error('❌ Failed to load project:', e);
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
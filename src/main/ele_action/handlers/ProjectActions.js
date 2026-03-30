import { ipcMain } from 'electron';
import { eleActions } from '../../../shared/constants';
import fs from 'fs';
import { parser } from 'stream-json';
import { streamObject } from 'stream-json/streamers/StreamObject';
import { defaultImageStorage, getConfigStore, ImageStorage, OverviewStorage } from '../../services/store';
import { homeDir } from '../../../shared/functions';
import { fixPath } from '../../utils';
import { saveDataToFile } from '../../functions';


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
    const readStream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 });

    OverviewStorage.clear();

    //用于存储非图片数据
    const projectData = {};
    let processedBytes = 0;
    let overviewCount = 0;
    let lastProgressUpdate = 0;

    const homeDirRegex = new RegExp(homeDir.replace(/\\/g, '\\\\'), 'g');
    const BATCH_SIZE = 50;

    const pipeline = readStream
      .pipe(parser())
      .pipe(streamObject());

    pipeline.on('data', ({ key, value }) => {
      processedBytes += JSON.stringify(value).length;

      const now = Date.now();
      if (now - lastProgressUpdate > 100) {
        onProgress && onProgress(Math.min(processedBytes / size * 0.6, 0.6));
        lastProgressUpdate = now;
      }

      if (key === 'CardList') {
        projectData.CardList = value.map(card => ({
          ...card,
          face: { ...(card.face || {}), path: fixPath(card.face?.path)},
          back: { ...(card.back || {}), path: fixPath(card.back?.path)},
        }));
      }
      else if (key === 'Config') {
        projectData.Config = {
          ...value,
          globalBackground: value.globalBackground ? {
            ...value.globalBackground,
            path: fixPath(value.globalBackground.path)
          } : null
        };
      }
      else if (key === 'OverviewStorage') {
        if (value && typeof value === 'object') {
          const entries = Object.entries(value);

          for (let i = 0; i < entries.length; i += BATCH_SIZE) {
            const batch = entries.slice(i, i + BATCH_SIZE);

            batch.forEach(([ovKey, ovValue]) => {
              if (ovValue && typeof ovValue === 'string' && ovValue.length > 0) {
                OverviewStorage[ovKey.replace(homeDirRegex, '~')] = ovValue;
                overviewCount++;
              }
            });
          }
        }
        console.log(`✅ Loaded ${overviewCount} overviews`);
      }
    });

    await new Promise((resolve, reject) => {
      pipeline.on('end', resolve);
      pipeline.on('error', reject);
    });

    if (projectData.Config?.globalBackground?.path === '_emptyImg') {
      projectData.Config.globalBackground = null;
    }

    projectData.CardList?.forEach(c => {
      if (c.face?.path === '_emptyImg') c.face = null;
      if (c.back?.path === '_emptyImg') c.back = null;
    });

    onProgress && onProgress(0.6);
    console.log('✅ Returning project data...');
    onFinish && onFinish(projectData);

    setImmediate(() => {
      loadImageStorageAsync(filePath, homeDirRegex, BATCH_SIZE, onProgress);
    });

  } catch (e) {
    console.error('❌ Failed:', e);
    onError && onError(e);
  }
};

async function loadImageStorageAsync(filePath, homeDirRegex, BATCH_SIZE, onProgress) {
  try {
    ImageStorage.clear();

    const readStream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 });
    let imageCount = 0;

    const pipeline = readStream
      .pipe(parser())
      .pipe(streamObject());

    pipeline.on('data', ({ key, value }) => {
      if (key === 'ImageStorage' && value && typeof value === 'object') {
        const entries = Object.entries(value);

        for (let i = 0; i < entries.length; i += BATCH_SIZE) {
          const batch = entries.slice(i, i + BATCH_SIZE);

          batch.forEach(([imgKey, imgValue]) => {
            if (imgValue && typeof imgValue === 'string' && imgValue.length > 0) {
              ImageStorage[imgKey.replace(homeDirRegex, '~')] = imgValue;
              imageCount++;

              if (imageCount % 10 === 0) {
                console.log(`📦 Background: ${imageCount} images...`);
                onProgress && onProgress(0.6 + (imageCount / entries.length) * 0.4);
              }
            } else if (imgValue && typeof imgValue === 'object' && Object.keys(imgValue).length === 0) {
              console.warn(`⚠️ Skipping empty object: ${imgKey}`);
            } else {
              console.warn(`⚠️ Invalid value: ${imgKey}`);
            }
          });
        }

        if (!ImageStorage['_emptyImg']) {
          ImageStorage['_emptyImg'] = defaultImageStorage['_emptyImg'];
        }

        console.log(`✅ Background complete: ${imageCount} images`);
      }
    });

    await new Promise((resolve, reject) => {
      pipeline.on('end', resolve);
      pipeline.on('error', reject);
    });

    onProgress && onProgress(1);

  } catch (e) {
    console.error('❌ Background loading failed:', e);
  }
}

export default (mainWindow) => {
  const renderLog = (...args) => setTimeout(() => wsManager.send('console', args), 2000) ;

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
    const { CardList, globalBackground, returnChannel, progressChannel, filePath } = args;

    try {
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
      }, filePath);

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
    const { returnChannel, progressChannel, filePath } = args;
    await loadCpnpFile(filePath, {
      onProgress: (v) => progressChannel && mainWindow.webContents.send(progressChannel, v),
      onFinish: (projectJson) => mainWindow.webContents.send(returnChannel, projectJson),
      onError: () => {
        mainWindow.webContents.send('notification', {
          status: 'error',
          description: "util.invalidFile"
        });
        mainWindow.webContents.send(returnChannel, null);
      }
    });
  });
}
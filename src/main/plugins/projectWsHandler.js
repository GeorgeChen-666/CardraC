import { eleActions } from '../../shared/constants';
import { getConfigStore, saveDataToFile } from '../functions';
import fs from 'fs';
import { defaultImageStorage, ImageStorage, OverviewStorage } from '../file_render/utils';
import { parser } from 'stream-json';
import { streamObject } from 'stream-json/streamers/StreamObject';
import { fixPath, homeDir } from '../utils';


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

    // 清空现有存储
    ImageStorage.clear();
    OverviewStorage.clear();

    // 用于存储非图片数据
    const projectData = {};
    let processedBytes = 0;
    let imageCount = 0;
    let overviewCount = 0;

    // 创建流式 JSON 解析器
    const pipeline = readStream
      .pipe(parser())
      .pipe(streamObject());

    // 监听每个 key-value 对
    pipeline.on('data', ({ key, value }) => {
      processedBytes += JSON.stringify(value).length;
      onProgress && onProgress(Math.min(processedBytes / size, 0.95));

      if (key === 'ImageStorage') {
        if (value && typeof value === 'object') {
          Object.entries(value).forEach(([imgKey, imgValue]) => {
            if (imgValue && typeof imgValue === 'string' && imgValue.length > 0) {
              const fixedImgKey = imgKey.replace(homeDir.replaceAll('\\', ''), '~')
              ImageStorage[fixedImgKey] = imgValue;
              imageCount++;

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

        if (!ImageStorage['_emptyImg']) {
          ImageStorage['_emptyImg'] = defaultImageStorage['_emptyImg'];
        }

        console.log(`✅ Loaded ${imageCount} images from ImageStorage`);
      }
      else if (key === 'OverviewStorage') {
        if (value && typeof value === 'object') {
          Object.entries(value).forEach(([ovKey, ovValue]) => {
            if (ovValue && typeof ovValue === 'string' && ovValue.length > 0) {
              const fixedImgKey = ovKey.replace(homeDir.replaceAll('\\', ''), '~')
              OverviewStorage[fixedImgKey] = ovValue;
              overviewCount++;
            } else {
              console.warn(`⚠️ Invalid overview value for key: ${ovKey}`);
            }
          });
        }
        console.log(`✅ Loaded ${overviewCount} overviews from OverviewStorage`);
      }
      else if (key === 'CardList') {
        projectData[key] = value.map(card => ({
          ...card,
          face: { ...(card.face || {}), path: fixPath(card.face?.path)},
          back: { ...(card.back || {}), path: fixPath(card.back?.path)},
        }))
      }
      else if (key === 'Config') {
        projectData[key] = {
          ...value,
          globalBackground: {
            ...(value.globalBackground || {}),
            path: fixPath(value.globalBackground?.path)
          }
        }
      }
      else {
        projectData[key] = value;
      }
    });

    // 流处理完成
    await new Promise((resolve, reject) => {
      pipeline.on('end', resolve);
      pipeline.on('error', reject);
    });

    // 处理特殊值
    if (projectData.Config?.globalBackground?.path === '_emptyImg') {
      projectData.Config.globalBackground = null;
    }

    projectData.CardList?.forEach(c => {
      if (c.face?.path === '_emptyImg') c.face = null;
      if (c.back?.path === '_emptyImg') c.back = null;
    });

    // 完成
    onProgress && onProgress(1);
    console.log(`✅ Project loaded: ${imageCount} images, ${overviewCount} overviews`);
    onFinish && onFinish(projectData);

  } catch (e) {
    console.error('❌ Failed to load project:', e);
    onError && onError(e);
  }
};


export default (wsManager) => {
  const renderLog = (...args) => setTimeout(() => wsManager.send('console', args), 2000) ;

  const filePath = process.argv.find(arg => arg.endsWith('.cpnp'));
  if (filePath) {
    setTimeout(() => {
      loadCpnpFile(filePath, {
        //onProgress: (v) => mainWindow.webContents.send(progressChannel, v),
        onFinish: (projectJson) => wsManager.send('open-project-file', projectJson),
        onError: () => {
          wsManager.send('notification', {
            status: 'error',
            description: "util.invalidFile"
          });
          //mainWindow.webContents.send(returnChannel, null);
        }
      });
    }, 1000);

  }

  wsManager.on(eleActions.saveProject, async (event, args) => {
    const { CardList, globalBackground, returnChannel, progressChannel, filePath } = args;

    try {
      const { Config } = getConfigStore();
      Config.globalBackground = globalBackground;
      const projectData = { Config, CardList };

      // 清理未使用的图片
      refreshCardStorage(CardList, globalBackground);

      //使用异步版本，等待所有磁盘写入完成
      console.log('📦 Preparing to save project...');
      progressChannel && wsManager.send(progressChannel, 0.1);

      const imageStorageObj = await ImageStorage.toPlainObjectAsync();
      progressChannel && wsManager.send(progressChannel, 0.5);

      const overviewStorageObj = await OverviewStorage.toPlainObjectAsync();
      progressChannel && wsManager.send(progressChannel, 0.8);

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

      progressChannel && wsManager.send(progressChannel, 1);
      console.log('✅ Project saved successfully');
      wsManager.send(returnChannel, true);

    } catch (e) {
      console.error('❌ Save project failed:', e);
      wsManager.send('notification', {
        status: 'error',
        description: "util.operationFailed"
      });
      wsManager.send(returnChannel, false);
    }
  });

  wsManager.on(eleActions.openProject, async (event, args) => {
    const { returnChannel, progressChannel, filePath } = args;
    await loadCpnpFile(filePath, {
      onProgress: (v) => progressChannel && wsManager.send(progressChannel, v),
      onFinish: (projectJson) => wsManager.send(returnChannel, projectJson),
      onError: () => {
        wsManager.send('notification', {
          status: 'error',
          description: "util.invalidFile"
        });
        wsManager.send(returnChannel, null);
      }
    });
  });
}
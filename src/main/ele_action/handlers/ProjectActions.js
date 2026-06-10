import { ipcMain } from 'electron';
import { eleActions } from '../../../shared/constants';
import fs from 'fs';
import { parser } from 'stream-json';
import { chain } from 'stream-chain';
import { defaultImageStorage, getConfigStore, ImageStorage, OverviewStorage } from '../../services/store';
import { fixPath } from '../../../shared/functions';
import { taskPool } from '../../core/TaskPool';
import { refreshCardStorage } from '../functions';



const loadCpnpFile = async (filePath, { onProgress, onFinish, onError }) => {
  try {
    const { size } = fs.statSync(filePath);
    const readStream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 });

    OverviewStorage.clear();
    ImageStorage.clear();
    taskPool.terminate();

    const projectData = {};
    let imageCount = 0;
    let overviewCount = 0;
    let lastProgressUpdate = 0;

    let stack = [];
    let currentKey = null;

    readStream.on('data', () => {
      const now = Date.now();
      if (now - lastProgressUpdate > 100) {
        const progress = Math.min(readStream.bytesRead / size, 1);
        onProgress?.(progress);
        lastProgressUpdate = now;
      }
    });

    const pipeline = chain([
      readStream,
      parser()
    ]);

    pipeline.on('data', (data) => {
      const { name, value } = data;

      switch (name) {
        case 'startObject':
          stack.push({ type: 'object', key: currentKey, data: {} });
          currentKey = null;
          break;

        case 'endObject':
          const obj = stack.pop();

          if (stack.length === 0) {
          } else if (stack.length === 1) {
            const parentKey = obj.key;

            if (parentKey === 'Config') {
              projectData.Config = {
                ...obj.data,
                globalBackground: obj.data.globalBackground ? {
                  ...obj.data.globalBackground,
                  path: fixPath(obj.data.globalBackground.path)
                } : null
              };
              console.log('✅ Loaded Config');
            }
            else if (parentKey === 'OverviewStorage') {
              Object.entries(obj.data).forEach(([ovKey, ovValue]) => {
                if (ovValue && typeof ovValue === 'string' && ovValue.length > 0) {
                  OverviewStorage[fixPath(ovKey)] = ovValue;
                  overviewCount++;
                }
              });
              console.log(`✅ Loaded ${overviewCount} overviews`);
            }
            else if (parentKey === 'ImageStorage') {
              console.log(`✅ Loaded ${imageCount} images`);
            }
          } else {
            const parent = stack[stack.length - 1];
            if (parent.type === 'object') {
              parent.data[obj.key] = obj.data;
            } else if (parent.type === 'array') {
              parent.data.push(obj.data);
            }
          }
          break;

        case 'startArray':
          stack.push({ type: 'array', key: currentKey, data: [] });
          currentKey = null;
          break;

        case 'endArray':
          const arr = stack.pop();

          if (stack.length === 1 && arr.key === 'CardList') {
            projectData.CardList = arr.data.map(card => ({
              ...card,
              face: { ...(card.face || {}), path: fixPath(card.face?.path) },
              back: { ...(card.back || {}), path: fixPath(card.back?.path) },
            }));
            console.log(`✅ Loaded ${projectData.CardList.length} cards`);
          } else if (stack.length > 0) {
            const parent = stack[stack.length - 1];
            if (parent.type === 'object') {
              parent.data[arr.key] = arr.data;
            } else if (parent.type === 'array') {
              parent.data.push(arr.data);
            }
          }
          break;

        case 'keyValue':
          currentKey = value;
          break;

        case 'stringValue':
        case 'numberValue':
        case 'nullValue':
        case 'trueValue':
        case 'falseValue':
          if (stack.length > 0) {
            const parent = stack[stack.length - 1];

            // ✅ 类型转换
            let actualValue = value;
            if (name === 'numberValue') actualValue = Number(value);
            else if (name === 'trueValue') actualValue = true;
            else if (name === 'falseValue') actualValue = false;
            else if (name === 'nullValue') actualValue = null;

            // ✅ ImageStorage 的值直接赋值
            if (stack.length === 2 &&
              stack[0].type === 'object' &&
              stack[1].key === 'ImageStorage' &&
              currentKey) {

              if (value && typeof value === 'string' && value.length > 0) {
                ImageStorage[fixPath(currentKey)] = actualValue;
                imageCount++;

                if (imageCount % 50 === 0) {
                  console.log(`📦 Loaded ${imageCount} images...`);
                }
              }
              currentKey = null;
            }
            // ✅ 普通值添加到父对象
            else if (parent.type === 'object' && currentKey) {
              parent.data[currentKey] = actualValue;
              currentKey = null;
            } else if (parent.type === 'array') {
              parent.data.push(actualValue);
            }
          }
          break;
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

    if (!await ImageStorage['_emptyImg']) {
      ImageStorage['_emptyImg'] = defaultImageStorage['_emptyImg'];
    }

    onProgress?.(1);
    console.log('✅ All data loaded');
    onFinish && onFinish(projectData);

  } catch (e) {
    console.error('❌ Failed:', e);
    onError && onError(e);
  }
};

const saveCpnpFile = async (projectData, storages, filePath, onProgress) => {
  const { ImageStorage, OverviewStorage } = storages;
  const writeStream = fs.createWriteStream(filePath);

  return new Promise(async (resolve, reject) => {
    try {
      const totalKeys = OverviewStorage.keys().length + ImageStorage.keys().length;
      let processedKeys = 0;
      let lastReportedProgress = 0;

      const updateProgress = () => {
        processedKeys++;
        const currentProgress = 0.2 + (processedKeys / totalKeys) * 0.8;

        if (processedKeys % 10 === 0 || currentProgress - lastReportedProgress >= 0.01) {
          onProgress?.(Math.min(currentProgress, 0.99));
          lastReportedProgress = currentProgress;
        }
      };

      const writeStorage = async (storage) => {
        const keys = storage.keys();

        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          const value = await storage[key];

          if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) {
            continue;
          }

          const line = `    ${JSON.stringify(key)}: ${JSON.stringify(value)}${i < keys.length - 1 ? ',' : ''}\n`;

          if (!writeStream.write(line)) {
            await new Promise(resolve => writeStream.once('drain', resolve));
          }

          updateProgress();
        }
      };

      writeStream.write('{\n');

      writeStream.write(`  "Config": ${JSON.stringify(projectData.Config)},\n`);
      onProgress?.(0.1);

      writeStream.write(`  "CardList": ${JSON.stringify(projectData.CardList)},\n`);
      onProgress?.(0.2);

      writeStream.write('  "OverviewStorage": {\n');
      await writeStorage(OverviewStorage);
      writeStream.write('  },\n');

      writeStream.write('  "ImageStorage": {\n');
      await writeStorage(ImageStorage);
      writeStream.write('  }\n');

      writeStream.write('}\n');

      writeStream.end(() => {
        onProgress?.(1);
        resolve();
      });

      writeStream.on('error', reject);

    } catch (error) {
      writeStream.destroy();
      reject(error);
    }
  });
};

export default (mainWindow) => {
  const renderLog = (...args) => setTimeout(() => wsManager.send('console', args), 2000) ;

  const filePath = process.argv.find(arg => arg.endsWith('.cpnp'));
  if (filePath) {
    setTimeout(() => {
      loadCpnpFile(filePath, {
        //onProgress: (v) => mainWindow.webContents.send(progressChannel, v),
        onFinish: (projectJson) => mainWindow.webContents.send(eleActions.backendUiFillState, projectJson),
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
      console.log('📦 Preparing to save project...');
      progressChannel && mainWindow.webContents.send(progressChannel, 0.05);
      // ✅ 使用流式写入
      await saveCpnpFile(
        projectData,
        { ImageStorage, OverviewStorage },
        filePath,
        (progress) => {
          progressChannel && mainWindow.webContents.send(progressChannel, progress);
        }
      );
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
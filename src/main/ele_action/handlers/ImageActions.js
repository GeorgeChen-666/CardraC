import { dialog, ipcMain, protocol } from 'electron';
import log from 'electron-log';
import fs from 'fs';

import { getConfigStore, readCompressedImage } from '../functions';
import { eleActions, layoutSides } from '../../../shared/constants';
import { getPagedImageListByCardList, ImageStorage, OverviewStorage } from './file_render/Utils';
import { SVGAdapter } from './file_render/adapter/SVGAdapter';
import { exportFile } from './file_render';

// 配置日志
log.transports.file.level = 'debug';
log.transports.console.level = 'debug';

const ImageStorageLoadingJobs = {

}
const pendingList = new Set();
export const getPendingList = () => pendingList;

const pathToImageData = async (path, cb) => {
  const { Config } = getConfigStore();
  const cardWidth = Config.cardWidth;
  const compressLevel = Config.compressLevel || 2;
  const compressParamsList = [
    { maxWidth : cardWidth * 15, quality : 100},
    { maxWidth : cardWidth * 12, quality : 90},
    { maxWidth : cardWidth * 9, quality : 80},
    { maxWidth : cardWidth * 6, quality : 70},
  ]

  const ext = path.split('.').pop();
  const imagePathKey = path.replaceAll('\\','');
  const { mtime } = fs.statSync(path);
  const returnObj = { path, mtime: mtime.getTime() }

  if(!Object.keys(ImageStorage).includes(imagePathKey) && !pendingList.has(imagePathKey)) {
    pendingList.add(imagePathKey);
    ImageStorageLoadingJobs[path] = async() => {
      ImageStorage[imagePathKey] = await readCompressedImage(path, { format: ext, ...compressParamsList[compressLevel - 1] });
      pendingList.delete(imagePathKey);
      delete ImageStorageLoadingJobs[path];
    }
    ImageStorageLoadingJobs[path]();
  }
  returnObj.overviewData = await readCompressedImage(path, { maxWidth: 100 });
  OverviewStorage[imagePathKey] = returnObj.overviewData;
  cb && cb();
  return returnObj;
}


// 在文件顶部添加缓存
const previewCache = new Map(); // 存储已完成的预览
const previewTasks = new Map(); // 存储进行中的任务


// 预渲染函数
async function prerenderPage(pageIndex, state, Config) {
  const cacheKey = `${pageIndex}`;

  if (previewCache.has(cacheKey)) {
    return previewCache.get(cacheKey);
  }

  if (previewTasks.has(cacheKey)) {
    return previewTasks.get(cacheKey);
  }

  const task = (async () => {
    try {
      const doc = new SVGAdapter(Config, 'low', true);
      const svgString = await exportFile(doc, state, [pageIndex]);

      const result = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

      previewCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error(`Failed to prerender page ${pageIndex}:`, error);
      throw error;
    } finally {
      previewTasks.delete(cacheKey);
    }
  })();

  previewTasks.set(cacheKey, task);
  return task;
}





export default (mainWindow) => {

  ipcMain.on(eleActions.getExportPageCount, async (event, args) => {
    const { CardList, globalBackground, returnChannel } = args;
    const { Config } = getConfigStore();
    const state = { CardList, globalBackground };
    const pagedImageList = getPagedImageListByCardList(state, Config);
    const isFoldInHalf = Config.sides === layoutSides.foldInHalf;
    mainWindow.webContents.send(returnChannel, isFoldInHalf ? pagedImageList.length / 2 : pagedImageList.length);
  });
  // 获取预览
  ipcMain.handle(eleActions.getExportPreview, async (event, args) => {
    const { pageIndex, CardList, globalBackground } = args;
    const { Config } = getConfigStore();
    const state = { CardList, globalBackground };

    // 实际索引（pageIndex 从 1 开始）
    const actualIndex = pageIndex - 1;

    // ✅ 获取总页数
    const pagedImageList = getPagedImageListByCardList(state, Config);
    const isFoldInHalf = Config.sides === layoutSides.foldInHalf;
    const totalPages = isFoldInHalf ? pagedImageList.length / 2 : pagedImageList.length;

    // ✅ 获取当前页（可能从缓存或等待任务完成）
    const result = await prerenderPage(actualIndex, state, Config);

    // ✅ 异步预渲染接下来的 3 页（不阻塞返回）
    for (let i = 1; i <= 3; i++) {
      const nextIndex = actualIndex + i;
      if (nextIndex < totalPages) {
        prerenderPage(nextIndex, state, Config).catch(err => {
          console.error(`Failed to prerender page ${nextIndex + 1}:`, err);
        });
      }
    }

    return result;
  });

// 清除缓存
  ipcMain.handle(eleActions.clearPreviewCache, async () => {
    previewCache.clear();
    previewTasks.clear();
    console.log('Preview cache cleared');
    return { success: true };
  });
  ipcMain.handle(eleActions.getImageContent, async (event, path) => {
    const imagePathKey = path.replaceAll('\\','');
    return ImageStorage[imagePathKey];
  });
  ipcMain.on(eleActions.getImagePath, async (event, args) => {
    const { properties = [], returnChannel } = args;
    const result = await dialog.showOpenDialog(mainWindow,{
      filters: [
        { name: 'Image File', extensions: ['jpg', 'png', 'gif'] }
      ],
      properties: ['openFile', ...properties],
    });
    if (result.canceled) {
      mainWindow.webContents.send(returnChannel, '');
    }
    else {
      mainWindow.webContents.send(returnChannel, result.filePaths[0]);
    }
  });
  ipcMain.on(eleActions.openImage, async (event, args) => {
    const { properties = [], returnChannel, progressChannel } = args;
    const result = await dialog.showOpenDialog(mainWindow,{
      filters: [
        { name: 'Image File', extensions: ['jpg', 'png', 'gif'] }
      ],
      properties: ['openFile', ...properties],
    });
    if (result.canceled) {
      mainWindow.webContents.send(returnChannel, []);
    }
    else {
      const toRenderData = [];
      let current = 0;
      for(const path of result.filePaths) {
        toRenderData.push(pathToImageData(path, () => {
          current ++;
          mainWindow.webContents.send(progressChannel, current / result.filePaths.length);
        }))
      }
      mainWindow.webContents.send(returnChannel, await Promise.all(toRenderData));
    }
  });
  ipcMain.on(eleActions.checkImage, async (event, args) => {
    const pathList = JSON.parse(JSON.stringify(args.pathList));
    const invalidImages = [];
    const checkImagePath = path => {
      try {
        fs.accessSync(path,fs.constants.F_OK);
      }
      catch (e) {
        invalidImages.push(path);
      }
    }
    pathList.forEach(path => {
      checkImagePath(path);
    })
    mainWindow.webContents.send(args.returnChannel, invalidImages);
  });
  ipcMain.on(eleActions.reloadLocalImage, async (event, args) => {
    const { CardList, globalBackground, returnChannel, progressChannel, cancelChannel } = args;
    const { Config } = getConfigStore();
    Config.globalBackground = globalBackground;

    const reloadImageJobs = [];
    const newOverviewStorage = {};
    Object.keys(ImageStorage).forEach(k => {
      delete ImageStorage[k];
    })

    let isTerminated = false;
    cancelChannel && ipcMain.once(cancelChannel, () => {
      isTerminated = true;
    });

    let totalCount = 0;
    let currentCount = 0;
    const reloadImage = (args, cb) => {
      if(!args) return false;
      const { path, mtime: cardMtime} = args;
      const imagePathKey = path.replaceAll('\\','');
      try {
        const { mtime } = fs.statSync(path);
        if(cardMtime !== mtime.getTime() || !Object.keys(ImageStorage).includes(imagePathKey)) {
          totalCount++;
          reloadImageJobs.push((async()=>{
            if (isTerminated) return;
            cb && cb(mtime.getTime());
            if (isTerminated) return;
            const {overviewData} = await pathToImageData(path);
            if (isTerminated) return;
            newOverviewStorage[imagePathKey] = overviewData;
            OverviewStorage[imagePathKey] = overviewData;
            currentCount++;
            mainWindow.webContents.send(progressChannel, currentCount / totalCount);
          })());
          return true;
        }
        else {
          throw new Error();
        }
      } catch (e) {
        newOverviewStorage[imagePathKey] = OverviewStorage[imagePathKey];
      }
      return false;
    }
    CardList.forEach((card, index) => {

      reloadImage(card.face, newMtime => {
        CardList[index].face.mtime = newMtime;
        // delete CardList[index].id;
      });
      reloadImage(card.back, newMtime => {
        CardList[index].back.mtime = newMtime;
        // delete CardList[index].id;
      });
    });
    reloadImage(Config.globalBackground, newMtime => {
      Config.globalBackground.mtime = newMtime;
    });
    await Promise.all(reloadImageJobs);

    if (isTerminated) {
      mainWindow.webContents.send(returnChannel, {
        isAborted: true
      });
    } else {
      mainWindow.webContents.send(progressChannel, 1);
      mainWindow.webContents.send(returnChannel, {OverviewStorage: newOverviewStorage, CardList, Config});
    }
  });
}
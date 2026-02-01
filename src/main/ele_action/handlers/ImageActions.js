import { dialog, ipcMain, protocol } from 'electron';
import log from 'electron-log';
import fs from 'fs';

import { getConfigStore, readCompressedImage } from '../functions';
import { eleActions, layoutSides } from '../../../shared/constants';
import {
  clearPrerenderCache,
  getPagedImageListByCardList,
  ImageStorage,
  OverviewStorage,
  prerenderPage,
} from './file_render/Utils';
import { colorCache, exportFile } from './file_render';

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
  // returnObj.overviewData = await readCompressedImage(path, { maxWidth: 100 });
  OverviewStorage[imagePathKey] = await readCompressedImage(path, { maxWidth: 100 });
  colorCache.delete(imagePathKey);
  cb && cb();
  return returnObj;
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

    const actualIndex = pageIndex - 1;

    //记录总请求时间
    const requestStartTime = performance.now();
    console.log(`\n📄 Request: Page ${pageIndex}`);

    const pagedImageList = getPagedImageListByCardList(state, Config);
    const isFoldInHalf = Config.sides === layoutSides.foldInHalf;
    const totalPages = isFoldInHalf ? pagedImageList.length / 2 : pagedImageList.length;

    // 获取当前页
    const result = await prerenderPage(actualIndex, state, Config, exportFile, 'exportFile');

    const requestEndTime = performance.now();
    const totalDuration = (requestEndTime - requestStartTime).toFixed(2);
    console.log(`✨ Request completed in ${totalDuration}ms\n`);

    // 异步预渲染接下来的 3 页
    console.log(`🔮 Pre-rendering next 3 pages...`);
    for (let i = 1; i <= 3; i++) {
      const nextIndex = actualIndex + i;
      if (nextIndex < totalPages) {
        prerenderPage(nextIndex, state, Config, exportFile, 'exportFile').catch(err => {
          console.error(`Failed to prerender page ${nextIndex + 1}:`, err);
        });
      }
    }

    return result;
  });


// 清除缓存
  ipcMain.handle(eleActions.clearPreviewCache, async () => {
    clearPrerenderCache();
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
    colorCache.clear();
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
            delete ImageStorage[imagePathKey];
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
      mainWindow.webContents.send(returnChannel, {CardList, Config});
    }
  });
}
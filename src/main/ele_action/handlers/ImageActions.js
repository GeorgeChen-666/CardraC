import { dialog, ipcMain } from 'electron';
import fs from 'fs';
import { eleActions, imageCacheType, layoutSides } from '../../../shared/constants';
import { taskPool } from '../../core/TaskPool';
import { readCompressedImage } from '../../functions';
import { clearPrerenderCache, getConfigStore, ImageStorage, OverviewStorage } from '../../services/store';
import { colorCache, exportFile, prerenderPage } from '../../services/file_render';
import { getPagedImageListByCardList } from '../../services/file_render/utils';
import { expandPath, filePathToImageKey, fixPath, waitTime } from '../../../shared/functions';

const pendingList = new Set();
export const getPendingList = () => pendingList;

const taskFn = (storage) => {
  return async (task, ...args) => {
    if(task.cancelled) return Promise.resolve(null);
    const compressedResult = await readCompressedImage(...args);
    if(task.cancelled) return Promise.resolve(null);
    const imagePathKey = filePathToImageKey(fixPath(args[0]));
    storage[imagePathKey] = compressedResult
  }
}

const compressThumbnail = taskPool.task(taskFn(OverviewStorage), {
  tag: imageCacheType.thumbnails,
  priority: 100,
  uniqueKey: (args) => args[0]
});

const compressHighQuality = taskPool.task(taskFn(ImageStorage), {
  tag: imageCacheType.highQuality,
  priority: 10,
  uniqueKey: (args) => args[0]
});




// taskPool.onBeforeStartByTag(imageCacheType.highQuality, (task) => {
//   task.waitFor(async () => {
//     const state = await cachedCallRender_200('get_render_state');
//     const pathList = extractImagePaths(state);
//     if (!pathList.includes(task.args[0])) {
//       task.cancel();
//     }
//   });
// });

const pathToImageData = (imagePath, cb) => {
  const { Config } = getConfigStore();
  const cardWidth = Config.cardWidth;
  const compressLevel = Config.compressLevel || 2;
  const compressParamsList = [
    { maxWidth: cardWidth * 15, quality: 100, maxDpi: 300 },
    { maxWidth: cardWidth * 12, quality: 90, maxDpi: 200 },
    { maxWidth: cardWidth * 9, quality: 85, maxDpi: 150 },
    { maxWidth: cardWidth * 6, quality: 80, maxDpi: 75 },
  ];

  const ext = 'webp';//imagePath.split('.').pop();
  const imagePathKey = filePathToImageKey(fixPath(imagePath));
  const { mtime } = fs.statSync(expandPath(imagePath));
  const returnObj = { path: fixPath(imagePath), mtime: mtime.getTime() };

  const fixedImagePath = expandPath(imagePath);

  if(!OverviewStorage.keys().includes(imagePathKey)) {
    compressThumbnail(
      fixedImagePath,
      { maxWidth: 100 }
    )
  }

  if(!ImageStorage.keys().includes(imagePathKey)) {
    compressHighQuality(
      fixedImagePath,
      { format: ext, ...compressParamsList[compressLevel - 1] }
    );
  }



  colorCache.delete(imagePathKey);
  cb && cb();
  return returnObj;
};

export default (mainWindow) => {
  ipcMain.on(eleActions.getExportPageCount, async (event, args) => {
    const { CardList, globalBackground, returnChannel } = args;
    const { Config } = getConfigStore();
    const state = { CardList, globalBackground };
    const pagedImageList = getPagedImageListByCardList(state, Config);
    const isFoldInHalf = Config.sides === layoutSides.foldInHalf;
    mainWindow.webContents.send(returnChannel, isFoldInHalf ? pagedImageList.length / 2 : pagedImageList.length);
  });

  ipcMain.on(eleActions.getExportPreview, async (event, args) => {
    const { pageIndex, CardList, globalBackground, returnChannel } = args;
    const { Config } = getConfigStore();
    const state = { CardList, globalBackground };

    const actualIndex = pageIndex - 1;
    const requestStartTime = performance.now();
    console.log(`\n📄 Request: Page ${pageIndex}`);

    const pagedImageList = getPagedImageListByCardList(state, Config);
    const isFoldInHalf = Config.sides === layoutSides.foldInHalf;
    const totalPages = isFoldInHalf ? pagedImageList.length / 2 : pagedImageList.length;

    const result = await prerenderPage(actualIndex, state, Config, exportFile, 'exportFile');

    const requestEndTime = performance.now();
    const totalDuration = (requestEndTime - requestStartTime).toFixed(2);
    console.log(`✨ Request completed in ${totalDuration}ms\n`);

    console.log(`🔮 Pre-rendering next 3 pages...`);
    for (let i = 1; i <= 3; i++) {
      const nextIndex = actualIndex + i;
      if (nextIndex < totalPages) {
        prerenderPage(nextIndex, state, Config, exportFile, 'exportFile').catch(err => {
          console.error(`Failed to prerender page ${nextIndex + 1}:`, err);
        });
      }
    }
    mainWindow.webContents.send(returnChannel, result);
  });

  ipcMain.on(eleActions.clearPreviewCache, async (event, args) => {
    const { returnChannel } = args;
    clearPrerenderCache();
    console.log('Preview cache cleared');
    mainWindow.webContents.send(returnChannel, { success: true });
  });

  ipcMain.on(eleActions.loadImageList, async (event, args) => {
    const { returnChannel, progressChannel, imageList } = args;
    imageList.forEach(imageData => {
      try {
        pathToImageData(imageData.path)
      } catch (e) {
        console.error(`Failed to load image in background: ${imageData.path}`, e);
      }
    });
    let pollInterval;
    if (progressChannel) {
      taskPool.clearCompletedStatsByTag(imageCacheType.thumbnails)
      const startStats = taskPool.getStatsByTag(imageCacheType.thumbnails);
      const expectedTotal = startStats.total;
      pollInterval = setInterval(() => {
        const stats = taskPool.getStatsByTag(imageCacheType.thumbnails);
        const completed = stats.completed + stats.failed + stats.cancelled;
        const progress = Math.min(completed / expectedTotal, 1);
        console.log('progress', progress, `${completed}/${expectedTotal}`, stats)
        mainWindow.webContents.send(progressChannel, progress);
        if (progress >= 1 || expectedTotal === 0) {
          clearInterval(pollInterval);
        }
      }, 100);
    }
    await taskPool.waitTasksByTag(imageCacheType.thumbnails);
    mainWindow.webContents.send(returnChannel, { success: true });
  });

  ipcMain.on(eleActions.checkImage, async (event, args) => {
    const pathList = JSON.parse(JSON.stringify(args.pathList));
    const invalidImages = [];

    const checkImagePath = path => {
      try {
        fs.accessSync(path, fs.constants.F_OK);
      } catch (e) {
        invalidImages.push(path);
      }
    };

    pathList.forEach(path => {
      checkImagePath(expandPath(path));
    });

    mainWindow.webContents.send(args.returnChannel, invalidImages);
  });

  ipcMain.on(eleActions.reloadLocalImage, async (event, args) => {
    const { CardList, globalBackground, returnChannel, progressChannel, cancelChannel } = args;
    const { Config } = getConfigStore();
    Config.globalBackground = globalBackground;

    const reloadImageJobs = [];
    colorCache.clear();

    taskPool.cancelTasksByTag(imageCacheType.thumbnails)
    taskPool.cancelTasksByTag(imageCacheType.highQuality)
    OverviewStorage.clear()
    ImageStorage.clear()

    let isTerminated = false;

    cancelChannel && ipcMain.once(cancelChannel, () => {
      isTerminated = true;
    });

    let totalCount = 0;
    let currentCount = 0;
    const alreadyKnownKey = new Set();

    const reloadImage = (args, cb) => {
      if (!args) return false;

      const { path: imagePath, mtime: cardMtime } = args;
      const imagePathKey = filePathToImageKey(fixPath(imagePath));

      try {
        const { mtime } = fs.statSync(expandPath(imagePath));

        if (cardMtime !== mtime.getTime() || !alreadyKnownKey.has(imagePathKey)) {
          totalCount++;
          alreadyKnownKey.add(imagePathKey);
          reloadImageJobs.push((async () => {
            if (isTerminated) return;
            cb && cb(mtime.getTime());
            pathToImageData(imagePath);
            if (isTerminated) return;
            currentCount++;
            mainWindow.webContents.send(progressChannel, currentCount / totalCount);
          })());
          return true;
        } else {
          throw new Error();
        }
      } catch (e) {
      }
      return false;
    };

    CardList.forEach((card, index) => {
      reloadImage(card.face, newMtime => {
        CardList[index].face.mtime = newMtime;
      });
      reloadImage(card.back, newMtime => {
        CardList[index].back.mtime = newMtime;
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
      mainWindow.webContents.send(returnChannel, { CardList, Config });
    }
  });
};

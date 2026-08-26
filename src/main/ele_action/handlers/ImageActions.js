import { ipcMain, protocol } from 'electron';
import fs from 'fs';
import { backendJobKey, eleActions, imageCacheType, layoutSides } from '../../../shared/constants';
import { taskPool } from '../../core/TaskPool';
import { readCompressedImage } from '../../functions';
import {
  clearPrerenderCache,
  getConfigStore,
  ImageStorage,
  OverviewStorage,
  PreviewStorage,
} from '../../services/store';
import { colorCache, exportFile, prerenderPage } from '../../services/file_render';
import { getPagedImageListByCardList } from '../../services/file_render/utils';
import { expandPath, filePathToImageKey, fixPath } from '../../../shared/functions';
import { refreshCardStorage } from '../functions';

const highQualityRetryAttempted = new Set();

const taskFn = (storage, options = {}) => {
  const { onEmptyResult = null } = options;
  return async (task, ...args) => {
    if(task.cancelled) return Promise.resolve(null);
    const compressedResult = await readCompressedImage(...args);
    if(task.cancelled) return Promise.resolve(null);
    const imagePathKey = filePathToImageKey(fixPath(args[0]));
    if (compressedResult) {
      storage[imagePathKey] = compressedResult;
    } else if (onEmptyResult) {
      onEmptyResult({ args, imagePathKey });
    }
    return compressedResult;
  }
}

const compressThumbnail = taskPool.task(taskFn(OverviewStorage), {
  tag: imageCacheType.thumbnails,
  priority: 100,
  uniqueKey: (args) => args[0]
});

const compressHighQualityRetry = taskPool.task(taskFn(ImageStorage), {
  tag: imageCacheType.highQualityRetry,
  priority: -100,
  uniqueKey: (args) => args[0]
});

const scheduleHighQualityRetry = (imagePath, options, imagePathKey) => {
  if (highQualityRetryAttempted.has(imagePathKey)) {
    return null;
  }
  highQualityRetryAttempted.add(imagePathKey);
  console.warn(`Retrying high quality image load once: ${imagePath}`);
  return compressHighQualityRetry(imagePath, options);
};

const compressHighQuality = taskPool.task(taskFn(ImageStorage, {
  onEmptyResult: ({ args, imagePathKey }) => {
    scheduleHighQualityRetry(args[0], args[1], imagePathKey);
  }
}), {
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

const getCompressParams = () => {
  const { Config } = getConfigStore();
  const cardWidth = Config.cardWidth;
  const compressLevel = Config.compressLevel || 2;
  const compressParamsList = [
    { maxWidth: cardWidth * 15, quality: 100, maxDpi: 300 },
    { maxWidth: cardWidth * 12, quality: 90, maxDpi: 200 },
    { maxWidth: cardWidth * 9, quality: 85, maxDpi: 150 },
    { maxWidth: cardWidth * 6, quality: 80, maxDpi: 75 },
  ];
  return compressParamsList[compressLevel - 1]
}

const waitForTaskResult = async (taskId, timeoutMs = 15000) => {
  await Promise.race([
    taskPool.waitTask(taskId),
    new Promise((_, reject) => setTimeout(() => reject(), timeoutMs))
  ]);
};

const loadHighQualityWithRetry = async (imagePath, options, timeoutMs = 15000) => {
  const imageKey = filePathToImageKey(fixPath(imagePath));
  highQualityRetryAttempted.delete(imageKey);
  const firstTaskId = compressHighQuality(imagePath, options);

  try {
    await waitForTaskResult(firstTaskId, timeoutMs);
  } catch (_) {}

  let highData = await ImageStorage[imageKey];
  if (highData) {
    return highData;
  }

  const retryTask = taskPool.getTaskByTagAndUniqueKey(imageCacheType.highQualityRetry, imagePath);
  if (retryTask?.status === 'pending' || retryTask?.status === 'running') {
    try {
      await waitForTaskResult(retryTask.id, timeoutMs);
    } catch (_) {}
  }

  return ImageStorage[imageKey];
};

const updateHighQualityProgress = (getMainWindow) => {
  const mainWindow = getMainWindow();
  const primaryStats = taskPool.getStatsByTag(imageCacheType.highQuality);
  const retryStats = taskPool.getStatsByTag(imageCacheType.highQualityRetry);
  const total = primaryStats.total + retryStats.total;
  const done = primaryStats.completed + primaryStats.failed + primaryStats.cancelled
    + retryStats.completed + retryStats.failed + retryStats.cancelled;
  const progress = total > 0 ? done / total : 1;
  const key = backendJobKey.loadHighQuality;

  mainWindow.webContents.send(eleActions.backendJobProgress, {
    key,
    progress
  });

  if (total > 0 && progress >= 1) {
    console.log('✅ High quality loading completed');
  }
};

const pathToImageData = (imagePath, option = { }) => {
  const { force = false, skipOverviewStorage = false, skipImageStorage = false } = option;
  const ext = imagePath.split('.').pop();
  const imagePathKey = filePathToImageKey(fixPath(imagePath));
  const { mtime } = fs.statSync(expandPath(imagePath));
  const returnObj = { path: fixPath(imagePath), mtime: mtime.getTime() };

  const fixedImagePath = expandPath(imagePath);
  highQualityRetryAttempted.delete(imagePathKey);

  if(!skipOverviewStorage && (!OverviewStorage.has(imagePathKey) || force)) {
    compressThumbnail(
      fixedImagePath,
      { maxWidth: 100 }
    )
  }

  if(!skipImageStorage && (!ImageStorage.has(imagePathKey) || force)) {
    compressHighQuality(
      fixedImagePath,
      { format: ext, ...getCompressParams() }
    );
  }



  colorCache.delete(imagePathKey);
  return returnObj;
};

export default (getMainWindow) => {

  taskPool.onCompleteByTag(imageCacheType.highQuality, () => {
    updateHighQualityProgress(getMainWindow);
  });
  taskPool.onCompleteByTag(imageCacheType.highQualityRetry, () => {
    updateHighQualityProgress(getMainWindow);
  });

  protocol.handle('cardrac', async (request) => {
    const createResponse = (data, mimeType, status = 200) => {
      const emptySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="transparent"/></svg>`;
      return new Response(data ?? emptySvg, {
        status,
        headers: { 'Content-Type': mimeType }
      });
    };

    const buildImageResponse = async (imageData, imagePath) => {
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const ext = imagePath.split('.').pop().toLowerCase();
      const mimeTypes = { 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif', 'webp': 'image/webp' };
      return createResponse(buffer, mimeTypes[ext] || 'image/png', 200);
    };

    try {
      const urlObj = new URL(request.url);
      let imagePath = decodeURIComponent(urlObj.pathname.replace('/image/', ''));
      if (imagePath.startsWith('/')) imagePath = imagePath.substring(1);

      const requestedQuality = urlObj.searchParams.get('quality') || 'auto';
      const imageKey = filePathToImageKey(imagePath);
      const expandedPath = expandPath(imagePath);

      // 第一步：先拿低质量图（快速响应）
      let overviewData = await OverviewStorage[imageKey];
      if (!overviewData) {
        compressThumbnail(expandedPath, { maxWidth: 100 });
        try {
          const task = taskPool.getTaskByTagAndUniqueKey(imageCacheType.thumbnails, expandedPath);
          if (task) await Promise.race([
            taskPool.waitTask(task.id),
            new Promise((_, reject) => setTimeout(() => reject(), 10000))
          ]);
          overviewData = await OverviewStorage[imageKey];
        } catch (_) {}
      }

      // 第二步：low 模式直接返回低清
      if (requestedQuality === 'low') {
        if (overviewData) return buildImageResponse(overviewData, imagePath);
        return createResponse(null, 'image/svg+xml', 404);
      }

      // 第三步：尝试获取高清
      let highData = await ImageStorage[imageKey];

      if (!highData) {
        const highTask = taskPool.getTaskByTagAndUniqueKey(imageCacheType.highQuality, expandedPath);
        const retryTask = taskPool.getTaskByTagAndUniqueKey(imageCacheType.highQualityRetry, expandedPath);

        if (highTask?.status === 'pending' || highTask?.status === 'running') {
          // 等待进行中的任务
          try {
            await waitForTaskResult(highTask.id);
            highData = await ImageStorage[imageKey];
          } catch (_) {}
          if (!highData) {
            const pendingRetryTask = taskPool.getTaskByTagAndUniqueKey(imageCacheType.highQualityRetry, expandedPath);
            if (pendingRetryTask?.status === 'pending' || pendingRetryTask?.status === 'running') {
              try {
                await waitForTaskResult(pendingRetryTask.id);
                highData = await ImageStorage[imageKey];
              } catch (_) {}
            }
          }
        } else if (retryTask?.status === 'pending' || retryTask?.status === 'running') {
          try {
            await waitForTaskResult(retryTask.id);
            highData = await ImageStorage[imageKey];
          } catch (_) {}
        } else {
          // 没有任务，触发并等待
          const ext = imagePath.split('.').pop();
          highData = await loadHighQualityWithRetry(expandedPath, { format: ext, ...getCompressParams() });
        }
      }

      if (highData) return buildImageResponse(highData, imagePath);

      // 高清获取失败，降级返回低清
      if (overviewData) return buildImageResponse(overviewData, imagePath);
      return createResponse(null, 'image/svg+xml', 404);

    } catch (error) {
      console.error('Protocol handler error:', error);
      return createResponse(null, 'image/svg+xml', 500);
    }
  });

  ipcMain.on(eleActions.getExportPageCount, async (event, args) => {
    const { CardList, globalBackground, returnChannel } = args;
    const mainWindow = getMainWindow();
    const { Config } = getConfigStore();
    const state = { CardList, globalBackground };
    const pagedImageList = getPagedImageListByCardList(state, Config);
    const isFoldInHalf = Config.sides === layoutSides.foldInHalf;
    mainWindow.webContents.send(returnChannel, isFoldInHalf ? pagedImageList.length / 2 : pagedImageList.length);
  });

  ipcMain.on(eleActions.getExportPreview, async (event, args) => {
    const { pageIndex, CardList, globalBackground, returnChannel } = args;
    const mainWindow = getMainWindow();
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

    if(pageIndex > 0) {
      console.log(`🔮 Pre-rendering next 3 pages...`);
      for (let i = 1; i <= 3; i++) {
        const nextIndex = actualIndex + i;
        if (nextIndex < totalPages) {
          prerenderPage(nextIndex, state, Config, exportFile, 'exportFile').catch(err => {
            console.error(`Failed to prerender page ${nextIndex + 1}:`, err);
          });
        }
      }
    }

    mainWindow.webContents.send(returnChannel, result);
  });

  ipcMain.on(eleActions.clearPreviewCache, async (event, args) => {
    const { returnChannel, pageIndex } = args;
    const mainWindow = getMainWindow();
    if(pageIndex > 0 ) {
      const cacheKey = `exportFile-${pageIndex}`
      await PreviewStorage.delete(cacheKey)
      colorCache.clear()
    } else {
      clearPrerenderCache();
    }

    console.log('Preview cache cleared');
    mainWindow.webContents.send(returnChannel, { success: true });
  });

  ipcMain.on(eleActions.loadImageList, async (event, args) => {
    const { returnChannel, progressChannel, imageList } = args;
    const mainWindow = getMainWindow();
    imageList.forEach(imageData => {
      try {
        pathToImageData(imageData.path)
      } catch (e) {
        console.error(`Failed to load image in background: ${imageData.path}`, e);
      }
    });

    await taskPool.waitTasksByTag(imageCacheType.thumbnails, {
      progressCallback: progressChannel
        ? (p) => progressChannel && mainWindow.webContents.send(progressChannel, p)
        : null
    });
    mainWindow.webContents.send(returnChannel, { success: true });
  });

  ipcMain.on(eleActions.checkImage, async (event, args) => {
    const mainWindow = getMainWindow();
    const pathList = Array.isArray(args.pathList) ? [...args.pathList] : [];
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
    const mainWindow = getMainWindow();
    const { Config } = getConfigStore();
    Config.globalBackground = globalBackground;

    colorCache.clear();

    taskPool.cancelTasksByTag(imageCacheType.thumbnails)
    taskPool.cancelTasksByTag(imageCacheType.highQuality)
    taskPool.cancelTasksByTag(imageCacheType.highQualityRetry)
    highQualityRetryAttempted.clear();
    // 清理未使用的图片
    refreshCardStorage(CardList, globalBackground);

    let isTerminated = false;

    cancelChannel && ipcMain.once(cancelChannel, () => {
      isTerminated = true;
      taskPool.cancelTasksByTag(imageCacheType.thumbnails);
      taskPool.cancelTasksByTag(imageCacheType.highQuality);
      taskPool.cancelTasksByTag(imageCacheType.highQualityRetry);
      highQualityRetryAttempted.clear();
    });

    const alreadyKnownKey = new Set();

    const reloadImage = (args, cb) => {
      if (!args) return;
      const { path: imagePath, mtime: cardMtime } = args;
      const imagePathKey = filePathToImageKey(fixPath(imagePath));
      try{
        const { mtime } = fs.statSync(expandPath(imagePath));
        if (cardMtime !== mtime.getTime() || !alreadyKnownKey.has(imagePathKey)) {
          alreadyKnownKey.add(imagePathKey);
          pathToImageData(imagePath, { force: true});
          cb && cb(mtime)
        }
      }
      catch (e) {

      }
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

    await taskPool.waitTasksByTag(imageCacheType.highQuality, {
      progressCallback: progressChannel
        ? (p) => progressChannel && mainWindow.webContents.send(progressChannel, p * 0.5)
        : null
    });
    await taskPool.waitTasksByTag(imageCacheType.highQualityRetry, {
      progressCallback: progressChannel
        ? (p) => progressChannel && mainWindow.webContents.send(progressChannel, 0.5 + p * 0.5)
        : null
    });
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

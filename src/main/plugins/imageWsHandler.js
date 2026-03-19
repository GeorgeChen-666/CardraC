import fs from 'fs';
import { getConfigStore, readCompressedImage } from '../functions';
import { eleActions, layoutSides } from '../../shared/constants';
import {
  clearPrerenderCache,
  getPagedImageListByCardList,
  ImageStorage,
  OverviewStorage,
} from '../file_render/utils';
import { colorCache, exportFile, prerenderPage } from '../file_render';
import { expandPath, fixPath } from '../utils';
import { waitCondition } from '../../shared/functions';

const ImageStorageLoadingJobs = {};
const pendingList = new Set();
const progressClients = new Map();

const pathToImageData = async (imagePath, cb) => {
  const { Config } = getConfigStore();
  const cardWidth = Config.cardWidth;
  const compressLevel = Config.compressLevel || 2;
  const compressParamsList = [
    { maxWidth: cardWidth * 15, quality: 100, maxDpi: 300 },
    { maxWidth: cardWidth * 12, quality: 90, maxDpi: 200 },
    { maxWidth: cardWidth * 9, quality: 85, maxDpi: 150 },
    { maxWidth: cardWidth * 6, quality: 80, maxDpi: 75 },
  ];

  const ext = imagePath.split('.').pop();
  const imagePathKey = fixPath(imagePath).replaceAll('\\', '');
  const { mtime } = fs.statSync(expandPath(imagePath));
  const returnObj = { path: fixPath(imagePath), mtime: mtime.getTime() };

  if (!pendingList.has(imagePathKey)) {
    pendingList.add(imagePathKey);
    ImageStorageLoadingJobs[imagePath] = async () => {
      ImageStorage[imagePathKey] = await readCompressedImage(expandPath(imagePath), {
        format: ext,
        ...compressParamsList[compressLevel - 1]
      });
      pendingList.delete(imagePathKey);
      delete ImageStorageLoadingJobs[imagePath];
    };
    ImageStorageLoadingJobs[imagePath]();
  }

  OverviewStorage[imagePathKey] = await readCompressedImage(expandPath(imagePath), { maxWidth: 100 });
  colorCache.delete(imagePathKey);
  cb && cb();
  return returnObj;
};

export default (wsManager) => {
  wsManager.on(eleActions.getExportPageCount, async (event, args) => {
    const { CardList, globalBackground, returnChannel } = args;
    const { Config } = getConfigStore();
    const state = { CardList, globalBackground };
    const pagedImageList = getPagedImageListByCardList(state, Config);
    const isFoldInHalf = Config.sides === layoutSides.foldInHalf;
    wsManager.send(returnChannel, isFoldInHalf ? pagedImageList.length / 2 : pagedImageList.length);
  });

  wsManager.on(eleActions.getExportPreview, async (event, args) => {
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
    wsManager.send(returnChannel, result);
  });

  wsManager.on(eleActions.clearPreviewCache, async (event, args) => {
    const { returnChannel } = args;
    clearPrerenderCache();
    console.log('Preview cache cleared');
    wsManager.send(returnChannel, { success: true });
  });

  wsManager.on(eleActions.loadImageList, async (event, args) => {
    const { returnChannel, imageList } = args;
    imageList.forEach(imageData => {
      pathToImageData(imageData.path).catch(err => {
        console.error(`Failed to load image in background: ${imageData.path}`, err);
      });
    });
    wsManager.send(returnChannel, { success: true });
  });

  wsManager.on(eleActions.getImageContent, async (event, args) => {
    const { returnChannel, path, quality = 'low' } = args;
    const imagePathKey = path.replaceAll('\\', '');
    let content;
    if (quality === 'high') {
      content = ImageStorage[imagePathKey];
      if (!content) {
        await waitCondition(
          () => ImageStorage[imagePathKey],
          50,
          10000
        );
        content = ImageStorage[imagePathKey];
      }
    } else {
      content = OverviewStorage[imagePathKey];
    }
    if (!content) {
      wsManager.send(returnChannel, null);
    }
    wsManager.send(returnChannel, content);
  });




  wsManager.on(eleActions.checkImage, async (event, args) => {
    const pathList = JSON.parse(JSON.stringify(args.pathList));
    const invalidImages = [];

    const checkImagePath = imagePath => {
      try {
        fs.accessSync(imagePath, fs.constants.F_OK);
      } catch (e) {
        invalidImages.push(imagePath);
      }
    };

    pathList.forEach(path => {
      checkImagePath(expandPath(path));
    });

    wsManager.send(args.returnChannel, invalidImages);
  });

  wsManager.on(eleActions.reloadLocalImage, async (event, args) => {
    const { CardList, globalBackground, returnChannel, progressChannel, cancelChannel } = args;
    const { Config } = getConfigStore();
    Config.globalBackground = globalBackground;

    const reloadImageJobs = [];
    colorCache.clear();
    let isTerminated = false;

    cancelChannel && wsManager.once(cancelChannel, () => {
      isTerminated = true;
    });

    let totalCount = 0;
    let currentCount = 0;
    const alreadyKnownKey = new Set();

    const reloadImage = (args, cb) => {
      if (!args) return false;

      const { path: imagePath, mtime: cardMtime } = args;
      const imagePathKey = fixPath(imagePath)?.replaceAll?.('\\', '');

      try {
        const { mtime } = fs.statSync(expandPath(imagePath));

        if (cardMtime !== mtime.getTime() || !alreadyKnownKey.has(imagePathKey)) {
          totalCount++;
          alreadyKnownKey.add(imagePathKey);
          reloadImageJobs.push((async () => {
            if (isTerminated) return;
            cb && cb(mtime.getTime());
            await pathToImageData(imagePath);
            if (isTerminated) return;
            currentCount++;
            progressChannel && wsManager.send(progressChannel, currentCount / totalCount);
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
      wsManager.send(returnChannel, {
        isAborted: true
      });
    } else {
      wsManager.send(progressChannel, 1);
      wsManager.send(returnChannel, { CardList, Config });
    }
  });
};

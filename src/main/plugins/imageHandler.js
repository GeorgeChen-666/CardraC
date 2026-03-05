const fs = require('fs');
const path = require('path');

// ✅ 在文件内部导入 eleActions
const { eleActions } = require('../../shared/constants');
const { getConfigStore, readCompressedImage } = require('../functions');
const {
  ImageStorage,
  OverviewStorage,
  getPagedImageListByCardList,
  prerenderPage,
  clearPrerenderCache
} = require('../file_render/utils');
const { colorCache, exportFile } = require('../file_render');
const { expandPath, fixPath } = require('../utils');
const { layoutSides } = require('../../shared/constants');
const { waitCondition } = require('../../shared/functions');

const ImageStorageLoadingJobs = {};
const pendingList = new Set();
const progressClients = new Map();

const pathToImageData = async (imagePath, cb) => {
  const { Config } = getConfigStore();
  const cardWidth = Config.cardWidth;
  const compressLevel = Config.compressLevel || 2;
  const compressParamsList = [
    { maxWidth: cardWidth * 15, quality: 100 },
    { maxWidth: cardWidth * 12, quality: 90 },
    { maxWidth: cardWidth * 9, quality: 80 },
    { maxWidth: cardWidth * 6, quality: 70 },
  ];

  const ext = imagePath.split('.').pop();
  const imagePathKey = fixPath(imagePath).replaceAll('\\', '');
  const { mtime } = fs.statSync(expandPath(imagePath));
  const returnObj = { path: fixPath(imagePath), mtime: mtime.getTime() };

  if (!(imagePathKey in ImageStorage) && !pendingList.has(imagePathKey)) {
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

const sendProgress = (channelId, progress) => {
  const client = progressClients.get(channelId);
  if (client) {
    client.write(`data: ${JSON.stringify({ progress })}\n\n`);
  }
};

// ✅ 添加 basePath 参数，默认 '/api'
const registerImageAPI = (app, basePath = '/api') => {

  // 进度通道
  app.get(`${basePath}/progress/:channelId`, (req, res) => {
    const { channelId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    progressClients.set(channelId, res);
    console.log(`📡 Progress channel connected: ${channelId}`);

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
      progressClients.delete(channelId);
      console.log(`📡 Progress channel closed: ${channelId}`);
    });
  });

  // 获取导出页数
  app.post(`${basePath}/${eleActions.getExportPageCount}`, (req, res) => {
    try {
      const { CardList, globalBackground } = req.body;
      const { Config } = getConfigStore();
      const state = { CardList, globalBackground };
      const pagedImageList = getPagedImageListByCardList(state, Config);
      const isFoldInHalf = Config.sides === layoutSides.foldInHalf;
      res.json({ count: isFoldInHalf ? pagedImageList.length / 2 : pagedImageList.length });
    } catch (err) {
      console.error('Error getting export page count:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 获取导出预览
  app.post(`${basePath}/${eleActions.getExportPreview}`, async (req, res) => {
    try {
      const { pageIndex, CardList, globalBackground } = req.body;
      const { Config } = getConfigStore();
      const state = { CardList, globalBackground };

      const actualIndex = pageIndex - 1;
      const requestStartTime = performance.now();
      console.log(`📄 Request: Page ${pageIndex}`);

      const pagedImageList = getPagedImageListByCardList(state, Config);
      const isFoldInHalf = Config.sides === layoutSides.foldInHalf;
      const totalPages = isFoldInHalf ? pagedImageList.length / 2 : pagedImageList.length;

      const result = await prerenderPage(actualIndex, state, Config, exportFile, 'exportFile');

      const requestEndTime = performance.now();
      const totalDuration = (requestEndTime - requestStartTime).toFixed(2);
      console.log(`✨ Request completed in ${totalDuration}ms`);

      console.log('🔮 Pre-rendering next 3 pages...');
      for (let i = 1; i <= 3; i++) {
        const nextIndex = actualIndex + i;
        if (nextIndex < totalPages) {
          prerenderPage(nextIndex, state, Config, exportFile, 'exportFile').catch(err => {
            console.error(`Failed to prerender page ${nextIndex + 1}:`, err);
          });
        }
      }

      res.send(result);
    } catch (err) {
      console.error('Error getting export preview:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 清除预览缓存
  app.post(`${basePath}/${eleActions.clearPreviewCache}`, async (req, res) => {
    try {
      clearPrerenderCache();
      console.log('Preview cache cleared');
      res.json({ success: true });
    } catch (err) {
      console.error('Error clearing preview cache:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get(`${basePath}/${eleActions.getImageContent}`, async (req, res) => {
    try {
      const { path: imagePath, quality = 'low' } = req.query;
      const imagePathKey = imagePath.replaceAll('\\', '');
      let content;
      if (quality === 'high') {
        content = ImageStorage[imagePathKey];
        if (!content) {
          try {
            await waitCondition(
              () => ImageStorage[imagePathKey],
              5000,
              100
            );
            content = ImageStorage[imagePathKey];
          } catch (error) {
            console.warn(`Timeout waiting for high quality image: ${imagePath}`);
            return res.status(404).send('Image not ready');
          }
        }
      } else {
        content = OverviewStorage[imagePathKey];
      }

      if (!content) {
        return res.status(404).send('Image not found');
      }

      const matches = content.match(/^data:image\/(\w+);base64,(.+)$/);

      if (!matches) {
        return res.status(500).send('Invalid image format');
      }

      const [, imageType, base64Data] = matches;
      const buffer = Buffer.from(base64Data, 'base64');

      // ✅ 设置正确的 Content-Type
      const mimeTypes = {
        'jpeg': 'image/jpeg',
        'jpg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp'
      };

      const mimeType = mimeTypes[imageType.toLowerCase()] || 'image/jpeg';

      res.set('Content-Type', mimeType);
      res.set('Cache-Control', 'public, max-age=31536000'); // 缓存 1 年
      res.send(buffer);

    } catch (err) {
      console.error('Error getting image content:', err);
      res.status(500).send('Internal server error');
    }
  });

  // 检查图片
  app.post(`${basePath}/${eleActions.checkImage}`, (req, res) => {
    try {
      const { pathList } = req.body;
      const invalidImages = [];

      pathList.forEach(imagePath => {
        try {
          fs.accessSync(expandPath(imagePath), fs.constants.F_OK);
        } catch (e) {
          invalidImages.push(imagePath);
        }
      });

      res.json(invalidImages);
    } catch (err) {
      console.error('Error checking images:', err);
      res.status(500).json({ error: err.message });
    }
  });
  app.post(`${basePath}/${eleActions.loadImageList}`, (req, res) => {
    try {
      const { imageList } = req.body; // imageList: [{ext, mtime, path}, ...]

      if (!Array.isArray(imageList)) {
        return res.status(400).json({ error: 'imageList must be an array' });
      }

      imageList.forEach(imageData => {
        pathToImageData(imageData.path).catch(err => {
          console.error(`Failed to load image in background: ${imageData.path}`, err);
        });
      });

      res.json({
        success: true,
        message: 'Images are being loaded in background',
      });

    } catch (err) {
      console.error('Error processing image list:', err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  // 重新加载本地图片
  app.post(`${basePath}/${eleActions.reloadLocalImage}`, async (req, res) => {
    try {
      const { CardList, globalBackground, progressChannel } = req.body;
      const { Config } = getConfigStore();
      Config.globalBackground = globalBackground;

      const reloadImageJobs = [];
      colorCache.clear();

      let totalCount = 0;
      let currentCount = 0;

      const reloadImage = (args, cb) => {
        if (!args) return false;

        const { path: imagePath, mtime: cardMtime } = args;
        const imagePathKey = imagePath.replaceAll('\\', '');

        try {
          const { mtime } = fs.statSync(expandPath(imagePath));

          if (cardMtime !== mtime.getTime() || !(imagePathKey in ImageStorage)) {
            totalCount++;
            reloadImageJobs.push((async () => {
              cb && cb(mtime.getTime());
              delete ImageStorage[imagePathKey];
              delete OverviewStorage[imagePathKey];
              await pathToImageData(imagePath);
              currentCount++;

              if (progressChannel) {
                sendProgress(progressChannel, currentCount / totalCount);
              }
            })());
            return true;
          }
        } catch (e) {
          console.error('Error reloading image:', e);
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

      if (progressChannel) {
        sendProgress(progressChannel, 1);
      }

      res.json({ CardList, Config });
    } catch (err) {
      console.error('Error reloading images:', err);
      res.status(500).json({ error: err.message });
    }
  });
};

module.exports = { registerImageAPI };

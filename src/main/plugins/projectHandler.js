const fs = require('fs');
const path = require('path');
const { eleActions } = require('../../shared/constants');
const { getConfigStore, saveDataToFile } = require('../ele_action/functions');
const { defaultImageStorage, ImageStorage, OverviewStorage } = require('../file_render/utils');
const { parser } = require('stream-json');
const { streamObject } = require('stream-json/streamers/StreamObject');

const progressClients = new Map();

const refreshCardStorage = (CardList, globalBackground) => {
  const usedImagePath = new Set();
  CardList.forEach(card => {
    const { face, back } = card;
    const facePathKey = face?.path.replaceAll('\\', '');
    const backPathKey = back?.path.replaceAll('\\', '');
    usedImagePath.add(facePathKey);
    usedImagePath.add(backPathKey);
  });

  if (globalBackground?.path) {
    const globalBackPathKey = globalBackground?.path?.replaceAll('\\', '');
    usedImagePath.add(globalBackPathKey);
  }

  Object.keys(OverviewStorage).filter(key => !usedImagePath.has(key)).forEach(key => {
    delete OverviewStorage[key];
  });

  Object.keys(ImageStorage).filter(key => !usedImagePath.has(key)).forEach(key => {
    delete ImageStorage[key];
  });
};

const loadCpnpFile = async (filePath, { onProgress, onFinish, onError }) => {
  try {
    const { size } = fs.statSync(filePath);
    const readStream = fs.createReadStream(filePath);

    // 清空现有存储
    Object.keys(ImageStorage).forEach(key => delete ImageStorage[key]);
    Object.keys(OverviewStorage).forEach(key => delete OverviewStorage[key]);

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
              ImageStorage[imgKey] = imgValue;
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

const sendProgress = (channelId, progress) => {
  const client = progressClients.get(channelId);
  if (client) {
    client.write(`data: ${JSON.stringify({ progress })}\n\n`);
  }
};

const registerProjectAPI = (app, basePath = '/api') => {
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

  // ✅ 保存项目
  app.post(`${basePath}/${eleActions.saveProject}`, async (req, res) => {
    try {
      const { CardList, globalBackground, filePath, progressChannel } = req.body;

      if (!filePath) {
        return res.status(400).json({ error: 'filePath is required' });
      }

      const { Config } = getConfigStore();
      Config.globalBackground = globalBackground;
      const projectData = { Config, CardList };

      // 清理未使用的图片
      refreshCardStorage(CardList, globalBackground);

      console.log('📦 Preparing to save project...');
      progressChannel && sendProgress(progressChannel, 0.1);

      const imageStorageObj = await (ImageStorage.toPlainObjectAsync ?
        ImageStorage.toPlainObjectAsync() :
        Promise.resolve({ ...ImageStorage }));
      progressChannel && sendProgress(progressChannel, 0.5);

      const overviewStorageObj = await (OverviewStorage.toPlainObjectAsync ?
        OverviewStorage.toPlainObjectAsync() :
        Promise.resolve({ ...OverviewStorage }));
      progressChannel && sendProgress(progressChannel, 0.8);

      // 验证数据完整性
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

      progressChannel && sendProgress(progressChannel, 1);
      console.log('✅ Project saved successfully');

      res.json({ success: true, filePath });

    } catch (err) {
      console.error('❌ Save project failed:', err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  // ✅ 加载项目
  app.post(`${basePath}/${eleActions.openProject}`, async (req, res) => {
    try {
      const { filePath, progressChannel } = req.body;

      if (!filePath) {
        return res.status(400).json({ error: 'filePath is required' });
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      await loadCpnpFile(filePath, {
        onProgress: (progress) => {
          progressChannel && sendProgress(progressChannel, progress);
        },
        onFinish: (projectData) => {
          res.json(projectData);
        },
        onError: (error) => {
          res.status(500).json({
            success: false,
            error: error.message || 'Failed to load project'
          });
        }
      });

    } catch (err) {
      console.error('❌ Open project failed:', err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });
};

module.exports = { registerProjectAPI };

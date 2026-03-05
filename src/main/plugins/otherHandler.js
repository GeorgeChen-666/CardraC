const { eleActions, exportType, layoutSides } = require('../../shared/constants');
const { getConfigStore, saveDataToFile } = require('../functions');
const { getPagedImageListByCardList } = require('../file_render/utils');
const { exportFile } = require('../file_render');
const { SharpAdapter } = require('../file_render/adapter/SharpAdapter');
const { JsPDFAdapter } = require('../file_render/adapter/JsPdfAdapter');
const { SVGAdapter } = require('../file_render/adapter/SVGAdapter');
const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');

const progressClients = new Map();

const sendProgress = (channelId, progress) => {
  const client = progressClients.get(channelId);
  if (client) {
    client.write(`data: ${JSON.stringify({ progress })}\n\n`);
  }
};

const registerOtherAPI = (app, basePath = '/api') => {

  // ✅ 进度通道（与其他 handler 共用）
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

  // ✅ 导出文件
  app.post(`${basePath}/${eleActions.exportFile}`, async (req, res) => {
    try {
      const { CardList, globalBackground, targetFileType, progressChannel } = req.body;

      if (!CardList || !targetFileType) {
        return res.status(400).json({
          success: false,
          error: 'CardList and targetFileType are required'
        });
      }

      const { Config } = getConfigStore();
      const state = { CardList, globalBackground };
      const pagedImageList = getPagedImageListByCardList(state, Config);

      // 确定文件扩展名
      let extension = targetFileType;
      const isMultiPage = pagedImageList.length > (Config.sides === layoutSides.foldInHalf ? 2 : 1);

      if (isMultiPage && targetFileType !== exportType.pdf) {
        extension = exportType.zip;
      }

      console.log(`📦 Exporting as ${extension}...`);
      progressChannel && sendProgress(progressChannel, 0.1);

      // 创建适配器
      const doc = (() => {
        if (targetFileType === exportType.pdf) {
          return new JsPDFAdapter(Config);
        } else if (targetFileType === exportType.png) {
          return new SharpAdapter(Config);
        } else if (targetFileType === exportType.svg) {
          return new SVGAdapter(Config);
        }
      })();

      progressChannel && sendProgress(progressChannel, 0.3);

      // 生成文件内容
      const blob = await exportFile(doc, state);

      progressChannel && sendProgress(progressChannel, 0.7);

      let fileContent = blob;
      let mimeType = 'application/octet-stream';
      let fileName = `pnp.${extension}`;

      // 如果是多页且非 PDF，打包成 ZIP
      if (Array.isArray(blob) && blob.length > 1) {
        const zip = new JSZip();

        blob.forEach((page, pageNumber) => {
          const pageFileName = `page${pageNumber}.${targetFileType}`;
          zip.file(pageFileName, page.buffer || page);
        });

        fileContent = await zip.generateAsync({
          type: 'nodebuffer',
          compression: 'DEFLATE',
          compressionOptions: { level: 9 }
        });

        mimeType = 'application/zip';
        fileName = `pnp.zip`;
      } else {
        // 单页文件
        if (targetFileType === exportType.pdf) {
          mimeType = 'application/pdf';
        } else if (targetFileType === exportType.png) {
          mimeType = 'image/png';
        } else if (targetFileType === exportType.svg) {
          mimeType = 'image/svg+xml';
        }

        if (Array.isArray(blob)) {
          fileContent = blob[0].buffer || blob[0];
        }
      }

      progressChannel && sendProgress(progressChannel, 1);

      // ✅ 返回文件供下载
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(fileContent);

      console.log(`✅ Export completed: ${fileName}`);

    } catch (err) {
      console.error('❌ Export failed:', err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  // ✅ 导出文件到指定路径（服务器端保存）
  app.post(`${basePath}/${eleActions.exportFile}/save`, async (req, res) => {
    try {
      const { CardList, globalBackground, targetFileType, filePath, progressChannel } = req.body;

      if (!CardList || !targetFileType || !filePath) {
        return res.status(400).json({
          success: false,
          error: 'CardList, targetFileType and filePath are required'
        });
      }

      const { Config } = getConfigStore();
      const state = { CardList, globalBackground };
      const pagedImageList = getPagedImageListByCardList(state, Config);

      let extension = targetFileType;
      const isMultiPage = pagedImageList.length > (Config.sides === layoutSides.foldInHalf ? 2 : 1);

      if (isMultiPage && targetFileType !== exportType.pdf) {
        extension = exportType.zip;
      }

      console.log(`📦 Exporting to ${filePath}...`);
      progressChannel && sendProgress(progressChannel, 0.1);

      const doc = (() => {
        if (targetFileType === exportType.pdf) {
          return new JsPDFAdapter(Config);
        } else if (targetFileType === exportType.png) {
          return new SharpAdapter(Config);
        } else if (targetFileType === exportType.svg) {
          return new SVGAdapter(Config);
        }
      })();

      progressChannel && sendProgress(progressChannel, 0.3);

      const blob = await exportFile(doc, state);

      progressChannel && sendProgress(progressChannel, 0.7);

      let fileContent = blob;

      if (Array.isArray(blob) && blob.length > 1) {
        const zip = new JSZip();

        blob.forEach((page, pageNumber) => {
          const pageFileName = `page${pageNumber}.${targetFileType}`;
          zip.file(pageFileName, page.buffer || page);
        });

        fileContent = await zip.generateAsync({
          type: 'nodebuffer',
          compression: 'DEFLATE',
          compressionOptions: { level: 9 }
        });
      } else if (Array.isArray(blob)) {
        fileContent = blob[0].buffer || blob[0];
      }

      // ✅ 保存到指定路径
      await saveDataToFile(fileContent, filePath);

      progressChannel && sendProgress(progressChannel, 1);

      console.log(`✅ File saved: ${filePath}`);
      res.json({
        success: true,
        filePath
      });

    } catch (err) {
      console.error('❌ Export save failed:', err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  // ✅ 获取应用版本
  app.get(`${basePath}/version`, (req, res) => {
    try {
      const packageJson = require('../../../package.json');
      const version = packageJson.version || '1.0.0';

      res.send(version);

    } catch (err) {
      console.error('Error getting version:', err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });
};

module.exports = { registerOtherAPI };

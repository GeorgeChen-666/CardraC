import { app, ipcMain } from 'electron';
import { eleActions, exportType } from '../../../shared/constants';
import JSZip from 'jszip';
import { getConfigStore } from '../../services/store';
import { JsPDFAdapter } from '../../services/file_render/adapter/JsPdfAdapter';
import { SharpAdapter } from '../../services/file_render/adapter/SharpAdapter';
import { SVGAdapter } from '../../services/file_render/adapter/SVGAdapter';
import { colorCache, exportFile } from '../../services/file_render';
import { saveDataToFile } from '../../functions';


export default (getMainWindow) => {
  ipcMain.on(eleActions.exportFile, async (event, args) => {
    const { CardList, globalBackground, targetFileType, returnChannel, progressChannel, filePath } = args;
    const mainWindow = getMainWindow();
    const { Config } = getConfigStore();
    const state = { CardList, globalBackground };
    try {
      progressChannel && mainWindow.webContents.send(progressChannel, 0.1);
      const doc = (() => {
        if(targetFileType === exportType.pdf) {
          return new JsPDFAdapter(Config)
        } else if (targetFileType === exportType.png) {
          return new SharpAdapter(Config)
        }
        else if (targetFileType === exportType.svg) {
          return new SVGAdapter(Config)
        }
      })();
      progressChannel && mainWindow.webContents.send(progressChannel, 0.3);
      colorCache.clear();
      const result = await exportFile(doc, state);
      progressChannel && mainWindow.webContents.send(progressChannel, 0.5);
      let returnContent = result;
      if(Array.isArray(result) && result.length > 1) {
        const zip = new JSZip();

        result.forEach((page, pageNumber) => {
          const fileName = `page${pageNumber}.${targetFileType}`;
          zip.file(fileName, page.buffer || page);
        });

        returnContent = await zip.generateAsync({
          type: 'nodebuffer',
          compression: 'DEFLATE',
          compressionOptions: { level: 9 }
        });
      }
      progressChannel && mainWindow.webContents.send(progressChannel, 0.7);
      await saveDataToFile(returnContent, filePath);
      progressChannel && mainWindow.webContents.send(progressChannel, 1);
      mainWindow.webContents.send(returnChannel, true);
    }
    catch (e) {
      console.error('Export failed:', e);
      mainWindow.webContents.send(eleActions.backendNotification, {
        status: 'error',
        descriptionKey: "util.operationFailed"
      });
      mainWindow.webContents.send(returnChannel, false);
    }
  });

  ipcMain.on('version', async (event, args) => {
    const mainWindow = getMainWindow();
    mainWindow.webContents.send(args.returnChannel, app.getVersion());
  });
}
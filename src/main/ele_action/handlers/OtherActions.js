import { app, dialog, ipcMain } from 'electron';
import { eleActions, exportType, layoutSides } from '../../../shared/constants';
import JSZip from 'jszip';
import { getConfigStore } from '../../services/store';
import { getPagedImageListByCardList } from '../../services/file_render/utils';
import { JsPDFAdapter } from '../../services/file_render/adapter/JsPdfAdapter';
import { SharpAdapter } from '../../services/file_render/adapter/SharpAdapter';
import { SVGAdapter } from '../../services/file_render/adapter/SVGAdapter';
import { exportFile } from '../../services/file_render';
import { saveDataToFile } from '../../functions';


export default (mainWindow) => {
  ipcMain.on(eleActions.exportFile, async (event, args) => {
    const { CardList, globalBackground, targetFileType, returnChannel, progressChannel, filePath } = args;
    const { Config } = getConfigStore();
    let extension = targetFileType;
    const state = { CardList, globalBackground };
    const pagedImageList = getPagedImageListByCardList(state, Config);
    if((pagedImageList.length > (Config.sides === layoutSides.foldInHalf ? 2 : 1)) && targetFileType !== exportType.pdf) {
      extension = exportType.zip;
    }
    progressChannel && mainWindow.webContents.send(progressChannel, 0.1);
    try {
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
      mainWindow.webContents.send('notification', {
        status: 'error',
        description: "util.operationFailed"
      });
      mainWindow.webContents.send(returnChannel, false);
    }
  });

  ipcMain.on('version', async (event, args) => {
    mainWindow.webContents.send(args.returnChannel, app.getVersion());
  });
}
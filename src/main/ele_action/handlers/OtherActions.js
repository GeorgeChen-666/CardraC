import { app, dialog, ipcMain } from 'electron';
import { exportFile } from './file_render';
import { getConfigStore, saveDataToFile } from '../functions';
import { getPagedImageListByCardList } from './file_render/Utils';
import { eleActions, exportType } from '../../../shared/constants';
import { SharpAdapter } from './file_render/adapter/SharpAdapter';
import { JsPDFAdapter } from './file_render/adapter/JsPdfAdapter';
// import { getCutRectangleList } from './pdf/Utils';

export default (mainWindow) => {
  ipcMain.on(eleActions.exportFile, async (event, args) => {
    const { CardList, globalBackground, targetFileType, returnChannel, progressChannel } = args;
    const { Config } = getConfigStore();
    let extension = targetFileType;
    const state = { CardList, globalBackground };
    const pagedImageList = getPagedImageListByCardList(state, Config);
    if(pagedImageList.length > 1 && targetFileType === exportType.png) {
      extension = exportType.zip;
    }
    const result = await dialog.showSaveDialog(mainWindow,{
      title: 'Save File',
      defaultPath: `pnp.${extension}`,
      filters: [
        { name: extension, extensions: [extension] }
      ]
    });
    if (result.canceled) {
      mainWindow.webContents.send(returnChannel, false);
    }
    else {
      try {
        const doc = (() => {
          if(targetFileType === exportType.pdf) {
            return new JsPDFAdapter(Config)
          } else if (targetFileType === exportType.png) {
            return new SharpAdapter(Config)
          }
        })();
        const blob = await exportFile(doc, state);
        const filePath = result.filePath;
        await saveDataToFile(blob, filePath);
        mainWindow.webContents.send(returnChannel, true);
      }
      catch (e) {
        mainWindow.webContents.send('notification', {
          status: 'error',
          description: "util.operationFailed"
        });
        mainWindow.webContents.send(returnChannel, false);
      }
    }
  });

  ipcMain.on('version', async (event, args) => {
    mainWindow.webContents.send(args.returnChannel, app.getVersion());
  });
}
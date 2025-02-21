import { app, dialog, ipcMain } from 'electron';
import { exportPdf } from './pdf/ExportPdf';
import { saveDataToFile } from '../functions';

export default (mainWindow) => {
  ipcMain.on('export-pdf', async (event, args) => {
    const { CardList, globalBackground, returnChannel, progressChannel } = args;
    const result = await dialog.showSaveDialog(mainWindow,{
      title: 'Save PDF',
      defaultPath: 'pnp.pdf',
      filters: [
        { name: 'pdf', extensions: ['pdf'] }
      ]
    });
    if (result.canceled) {
      mainWindow.webContents.send('export-pdf-done', false);
    }
    else {
      try {
        const blob = await exportPdf({ CardList, globalBackground }, (progress) => {
          mainWindow.webContents.send(progressChannel, progress);
        });
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
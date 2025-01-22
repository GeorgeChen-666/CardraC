import { dialog, ipcMain } from 'electron';
import { exportPdf } from './pdf/ExportPdf';
import { saveDataToFile } from '../functions';

const fs = require('fs');
const path = require('path');

function getAppVersion() {
  const workingDirectory = process.cwd();
  const packageJsonPath = path.join(workingDirectory, 'package.json');
  const packageJson = fs.readFileSync(packageJsonPath, 'utf-8');
  const { version } = JSON.parse(packageJson);
  return version;
}

export default (mainWindow) => {
  ipcMain.on('export-pdf', async (event, args) => {
    const { returnChannel, progressChannel } = args;
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
      const blob = await exportPdf(args.state, (progress) => {
        mainWindow.webContents.send(progressChannel, progress);
      });
      const filePath = result.filePath;
      await saveDataToFile(blob, filePath);
      mainWindow.webContents.send(returnChannel, true);
    }
  });

  ipcMain.on('version', async (event, args) => {
    mainWindow.webContents.send(args.returnChannel, getAppVersion());
  });
}
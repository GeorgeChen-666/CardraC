import { ipcMain } from 'electron';
import { eleActions, initialState, layoutSides } from '../../../shared/constants';
import { exportFile, prerenderPage } from '../../services/file_render';
import { printPNGs, printSVGs } from '../../functions';
import { clearPrerenderCache, getConfigStore } from '../../services/store';

const { exec } = require('child_process');

async function getPrinters() {
  return new Promise((resolve, reject) => {
    const cmd = 'powershell -NoProfile -Command "Add-Type -AssemblyName System.Drawing; $default = [System.Drawing.Printing.PrinterSettings]::DefaultPageSettings.PrinterName; $list = @(); foreach($p in [System.Drawing.Printing.PrinterSettings]::InstalledPrinters){$s=New-Object System.Drawing.Printing.PrinterSettings;$s.PrinterName=$p;$sizes=$s.PaperSizes|Select-Object -ExpandProperty PaperName|Sort-Object|Get-Unique; $o=[PSCustomObject]@{printerName=$p;isDefault=($p -eq $default);paperSizes=@($sizes)};$list+=$o}; $list|ConvertTo-Json -Depth 5"';

    exec(cmd, { encoding: 'utf8' }, (err, stdout, stderr) => {
      if (err) {
        console.error('执行错误:', err);
        return reject(err);
      }
      try {
        const result = JSON.parse(stdout.trim());
        resolve(result); // ✅ 正常返回结果
      } catch (e) {
        console.error('JSON 解析失败:', e);
        reject(e);
      }
    });
  });
}


export default (mainWindow) => {
  ipcMain.on(eleActions.getPrinters, async (event, args) => {
    const { returnChannel } = args;

    try {
      const printers = await getPrinters();
      mainWindow.webContents.send(returnChannel, { printers });

    } catch (err) {
      mainWindow.webContents.send(returnChannel, { printers: [] });
    }
  });
  ipcMain.on(eleActions.adjustGuidePrint, async (event, args) => {
    const { returnChannel, progressChannel } = args;

    function renderGuidePrintFunction (doc, state, pagesToRender = null) {
      const LS = 15;
      doc.setLineStyle({width:0.5 * 0.3527, color: '#ff0000'});
      doc.drawLine({ x1: LS, y1: LS, x2: LS, y2: 0 });
      doc.setLineStyle({width:0.5 * 0.3527, color: '#0015ff'});
      doc.drawLine({ x1: doc.pageWidth - LS , y1: LS, x2: doc.pageWidth, y2: LS });
      doc.setLineStyle({width:0.5 * 0.3527, color: '#5f00d3'});
      doc.drawLine({ x1: doc.pageWidth - LS , y1: doc.pageHeight - LS, x2: doc.pageWidth - LS, y2: doc.pageHeight });
      doc.setLineStyle({width:0.5 * 0.3527, color: '#008c91'});
      doc.drawLine({ x1: 0 , y1: doc.pageHeight - LS, x2: LS, y2: doc.pageHeight - LS });
      return doc.finalize()
    }

    try {
      const result = await prerenderPage(1, {}, {
        ...initialState.Config,
        sides: layoutSides.oneSide,
        landscape: false
      }, renderGuidePrintFunction, 'renderGuidePrintFunction')
      const rs = await printSVGs('', [result])
      mainWindow.webContents.send(returnChannel, rs.success);
    } catch (e) {
      mainWindow.webContents.send(returnChannel, false);
    }
  });

  ipcMain.on(eleActions.printPages, async (event, args) => {
    const { returnChannel, progressChannel, CardList, globalBackground, pageList, printConfig } = args;
    const { Config } = getConfigStore();
    const state = { CardList, globalBackground };

    // List available printers
    try {
      clearPrerenderCache();
      const result = await Promise.all([...pageList.map(v => prerenderPage(v - 1, state, Config, exportFile, 'exportFile', 'high'))]);
      const rs = await printSVGs(printConfig.defaultPrinter, result, {
        pageWidthMm: Config.pageWidth,
        pageHeightMm: Config.pageHeight,
        landscape: Config.landscape,
        paperSize: printConfig.paperSize,
        offsetXmm: printConfig.offsetX,
        offsetYmm: printConfig.offsetY,
        scaleX: printConfig.scaleX / 100,
        scaleY: printConfig.scaleY / 100,
      })
      mainWindow.webContents.send(returnChannel, rs.success);
    } catch (e) {
      mainWindow.webContents.send(returnChannel, false);
    }
  });
}
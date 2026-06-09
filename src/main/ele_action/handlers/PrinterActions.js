import { ipcMain } from 'electron';
import { eleActions, initialState, layoutSides } from '../../../shared/constants';
import { exportFile, prerenderPage } from '../../services/file_render';
import { printSVGs } from '../../functions';
import { clearPrerenderCache, getConfigStore, printStore } from '../../services/store';

const { exec } = require('child_process');

async function getPrinters() {
  return new Promise((resolve, reject) => {
    const cmd = 'powershell -NoProfile -Command "Add-Type -AssemblyName System.Drawing; $default = [System.Drawing.Printing.PrinterSettings]::DefaultPageSettings.PrinterName; $list = @(); foreach($p in [System.Drawing.Printing.PrinterSettings]::InstalledPrinters){ $s=New-Object System.Drawing.Printing.PrinterSettings; $s.PrinterName=$p; $ps=$s.DefaultPageSettings; $sizes=$s.PaperSizes|ForEach-Object{ [PSCustomObject]@{ name=$_.PaperName; widthMm=[Math]::Round($_.Width*0.254,1); heightMm=[Math]::Round($_.Height*0.254,1) } }|Sort-Object name|Get-Unique -AsString; $o=[PSCustomObject]@{ printerName=$p; isDefault=($p -eq $default); paperSizes=@($sizes); defaultPaperSize=$ps.PaperSize.PaperName; defaultWidthMm=[Math]::Round($ps.PaperSize.Width*0.254,1); defaultHeightMm=[Math]::Round($ps.PaperSize.Height*0.254,1); isLandscape=$ps.Landscape }; $list+=$o }; $list|ConvertTo-Json -Depth 5"';

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
    const { returnChannel, progressChannel, printConfig } = args;

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
      const landscape = printConfig?.isLandscape ?? false;
      const paperWidth = printConfig?.paperWidth;
      const paperHeight = printConfig?.paperHeight;

      const result = await prerenderPage(1, {}, {
        ...initialState.Config,
        sides: layoutSides.oneSide,
        landscape,
      }, renderGuidePrintFunction, 'renderGuidePrintFunction')

      const rs = await printSVGs('', [result], {
        pageWidthMm: paperWidth,
        pageHeightMm: paperHeight,
        landscape,
        paperSize: printConfig?.paperSize !== '_' ? printConfig?.paperSize : undefined,
      })
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
      const result = await Promise.all([...pageList.map(v => prerenderPage(v - 1, state, {...Config, landscape: printConfig.isLandscape}, exportFile, 'exportFile', 'high'))]);
      const rs = await printSVGs(printConfig.defaultPrinter, result, {
        pageWidthMm: printConfig.paperWidth,
        pageHeightMm: printConfig.paperHeight,
        landscape: printConfig.isLandscape,
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
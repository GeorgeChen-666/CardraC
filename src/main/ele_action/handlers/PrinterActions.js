import { ipcMain } from 'electron';
import { eleActions, initialState, layoutSides } from '../../../shared/constants';
import { exportFile, prerenderPage } from '../../services/file_render';
import { printSVGs } from '../../functions';
import { clearPrerenderCache, getConfigStore } from '../../services/store';

const { exec } = require('child_process');

const getOrientedSize = (width, height, landscape = false) => {
  return landscape
    ? { width: height, height: width }
    : { width, height };
};

const getAutoPrintLandscape = ({ paperWidth, paperHeight, printLandscape, pageWidth, pageHeight, pageLandscape }) => {
  const paperSize = getOrientedSize(paperWidth, paperHeight, printLandscape);
  const pageSize = getOrientedSize(pageWidth, pageHeight, pageLandscape);
  const paperIsLandscape = paperSize.width > paperSize.height;
  const pageIsLandscape = pageSize.width > pageSize.height;

  if (paperSize.width === paperSize.height || pageSize.width === pageSize.height) {
    return pageLandscape;
  }

  return paperIsLandscape === pageIsLandscape ? pageLandscape : !pageLandscape;
};

async function getPrinters() {
  return new Promise((resolve, reject) => {
    const cmd = 'powershell -NoProfile -Command "Add-Type -AssemblyName System.Drawing; $default = [System.Drawing.Printing.PrinterSettings]::DefaultPageSettings.PrinterName; $list = @(); foreach($p in [System.Drawing.Printing.PrinterSettings]::InstalledPrinters){ $s=New-Object System.Drawing.Printing.PrinterSettings; $s.PrinterName=$p; $ps=$s.DefaultPageSettings; $sizes=$s.PaperSizes|ForEach-Object{ [PSCustomObject]@{ name=$_.PaperName; widthMm=[Math]::Round($_.Width*0.254,1); heightMm=[Math]::Round($_.Height*0.254,1) } }|Sort-Object name|Get-Unique -AsString; $o=[PSCustomObject]@{ printerName=$p; isDefault=($p -eq $default); paperSizes=@($sizes); defaultPaperSize=$ps.PaperSize.PaperName; defaultWidthMm=[Math]::Round($ps.PaperSize.Width*0.254,1); defaultHeightMm=[Math]::Round($ps.PaperSize.Height*0.254,1); isLandscape=$ps.Landscape }; $list+=$o }; $list|ConvertTo-Json -Depth 5"';

    exec(cmd, { encoding: 'utf8' }, (err, stdout) => {
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


export default (getMainWindow) => {
  ipcMain.on(eleActions.getPrinters, async (event, args) => {
    const { returnChannel } = args;
    const mainWindow = getMainWindow();

    try {
      const printers = await getPrinters();
      mainWindow.webContents.send(returnChannel, { printers });

    } catch (err) {
      mainWindow.webContents.send(returnChannel, { printers: [] });
    }
  });
  ipcMain.on(eleActions.adjustGuidePrint, async (event, args) => {
    const { returnChannel, printConfig } = args;
    const mainWindow = getMainWindow();

    function renderGuidePrintFunction (doc) {
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
        contentWidthMm: paperWidth,
        contentHeightMm: paperHeight,
        landscape,
        paperSize: printConfig?.paperSize !== '_' ? printConfig?.paperSize : undefined,
      })
      if (!rs.success) {
        console.error('Guide print failed:', rs);
      }
      mainWindow.webContents.send(returnChannel, rs.success);
    } catch (e) {
      console.error('Guide print exception:', e);
      mainWindow.webContents.send(returnChannel, false);
    }
  });

  ipcMain.on(eleActions.printPages, async (event, args) => {
    const { returnChannel, CardList, globalBackground, pageList, printConfig } = args;
    const mainWindow = getMainWindow();
    const { Config } = getConfigStore();
    const state = { CardList, globalBackground };

    // List available printers
    try {
      const effectiveLandscape = getAutoPrintLandscape({
        paperWidth: printConfig.paperWidth,
        paperHeight: printConfig.paperHeight,
        printLandscape: printConfig.isLandscape,
        pageWidth: Config.pageWidth,
        pageHeight: Config.pageHeight,
        pageLandscape: Config.landscape,
      });
      const printConfigForRender = { ...Config, landscape: effectiveLandscape };

      clearPrerenderCache();
      const result = await Promise.all([...pageList.map(v => prerenderPage(v - 1, state, printConfigForRender, exportFile, 'exportFile', 'high'))]);
      const rs = await printSVGs(printConfig.defaultPrinter, result, {
        pageWidthMm: printConfig.paperWidth,
        pageHeightMm: printConfig.paperHeight,
        contentWidthMm: Config.pageWidth,
        contentHeightMm: Config.pageHeight,
        contentLandscape: effectiveLandscape,
        landscape: printConfig.isLandscape,
        paperSize: printConfig.paperSize,
        offsetXmm: printConfig.offsetX,
        offsetYmm: printConfig.offsetY,
        scaleX: printConfig.scaleX / 100,
        scaleY: printConfig.scaleY / 100,
      })
      if (!rs.success) {
        console.error('Print failed:', rs, {
          printer: printConfig.defaultPrinter,
          paperSize: printConfig.paperSize,
          paperWidth: printConfig.paperWidth,
          paperHeight: printConfig.paperHeight,
          landscape: printConfig.isLandscape,
          contentLandscape: effectiveLandscape,
          offsetX: printConfig.offsetX,
          offsetY: printConfig.offsetY,
          scaleX: printConfig.scaleX,
          scaleY: printConfig.scaleY,
        });
      }
      mainWindow.webContents.send(returnChannel, rs.success);
    } catch (e) {
      console.error('Print exception:', e);
      mainWindow.webContents.send(returnChannel, false);
    }
  });
}
import { ipcMain } from 'electron';
import { eleActions, initialState, layoutSides } from '../../../shared/constants';
import { exportFile, prerenderPage } from '../../services/file_render';
import { printSVGs } from '../../functions';
import { clearPrerenderCache, getConfigStore } from '../../services/store';


function getSystemDefaultPrinterName() {
  return new Promise((resolve) => {
    const { exec } = require('child_process');

    if (process.platform === 'win32') {
      // ✅ 已修复：Default=TRUE 在下一行，Name=在后
      exec('wmic printer get Name,Default /value', (err, stdout) => {
        if (err) {
          console.error('获取默认打印机失败:', err);
          return resolve(null);
        }

        let defaultFound = false;
        let defaultPrinter = null;

        // 按行解析
        const lines = stdout.split(/\r?\n/).map(line => line.trim());

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // 匹配 Default=TRUE
          if (line === 'Default=TRUE') {
            defaultFound = true;
          }

          // 匹配 Name= 并且上一行是 Default=TRUE
          if (defaultFound && line.startsWith('Name=')) {
            defaultPrinter = line.replace('Name=', '').trim();
            break;
          }

          // 遇到空行重置状态
          if (line === '') {
            defaultFound = false;
          }
        }

        resolve(defaultPrinter);
      });
    } else if (process.platform === 'darwin') {
      // macOS
      exec('lpstat -d', (err, stdout) => {
        if (err) return resolve(null);
        const match = stdout.match(/system default destination: (.+)/i);
        resolve(match ? match[1].trim() : null);
      });
    } else {
      // Linux
      exec('lpstat -d', (err, stdout) => {
        if (err) return resolve(null);
        const match = stdout.match(/default destination: (.+)/i);
        resolve(match ? match[1].trim() : null);
      });
    }
  });
}

export default (mainWindow) => {
  ipcMain.on(eleActions.getPrinters, async (event, args) => {
    const { returnChannel } = args;

    try {
      let printers = await mainWindow.webContents.getPrintersAsync();
      const defaultPrinterName = await getSystemDefaultPrinterName();
      printers = printers.map(p => ({
        ...p,
        isDefault: p.name === defaultPrinterName, // 模拟出来
      }));
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
      const rs = await printSVGs('', result, {
        pageWidthMm: Config.pageWidth,
        pageHeightMm: Config.pageHeight,
        landscape: Config.landscape,
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
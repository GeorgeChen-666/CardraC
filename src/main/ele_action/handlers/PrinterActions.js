import { ipcMain } from 'electron';
import { eleActions, initialState, layoutSides } from '../../../shared/constants';
import { exportFile, prerenderPage } from '../../services/file_render';
import { printSVGs } from '../../functions';
import { clearPrerenderCache, getConfigStore } from '../../services/store';

const { exec } = require('child_process');

// 万能获取默认打印机：Win11/Win10/Win7/macOS/Linux 全兼容
async function getSystemDefaultPrinterName() {
  try {
    if (process.platform === 'win32') {
      // 1. 优先用 PowerShell CIM（Win10/11 通用，无WMIC）
      const psName = await getDefaultByPowerShell();
      if (psName) return psName;

      // 2. 降级用 WMIC（老系统兼容）
      const wmicName = await getDefaultByWMIC();
      if (wmicName) return wmicName;
    }

    // macOS / Linux
    if (process.platform === 'darwin' || process.platform === 'linux') {
      const posixName = await getDefaultByPosix();
      if (posixName) return posixName;
    }
  } catch (e) {}

  return null;
}

// Windows 10/11 推荐（无WMIC）
function getDefaultByPowerShell() {
  return new Promise(resolve => {
    exec(
      'powershell -Command "Get-CimInstance -ClassName Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -ExpandProperty Name"',
      (err, stdout) => {
        if (err || !stdout?.trim()) return resolve(null);
        resolve(stdout.trim());
      }
    );
  });
}

// Windows 老系统兼容
function getDefaultByWMIC() {
  return new Promise(resolve => {
    exec('wmic printer get Name,Default /value', (err, stdout) => {
      if (err || !stdout) return resolve(null);

      let defaultFound = false;
      let defaultPrinter = null;
      const lines = stdout.split(/\r?\n/).map(l => l.trim());

      for (const line of lines) {
        if (line === 'Default=TRUE') defaultFound = true;
        if (defaultFound && line.startsWith('Name=')) {
          defaultPrinter = line.replace('Name=', '').trim();
          break;
        }
        if (line === '') defaultFound = false;
      }

      resolve(defaultPrinter);
    });
  });
}

// macOS / Linux
function getDefaultByPosix() {
  return new Promise(resolve => {
    exec('lpstat -d', (err, stdout) => {
      if (err || !stdout) return resolve(null);
      const match = stdout.match(/(default destination|system default destination):\s*(.+)/i);
      resolve(match?.[2]?.trim() || null);
    });
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
      const rs = await printSVGs(printConfig.defaultPrinter, result, {
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
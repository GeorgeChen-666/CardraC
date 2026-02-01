import { ipcMain } from 'electron';
import { eleActions, initialState, layoutSides } from '../../../shared/constants';
import { exportFile } from './file_render';
import { getConfigStore, printPNGs } from '../functions';
import { clearPrerenderCache, prerenderPage } from './file_render/Utils';




export default (mainWindow) => {
  ipcMain.on(eleActions.getPrinters, async (event, args) => {
    const { returnChannel, progressChannel } = args;

    // List available printers
    const printers = await mainWindow.webContents.getPrintersAsync();
    mainWindow.webContents.send(returnChannel, {
      printers
    });

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
      const rs = await printPNGs('', [result])
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
      const rs = await printPNGs('', result, {
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
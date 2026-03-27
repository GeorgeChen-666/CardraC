import { exportFile } from '../services/file_render';
import { saveDataToFile } from '../functions';
import { getPagedImageListByCardList } from '../services/file_render/utils';
import { eleActions, exportType, layoutSides } from '../../shared/constants';
import { SharpAdapter } from '../services/file_render/adapter/SharpAdapter';
import { JsPDFAdapter } from '../services/file_render/adapter/JsPdfAdapter';
import JSZip from 'jszip';
const packageJson = require('/package.json');
import { SVGAdapter } from '../services/file_render/adapter/SVGAdapter';
import { getConfigStore } from '../services/store';

export default (wsManager) => {
  wsManager.on(eleActions.exportFile, async (event, args) => {
    const { CardList, globalBackground, targetFileType, returnChannel, progressChannel, filePath } = args;
    const { Config } = getConfigStore();
    let extension = targetFileType;
    const state = { CardList, globalBackground };
    const pagedImageList = getPagedImageListByCardList(state, Config);
    if((pagedImageList.length > (Config.sides === layoutSides.foldInHalf ? 2 : 1)) && targetFileType !== exportType.pdf) {
      extension = exportType.zip;
    }
    progressChannel && wsManager.send(progressChannel, 0.1);
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
      progressChannel && wsManager.send(progressChannel, 0.3);
      const blob = await exportFile(doc, state);
      progressChannel && wsManager.send(progressChannel, 0.5);
      let returnContent = blob;
      if(Array.isArray(blob) && blob.length > 1) {
        const zip = new JSZip();

        blob.forEach((page, pageNumber) => {
          const fileName = `page${pageNumber}.${targetFileType}`;
          zip.file(fileName, page.buffer || page);
        });

        returnContent = await zip.generateAsync({
          type: 'nodebuffer',
          compression: 'DEFLATE',
          compressionOptions: { level: 9 }
        });
      }
      progressChannel && wsManager.send(progressChannel, 0.7);
      await saveDataToFile(returnContent, filePath);
      progressChannel && wsManager.send(progressChannel, 1);
      wsManager.send(returnChannel, true);
    }
    catch (e) {
      wsManager.send('notification', {
        status: 'error',
        description: "util.operationFailed"
      });
      wsManager.send(returnChannel, false);
    }
  });

  wsManager.on('version', async (event, args) => {
    wsManager.send(args.returnChannel, packageJson.version);
  });
}
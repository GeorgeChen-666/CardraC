import { dialog, ipcMain } from 'electron';
import fs from 'fs';

import { readCompressedImage } from '../functions';
import { eleActions } from '../../../public/constants';
import { ImageStorage, OverviewStorage } from './pdf/Utils';
import Store from 'electron-store';

const store = new Store();
const ImageStorageLoadingJobs = {

}
const pendingList = new Set();
export const getPendingList = () => pendingList;

const pathToImageData = async (path, cb) => {
  const { Config } = store.get() || {};
  const cardWidth = Config.cardWidth;
  const compressLevel = Config.compressLevel || 2;
  const compressParamsList = [
    { maxWidth : cardWidth * 15, quality : 100},
    { maxWidth : cardWidth * 12, quality : 90},
    { maxWidth : cardWidth * 9, quality : 80},
    { maxWidth : cardWidth * 6, quality : 70},
  ]

  const ext = path.split('.').pop();
  const imagePathKey = path.replaceAll('\\','');
  const { mtime } = fs.statSync(path);
  const returnObj = { path, mtime: mtime.getTime() }

  if(!Object.keys(ImageStorage).includes(imagePathKey) && !pendingList.has(imagePathKey)) {
    pendingList.add(imagePathKey);
    ImageStorageLoadingJobs[path] = async() => {
      ImageStorage[imagePathKey] = await readCompressedImage(path, { format: ext, ...compressParamsList[compressLevel - 1] });
      pendingList.delete(imagePathKey);
      delete ImageStorageLoadingJobs[path];
    }
    ImageStorageLoadingJobs[path]();
  }
  returnObj.overviewData = await readCompressedImage(path, { maxWidth: 100 });
  OverviewStorage[imagePathKey] = returnObj.overviewData;
  cb && cb();
  return returnObj;
}

export default (mainWindow) => {
  ipcMain.on(eleActions.getImageContent, async (event, args) => {
    const { path, returnChannel } = args;
    const { Config } = store.get() || {};
    const cardWidth = Config.cardWidth;

    const ext = path.split('.').pop();
    const imagePathKey = path.replaceAll('\\','');
    await pathToImageData(path);
    const imageData = ImageStorage[imagePathKey];
    const buffer = Buffer.from(imageData.split(',')[1], 'base64');
    const newData = await readCompressedImage(buffer, { format: ext, maxWidth : cardWidth * 2, quality : 60 })
    mainWindow.webContents.send(returnChannel, Buffer.from(newData));
  });
  ipcMain.on(eleActions.getImagePath, async (event, args) => {
    const { properties = [], returnChannel } = args;
    const result = await dialog.showOpenDialog(mainWindow,{
      filters: [
        { name: 'Image File', extensions: ['jpg', 'png', 'gif'] }
      ],
      properties: ['openFile', ...properties],
    });
    if (result.canceled) {
      mainWindow.webContents.send(returnChannel, '');
    }
    else {
      mainWindow.webContents.send(returnChannel, result.filePaths[0]);
    }
  });
  ipcMain.on(eleActions.openImage, async (event, args) => {
    const { properties = [], returnChannel, progressChannel } = args;
    const result = await dialog.showOpenDialog(mainWindow,{
      filters: [
        { name: 'Image File', extensions: ['jpg', 'png', 'gif'] }
      ],
      properties: ['openFile', ...properties],
    });
    if (result.canceled) {
      mainWindow.webContents.send(returnChannel, []);
    }
    else {
      const toRenderData = [];
      let current = 0;
      for(const path of result.filePaths) {
        toRenderData.push(pathToImageData(path, () => {
          current ++;
          mainWindow.webContents.send(progressChannel, current / result.filePaths.length);
        }))
      }
      mainWindow.webContents.send(returnChannel, await Promise.all(toRenderData));
    }
  });
  ipcMain.on(eleActions.checkImage, async (event, args) => {
    const pathList = JSON.parse(JSON.stringify(args.pathList));
    const invalidImages = [];
    const checkImagePath = path => {
      try {
        fs.accessSync(path,fs.constants.F_OK);
      }
      catch (e) {
        invalidImages.push(path);
      }

    }
    pathList.forEach(path => {
      checkImagePath(path);
    })
    mainWindow.webContents.send(args.returnChannel, invalidImages);
  });
  ipcMain.on(eleActions.reloadLocalImage, async (event, args) => {
    const { CardList, globalBackground, returnChannel, progressChannel } = args;
    const { Config } = store.get() || {};
    Config.globalBackground = globalBackground;

    const reloadImageJobs = [];
    const newOverviewStorage = {};
    Object.keys(ImageStorage).forEach(k => {
      delete ImageStorage[k];
    })
    let totalCount = 0;
    let currentCound = 0;
    const reloadImage = (args, cb) => {
      if(!args) return false;
      const { path, mtime: cardMtime} = args;
      const imagePathKey = path.replaceAll('\\','');
      try {
        const { mtime } = fs.statSync(path);
        if(cardMtime !== mtime.getTime() || !Object.keys(ImageStorage).includes(imagePathKey)) {
          totalCount++;
          reloadImageJobs.push((async()=>{
            cb && cb(mtime.getTime())
            const {overviewData} = await pathToImageData(path);
            newOverviewStorage[imagePathKey] = overviewData;
            OverviewStorage[imagePathKey] = overviewData;
            currentCound++;
            mainWindow.webContents.send(progressChannel, currentCound / totalCount);
          })());
          return true;
        }
        else {
          throw new Error();
        }
      } catch (e) {
        newOverviewStorage[imagePathKey] = OverviewStorage[imagePathKey];
      }
      return false;
    }
    CardList.forEach((card, index) => {
      reloadImage(card.face, newMtime => {
        CardList[index].face.mtime = newMtime;
        delete CardList[index].id;
      });
      reloadImage(card.back, newMtime => {
        CardList[index].back.mtime = newMtime;
        delete CardList[index].id;
      });
    });
    reloadImage(Config.globalBackground, newMtime => {
      Config.globalBackground.mtime = newMtime;
    });
    await Promise.all(reloadImageJobs);
    mainWindow.webContents.send(progressChannel, 1);
    mainWindow.webContents.send(returnChannel, {...state, OverviewStorage: newOverviewStorage});
  });
}
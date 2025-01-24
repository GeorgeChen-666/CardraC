import { dialog, ipcMain } from 'electron';
import fs from 'fs';

import { readCompressedImage } from '../functions';
import { eleActions } from '../../../public/constants';
import { ImageStorage } from './pdf/Utils';

const ImageStorageLoadingJobs = {

}
const pathToImageData = async path => {
  const ext = path.split('.').pop();
  const imagePathKey = path.replaceAll('\\','');
  const { mtime } = fs.statSync(path);
  const returnObj = { path, mtime: mtime.getTime() }
  if(!Object.keys(ImageStorage).includes(imagePathKey)) {
    ImageStorageLoadingJobs[path] = async() => {
      ImageStorage[imagePathKey] = await readCompressedImage(path, { format: ext });
      delete ImageStorageLoadingJobs[path];
    }
    ImageStorageLoadingJobs[path]();
    returnObj.overviewData = await readCompressedImage(path, { maxWidth: 100 });
  }
  return returnObj;
}

export default (mainWindow) => {
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
    const { properties = [], returnChannel } = args;
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
      for(const path of result.filePaths) {
        toRenderData.push(pathToImageData(path))
      }

      mainWindow.webContents.send(returnChannel, await Promise.all(toRenderData));
    }
  });
  ipcMain.on(eleActions.checkImage, async (event, args) => {
    const pathList = JSON.parse(JSON.stringify(args.pathList));
    const invalidImages = [];
    const checkImagePath = path => {
      if(path === '_emptyImg') return;
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
  ipcMain.on('reload-local-image', async (event, args) => {
    const { returnChannel, progressChannel } = args;
    const state = JSON.parse(JSON.stringify(args.state));
    const { Config, CardList, OverviewStorage } = state;
    const reloadImageJobs = [];
    const newOverviewStorage = {};
    Object.keys(ImageStorage).filter(k => k!=='_emptyImg').forEach(k => {
      delete ImageStorage[k];
    })
    let totalCount = 0;
    let currentCound = 0;
    const reloadImage = (args, cb) => {
      if(!args) return false;
      const { path, mtime: cardMtime} = args;
      if(path === '_emptyImg') return true;
      const imagePathKey = path.replaceAll('\\','');
      try {
        const { mtime } = fs.statSync(path);
        if(cardMtime !== mtime.getTime()) {
          totalCount++;
          reloadImageJobs.push((async()=>{
            cb && cb(mtime.getTime())
            const {overviewData} = await pathToImageData(path);
            newOverviewStorage[imagePathKey] = overviewData;
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
import { dialog, ipcMain } from 'electron';
import { eleActions } from '../../../public/constants';
import { getConfigStore, saveDataToFile } from '../functions';
import fs from 'fs';
import { defaultImageStorage, ImageStorage, OverviewStorage } from './pdf/Utils';


const refreshCardStorage = (CardList, globalBackground) => {
  const usedImagePath = new Set();
  CardList.forEach(card => {
    const {face,back} = card;
    const facePathKey  = face?.path.replaceAll('\\','');
    const backPathKey  = back?.path.replaceAll('\\','');
    usedImagePath.add(facePathKey);
    usedImagePath.add(backPathKey);
  });

  if(globalBackground?.path) {
    const globalBackPathKey = globalBackground?.path?.replaceAll('\\','');
    usedImagePath.add(globalBackPathKey);
  }

  Object.keys(OverviewStorage).filter(key=> !usedImagePath.has(key)).forEach(key => delete OverviewStorage[key]);
  Object.keys(ImageStorage).filter(key=> !usedImagePath.has(key)).forEach(key => delete ImageStorage[key]);
}
const loadCpnpFile = (filePath, { onProgress, onFinish, onError }) => {
  const { size } = fs.statSync(filePath);
  const readStream = fs.createReadStream(filePath);
  let resultString = '';
  readStream.on('data', (chunk) => {
    resultString += chunk;
    onProgress && onProgress(resultString.length / size);
  });

  readStream.on('end', () => {
    try {
      const regexPattern = '"ImageStorage"\\s*:\\s*\\{(?:[^\\{\\}]*|\\{[^\\{\\}]*\\})*\\}';
      const imageStorageRegexp = new RegExp(regexPattern, 'g');
      let [imageStorageString= ''] = resultString.match(imageStorageRegexp) || [];
      if(imageStorageString.endsWith(',')) {
        imageStorageString = imageStorageString.substring(0, imageStorageString.length - 1);
      }
      (async () => {
        const imageStorageJson = JSON.parse(`{${imageStorageString}}`);
        Object.keys(ImageStorage).forEach(key => {
          if(!Object.keys(imageStorageJson.ImageStorage).includes(key)) {
            delete ImageStorage[key];
          }
        });
        Object.keys(imageStorageJson.ImageStorage).forEach(key => {
          ImageStorage[key] = imageStorageJson.ImageStorage[key];
        });
        if(!Object.keys(ImageStorage).includes('_emptyImg')) {
          ImageStorage['_emptyImg'] = defaultImageStorage['_emptyImg'];
        }
      })()
      const result = resultString.replace(imageStorageString, ('"_":"_"'));
      const projectJson = JSON.parse(result);
      delete projectJson._;
      if(projectJson.Config.globalBackground?.path === '_emptyImg') {
        projectJson.Config.globalBackground = null;
      }

      Object.keys(OverviewStorage).forEach(key => {
        if(!Object.keys(projectJson.OverviewStorage).includes(key)) {
          delete OverviewStorage[key];
        }
      });
      Object.keys(projectJson.OverviewStorage).forEach(key => {
        OverviewStorage[key] = projectJson.OverviewStorage[key];
      });
      projectJson.CardList.forEach(c => {
        if(c.face?.path === '_emptyImg') {
          c.face = null;
        }
        if(c.back?.path === '_emptyImg') {
          c.back = null;
        }
      })
      onFinish && onFinish(projectJson);
    }
    catch (e) {
      onError && onError();
    }

  });
  readStream.on('error', (err) => {
    console.log(err);
    onError && onError();
  });
}

export default (mainWindow) => {
  const renderLog = (...args) => setTimeout(() => mainWindow.webContents.send('console', args), 2000) ;

  const filePath = process.argv.find(arg => arg.endsWith('.cpnp'));
  if (filePath) {
    setTimeout(() => {
      loadCpnpFile(filePath, {
        //onProgress: (v) => mainWindow.webContents.send(progressChannel, v),
        onFinish: (projectJson) => mainWindow.webContents.send('open-project-file', projectJson),
        onError: () => {
          mainWindow.webContents.send('notification', {
            status: 'error',
            description: "util.invalidFile"
          });
          //mainWindow.webContents.send(returnChannel, null);
        }
      });
    }, 1000);

  }

  ipcMain.on(eleActions.saveProject, async (event, args) => {
    const { CardList, globalBackground, returnChannel } = args;
    const result = await dialog.showSaveDialog(mainWindow,{
      title: 'Save Project',
      defaultPath: 'myProject.cpnp',
      filters: [
        { name: 'Project file', extensions: ['cpnp'] }
      ]
    });
    if (result.canceled) {
      mainWindow.webContents.send(returnChannel, false);
    } else {
      const projectPath = result.filePath;
      const { Config } = getConfigStore();
      Config.globalBackground = globalBackground;
      const projectData = { Config, CardList };

      const imageStorageKeys = Object.keys(ImageStorage);
      imageStorageKeys.forEach(key => {
        if(!Object.keys(OverviewStorage).includes(key) && key !== '_emptyImg') {
          delete ImageStorage[key];
        }
      })
      refreshCardStorage(CardList, globalBackground);
      try {
        await saveDataToFile({ ...projectData, ImageStorage, OverviewStorage }, projectPath);
      }
      catch (e) {
        mainWindow.webContents.send('notification', {
          status: 'error',
          description: "util.operationFailed"
        });
      }
      finally {
        mainWindow.webContents.send(returnChannel, true);
      }
    }
  });

  ipcMain.on(eleActions.openProject, async (event, args) => {
    const { properties = [], returnChannel, progressChannel } = args;
    const result = await dialog.showOpenDialog(mainWindow,{
      filters: [
        { name: 'Project File', extensions: ['cpnp'] }
      ],
      properties: ['openFile', ...properties],
    });
    if (result.canceled) {
      mainWindow.webContents.send(returnChannel, null);
    }
    else {
      loadCpnpFile(result.filePaths[0], {
        onProgress: (v) => mainWindow.webContents.send(progressChannel, v),
        onFinish: (projectJson) => mainWindow.webContents.send(returnChannel, projectJson),
        onError: () => {
          mainWindow.webContents.send('notification', {
            status: 'error',
            description: "util.invalidFile"
          });
          mainWindow.webContents.send(returnChannel, null);
        }
      });

    }


  });
}
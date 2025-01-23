import { dialog, ipcMain } from 'electron';
import { eleActions } from '../../../public/constants';
import _ from 'lodash';
import { readFileToData, saveDataToFile } from '../functions';
import fs from 'fs';
import { ImageStorage } from './pdf/Utils';


export default (mainWindow) => {
  const renderLog = (...args) => setTimeout(() => mainWindow.webContents.send('console', args), 2000) ;
  const filePath = process.argv.find(arg => arg.endsWith('.cpnp'))
  if (filePath) {
    setTimeout(()=>{
      readFileToData(filePath).then(toRenderData => {
        renderLog(filePath, toRenderData);
        mainWindow.webContents.send('open-project-file', toRenderData);
      });
    },100)
  }

  ipcMain.on(eleActions.saveProject, async (event, args) => {
    const { state, returnChannel } = args;
    let projectPath = state.Global.projectPath;
    if(projectPath === '') {
      const result = await dialog.showSaveDialog(mainWindow,{
        title: 'Save Project',
        defaultPath: 'myProject.cpnp',
        filters: [
          { name: 'Project file', extensions: ['cpnp'] }
        ]
      });
      if (result.canceled) { return; }
      else {
        projectPath = result.filePath;
      }
    }
    const projectData = _.pick(state, ['Config', 'CardList']);

    const imageStorageKeys = Object.keys(ImageStorage);
    imageStorageKeys.forEach(key => {
      if(!Object.keys(state.OverviewStorage).includes(key) && key !=='_emptyImg') {
        delete ImageStorage[key];
      }
    })

    await saveDataToFile({ ...projectData, ImageStorage, OverviewStorage: state.OverviewStorage }, projectPath);
    mainWindow.webContents.send(returnChannel);
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
      const { size } = fs.statSync(result.filePaths[0]);
      const readStream = fs.createReadStream(result.filePaths[0]);
      let resultString = '';
      readStream.on('data', (chunk) => {
        resultString += chunk;
        mainWindow.webContents.send(progressChannel, resultString.length / size);
      });

      readStream.on('end', () => {
        try {
          const imageStorageRegexp = new RegExp(/"ImageStorage":\{".*?"\}(,)?/g);
          let [imageStorageString= ''] = resultString.match(imageStorageRegexp) || [];
          if(imageStorageString.endsWith(',')) {
            imageStorageString = imageStorageString.substring(0, imageStorageString.length - 1);
          }
          (async () => {
            const imageStorageJson = JSON.parse(`{${imageStorageString}}`);
            Object.keys(ImageStorage).forEach(key => {
              if(!Object.keys(imageStorageJson.ImageStorage).includes(key) && key !== '_emptyImg') {
                delete ImageStorage[key];
              }
            });
            Object.keys(imageStorageJson.ImageStorage).forEach(key => {
              ImageStorage[key] = imageStorageJson.ImageStorage[key];
            });
          })()
          const result = resultString.replace(imageStorageString, ('"_":"_"'));
          const projectJson = JSON.parse(result);
          delete projectJson._;
          mainWindow.webContents.send(returnChannel, projectJson);
        }
        catch (e) {
          mainWindow.webContents.send('notification', {
            status: 'error',
            description: "文件损坏.."
          });
          mainWindow.webContents.send(returnChannel, null);
        }

      });
      readStream.on('error', (err) => {
        console.log(err);
      });

    }


  });
}
const { readCompressedImage } = require('./functions');
const { base64ToBuffer, readFileToData, saveDataToFile } = require('./functions');
const fs = require('fs')
const path = require('path')
const { exportPdf, ImageStorage } = require('./ExportPdf');
const { app, dialog, ipcMain } = require('electron');
const _ = require('lodash');
const Store = require('electron-store');

const electron = require('electron');

if (typeof electron === 'string') {
  throw new TypeError('Not running in an Electron environment!');
}

const {env} = process; // eslint-disable-line n/prefer-global/process
const isEnvSet = 'ELECTRON_IS_DEV' in env;
const getFromEnv = Number.parseInt(env.ELECTRON_IS_DEV, 10) === 1;
export const isDev = isEnvSet ? getFromEnv : !electron?.app?.isPackaged;

const ImageStorageLoadingJobs = {

}
const pathToImageData = async path => {
  const ext = path.split('.').pop();
  ImageStorageLoadingJobs[path] = async() => {
    ImageStorage[path.replaceAll('\\','')] = await readCompressedImage(path, { format: ext });
    delete ImageStorageLoadingJobs[path];
  }
  ImageStorageLoadingJobs[path]();
  const overviewData = await readCompressedImage(path, { maxWidth: 100 });
  const { mtime } = fs.statSync(path);
  return ({ path, overviewData, mtime: mtime.getTime() });
}

const store = new Store();
const initLanguageJson = (lang) => {
  const en = new Store({name: lang, cwd: 'locales'});
  if(en.size === 0 || isDev) {
    en.set(require(`./locales/${lang}.json`));
  }
}
export const registerRendererActionHandlers = (mainWindow) => {
  ipcMain.on('export-pdf', async (event, args) => {
    const result = await dialog.showSaveDialog(mainWindow,{
      title: 'Save PDF',
      defaultPath: 'pnp.pdf',
      filters: [
        { name: 'pdf', extensions: ['pdf'] }
      ]
    });
    if (result.canceled) {
      mainWindow.webContents.send('export-pdf-done', false);
    }
    else {
      const blob = await exportPdf(args.state, (progress) => {
        mainWindow.webContents.send('export-pdf-progress', progress);
      });
      const filePath = result.filePath;
      await saveDataToFile(blob, filePath);
      mainWindow.webContents.send('export-pdf-done', true);
    }
  });

  ipcMain.on('open-image', async (event, args) => {
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

  ipcMain.on('save-project', async (event, args) => {
    const { state } = args;
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
    await saveDataToFile({ ...projectData, ImageStorage, OverviewStorage: state.OverviewStorage }, projectPath);
    mainWindow.webContents.send('save-project-done');
  });

  ipcMain.on('open-project', async (event, args) => {
    const { properties = [], returnChannel } = args;
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
      //const toRenderData = await readFileToData(result.filePaths[0]);
      const readStream = fs.createReadStream(result.filePaths[0]);
      let resultString = '';
      readStream.on('data', (chunk) => {
        resultString += chunk;
      });

      readStream.on('end', () => {
        const imageStorageRegexp = new RegExp(/"ImageStorage":\{".*?"\}(,)?/g);
        (async () => {
          let [imageStorageString] = resultString.match(imageStorageRegexp) || [];
          if(imageStorageString.endsWith(',')) {
            imageStorageString = imageStorageString.substring(0, imageStorageString.length - 1);
          }
          const imageStorageJson = JSON.parse(`{${imageStorageString}}`);
          Object.keys(ImageStorage).forEach(key => {
            if(!Object.keys(imageStorageJson.ImageStorage).includes(key)) {
              delete ImageStorage[key];
            }
          });
          Object.keys(imageStorageJson.ImageStorage).forEach(key => {
            ImageStorage[key] = imageStorageJson.ImageStorage[key];
          });
        })()
        const result = resultString.replace(imageStorageRegexp, '');
        const projectJson = JSON.parse(result);
        mainWindow.webContents.send(returnChannel, projectJson);
      });
      readStream.on('error', (err) => {
        console.log(err);
      });

    }
  });

  ipcMain.on('save-config', (event, args) => {
    const { Global, Config } = args.state;
    delete Config.globalBackground;
    store.set({ Global: _.pick(Global, ['currentLang']) });
    store.set({ Config });
  });
  ipcMain.on('load-config', () => {
    initLanguageJson('en');
    initLanguageJson('zh')
    const config = store.get() || {};
    config.Global = config.Global || {};
    config.Global.availableLangs = fs.readdirSync(path.join(app.getPath('userData'), 'locales')).map(p=>p?.split('.')?.[0] || '').filter(p=>!!p);
    config.Global.locales = {};
    config.Global.availableLangs.forEach(lang => {
      config.Global.locales[lang] = new Store({name: lang, cwd: 'locales'}).get();
    })
    mainWindow.webContents.send('load-config-done', config);
  });
  ipcMain.on('reload-local-image', async (event, args) => {
    const state = JSON.parse(JSON.stringify(args.state));
    const { Config, CardList, OverviewStorage } = state;
    const reloadImageJobs = [];
    const reloadImage = (args, cb) => {
      if(!args) return false;
      const { path, mtime: cardMtime} = args;
      const { mtime } = fs.statSync(path);
      if(cardMtime !== mtime.getTime()) {
        reloadImageJobs.push((async()=>{
          const imagePathKey = path.replaceAll('\\','');
          cb && cb(mtime.getTime())
          const {overviewData} = await pathToImageData(path);
          OverviewStorage[imagePathKey] = overviewData;
        })())
        return true;
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
    mainWindow.webContents.send(args.returnChannel, state);
  });
  ipcMain.on('base64-to-buffer', (event, args) => {
    const decodedString = base64ToBuffer(args.base64Data);
    mainWindow.webContents.send(args.returnChannel, decodedString);
  });
}
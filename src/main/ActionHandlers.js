const { base64ToBuffer, readFileToData, saveDataToFile } = require('./functions');
const fs = require('fs')
const path = require('path')
const { exportPdf } = require('./ExportPdf');
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
      const jobList = result.filePaths.map(path => readFileToData(path, 'base64'));
      for(let jobIndex in jobList) {
        const path = result.filePaths[jobIndex];
        const base64String = await jobList[jobIndex];
        const ext = path.split('.').pop();
        const data = `data:image/${ext};base64,${base64String}`;
        const { mtime } = fs.statSync(path);
        toRenderData.push({ path, data, mtime: mtime.getTime() })
      }
      mainWindow.webContents.send(returnChannel, toRenderData);
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
    await saveDataToFile({ ...projectData, ImageStorage: state.ImageStorage }, projectPath);
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
    if (!result.canceled) {
      const toRenderData = await readFileToData(result.filePaths[0]);
      mainWindow.webContents.send(returnChannel, toRenderData);
    }
  });

  ipcMain.on('save-config', (event, args) => {
    const { Global, Config, ImageStorage } = args.state;
    store.set({ Global: _.pick(Global, ['currentLang']) });
    store.set({ Config });
    if(Config.globalBackground?.path) {
      const storageKey = Config.globalBackground?.path.replaceAll('\\','');
      store.set({ ImageStorage: { [storageKey]: ImageStorage[storageKey] } });
    }

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
  ipcMain.on('file-to-object', async (event, args) => {
    const { path, mtime: cardMtime} = args;
    const { mtime } = fs.statSync(path);
    if(cardMtime !== mtime) {
      const base64String = await readFileToData(args.path, 'base64');
      mainWindow.webContents.send(args.returnChannel, {
        data: base64String,
        path: args.path,
        ext: args.path.split('.').pop(),
        mdate: mtime.getTime()
      });
    }
    else {
      mainWindow.webContents.send(args.returnChannel);
    }

  });
  ipcMain.on('base64-to-buffer', (event, args) => {
    const decodedString = base64ToBuffer(args.base64Data);
    mainWindow.webContents.send(args.returnChannel, decodedString);
  });
}
const fs = require('fs')
const path = require('path')
const { exportPdf } = require('./ExportPdf');
const { app, dialog, ipcMain } = require('electron');
const electron = require('electron');
const _ = require('lodash');
const Store = require('electron-store');

const store = new Store();

if (typeof electron === 'string') {
  throw new TypeError('Not running in an Electron environment!');
}

const {env} = process; // eslint-disable-line n/prefer-global/process
const isEnvSet = 'ELECTRON_IS_DEV' in env;
const getFromEnv = Number.parseInt(env.ELECTRON_IS_DEV, 10) === 1;

export const isDev = isEnvSet ? getFromEnv : !electron?.app?.isPackaged;

export const readFileToData = async (filePath, format = '') => {
  const data = await fs.readFileSync(filePath);
  const formatedData = format ? data.toString(format): data.toString();
  return formatedData;
}

export const saveDataToFile = async (data, filePath) => {
  let buffer = null;
  if(typeof data ==='string') {
    buffer = data;
  } else if(typeof data === 'object' && data instanceof Blob) {
    buffer = Buffer.from( await data.arrayBuffer() )
  } else if(typeof data === 'object' && data.constructor === Object) {
    buffer = JSON.stringify(data);
  }
  await fs.writeFileSync(filePath, buffer);
}

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
    if (!result.canceled) {
      const blob = await exportPdf(args.state, (progress) => {
        mainWindow.webContents.send('export-pdf-progress', progress);
      });
      const filePath = result.filePath;
      await saveDataToFile(blob, filePath);
      mainWindow.webContents.send('export-pdf-progress', 100);
      mainWindow.webContents.send('export-pdf-done');
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
    if (!result.canceled) {
      const toRenderData = [];
      const jobList = result.filePaths.map(path => readFileToData(path, 'base64'));
      for(let jobIndex in jobList) {
        const base64String = await jobList[jobIndex];
        toRenderData.push({ path: result.filePaths[jobIndex], data: base64String })
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
    const projectData = _.pick(state, ['Config', 'CardList', 'ImageStorage']);
    await saveDataToFile(projectData, projectPath);
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
    const { Global, Config } = args.state;
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
  ipcMain.on('base64-to-buffer', (event, args) => {
    const buffer = Buffer.from(args.base64Data, 'base64');
    const decodedString = buffer.toString('binary');
    mainWindow.webContents.send(args.returnChannel, decodedString);
  });
}
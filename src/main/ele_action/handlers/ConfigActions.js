import { app, ipcMain } from 'electron';
import _ from 'lodash';
import fs from 'fs';
import path from 'path';
import Store from 'electron-store';
import { eleActions } from '../../../shared/constants';
import { getConfigStore, updateConfigStore } from '../functions';

const getLocalesDir = () => {
  if (app.isPackaged) {
    //打包后：exe目录/resources/locales
    return path.join(process.resourcesPath, 'locales');
  } else {
    //开发环境
    return path.join(app.getAppPath(), 'locales');
  }
};


const initLanguageJson = (lang) => {
  const localesDir = getLocalesDir();
  // 确保目录存在
  if (!fs.existsSync(localesDir)) {
    fs.mkdirSync(localesDir, { recursive: true });
  }
  const en = new Store({
    name: lang,
    cwd: localesDir
  });

  const defaultLangStore = require(`../locales/${lang}.json`);
  en.set(_.merge(defaultLangStore, en.store));
}
const printStore = new Store({ name: 'print_config' });
export default (mainWindow) => {
  ipcMain.on(eleActions.saveConfig, (event, args) => {
    const { Global, Config } = args.state;
    if(Global && Config) {
      delete Config?.globalBackground;
      updateConfigStore({ Config, Global: _.pick(Global, ['currentLang', 'isShowOverView']) });
    }
  });
  ipcMain.on(eleActions.loadConfig, (event, args) => {
    const { returnChannel } = args;
    initLanguageJson('en');
    initLanguageJson('zh');

    const config = getConfigStore();
    config.Global = config.Global || {};

    const localesDir = getLocalesDir();

    if (!fs.existsSync(localesDir)) {
      fs.mkdirSync(localesDir, { recursive: true });
    }

    config.Global.availableLangs = fs.readdirSync(localesDir)
      .map(p => p?.split('.')?.[0] || '')
      .filter(p => !!p);

    config.Global.locales = {};
    config.Global.availableLangs.forEach(lang => {
      config.Global.locales[lang] = new Store({
        name: lang,
        cwd: localesDir
      }).get();
    });

    mainWindow.webContents.send(returnChannel, config);
  });
  ipcMain.on(eleActions.savePrintConfig, (event, args) => {
    const { printConfig } = args;
    printStore.set('printConfig', printConfig);
  });
  ipcMain.on(eleActions.loadPrintConfig, (event, args) => {
    const { returnChannel } = args;
    const result = printStore.get('printConfig', {
        scaleX: 100,
        scaleY: 100,
        offsetX: 0,
        offsetY: 0,
      })
    mainWindow.webContents.send(returnChannel, result);
  });
}
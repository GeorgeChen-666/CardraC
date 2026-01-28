import { app, ipcMain } from 'electron';
import _ from 'lodash';
import fs from 'fs';
import path from 'path';
import Store from 'electron-store';
import { eleActions } from '../../../shared/constants';
import { getConfigStore, updateConfigStore } from '../functions';

// 提取公共函数：获取 locales 目录
const getLocalesDir = () => {
  const appDir = app.isPackaged
    ? path.dirname(app.getPath('exe'))
    : app.getAppPath();
  return path.join(appDir, 'locales');
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
}
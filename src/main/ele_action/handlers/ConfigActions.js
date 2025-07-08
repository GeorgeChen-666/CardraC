import { app, ipcMain } from 'electron';
import _ from 'lodash';
import fs from 'fs';
import path from 'path';
import Store from 'electron-store';
import { eleActions } from '../../../public/constants';
import { getConfigStore, updateConfigStore } from '../functions';

const initLanguageJson = (lang) => {
  const en = new Store({name: lang, cwd: 'locales'});
  const defaultLangStore = require(`../locales/${lang}.json`);
  en.set(_.merge(defaultLangStore, en.store));
}


export default (mainWindow) => {
  ipcMain.on(eleActions.saveConfig, (event, args) => {
    const { Global, Config } = args.state;
    delete Config.globalBackground;
    updateConfigStore({ Config, Global: _.pick(Global, ['currentLang', 'isShowOverView']) });
  });
  ipcMain.on(eleActions.loadConfig, (event, args) => {
    const { returnChannel } = args;
    initLanguageJson('en');
    initLanguageJson('zh')
    const config = getConfigStore();
    config.Global = config.Global || {};
    config.Global.availableLangs = fs.readdirSync(path.join(app.getPath('userData'), 'locales')).map(p=>p?.split('.')?.[0] || '').filter(p=>!!p);
    config.Global.locales = {};
    config.Global.availableLangs.forEach(lang => {
      config.Global.locales[lang] = new Store({name: lang, cwd: 'locales'}).get();
    })
    mainWindow.webContents.send(returnChannel, config);
  });
}
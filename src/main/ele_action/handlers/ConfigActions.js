import { app, ipcMain } from 'electron';
import _ from 'lodash';
import fs from 'fs';
import { eleActions } from '../../../shared/constants';
import { defaultPathStore, getConfigStore, printStore, templateStore, updateConfigStore } from '../../services/store';
import { getLangFilePath, homeDir } from '../../../shared/functions';
import { SimpleStore } from '../../core/SimpleStore';
import path from 'path';

const initLanguageJson = (lang) => {
  const langFilePath = getLangFilePath();
  const filePath = path.join(langFilePath, `${lang}.json`);
  const defaultLangStore = require(`../../locales/${lang}.json`);

  const isNew = !fs.existsSync(filePath);
  if (isNew) {
    const langStore = new SimpleStore(lang, langFilePath);
    langStore.set(defaultLangStore);
  }
};

//获取所有可用语言
const getAvailableLanguages = () => {
  try {
    const langFilePath = getLangFilePath();
    if (!fs.existsSync(langFilePath)) {
      return [];
    }

    return fs.readdirSync(langFilePath)
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
      .filter(lang => lang);
  } catch (e) {
    console.error('Failed to get available languages:', e);
    return [];
  }
};

const getLocale = (lang) => {
  try {
    const langFilePath = getLangFilePath();
    const defaultLangStore = require(`../../locales/${lang}.json`);
    const langStore = new SimpleStore(lang, langFilePath);
    return _.merge({}, defaultLangStore, langStore.get());
  } catch (e) {
    console.error(`Failed to read locale ${lang}:`, e);
  }
  return {};
};

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

    // 获取可用语言列表
    config.Global.availableLangs = getAvailableLanguages();

    // 加载所有语言包
    config.Global.locales = {};
    config.Global.availableLangs.forEach(lang => {
      config.Global.locales[lang] = getLocale(lang);
    });

    mainWindow.webContents.send(returnChannel, config);
  });
  ipcMain.on(eleActions.savePrintConfig, (event, args) => {
    const { printConfig } = args;
    printStore.set(printConfig);
  });
  ipcMain.on(eleActions.loadPrintConfig, (event, args) => {
    const { returnChannel } = args;
    const result = printStore.get({
        scaleX: 100,
        scaleY: 100,
        offsetX: 0,
        offsetY: 0,
      })
    mainWindow.webContents.send(returnChannel, {printConfig: result});
  });
  // 新增：获取默认路径
  ipcMain.on(eleActions.getDefaultPath, (event, args) => {
    const { returnChannel } = args;
    try {
      const { defaultPath } = defaultPathStore.get();
      mainWindow.webContents.send(returnChannel, {
        path: defaultPath || homeDir
      });
    } catch (e) {
      console.error('Failed to read default path from config:', e);
      mainWindow.webContents.send(returnChannel, {
        path: homeDir
      });
    }
  });

  // 新增：保存默认路径
  ipcMain.on(eleActions.setDefaultPath, (event, args) => {
    const { path, returnChannel } = args;
    try {
      defaultPathStore.set({ defaultPath: path });
      if (returnChannel) {
        mainWindow.webContents.send(returnChannel, { success: true });
      }
    } catch (e) {
      console.error('Failed to save default path to config:', e);
      if (returnChannel) {
        mainWindow.webContents.send(returnChannel, { success: false });
      }
    }
  });

  ipcMain.on(eleActions.setTemplate, async (event, args) => {
    const { templateName: TemplateName } = args;

    const { Config } = getConfigStore()
    delete Config.globalBackground;
    const lastStore = templateStore.get();
    const newStore = { templates: [...(lastStore.templates || []).filter(t=> t.TemplateName !== TemplateName), {
        id: new Date().getTime(),
        TemplateName,
        Config
      }]}
    templateStore.set(newStore);
    mainWindow.webContents.send(args.returnChannel);
  });
  ipcMain.on(eleActions.editTemplate, async (event, args) => {
    const { id, templateName: TemplateName } = args;
    const lastStore = templateStore.get();
    const editingItem = (lastStore.templates || []).find(t=> t.id === id);
    if(editingItem) {
      editingItem.TemplateName = TemplateName;
      templateStore.set(lastStore);
    }
    mainWindow.webContents.send(args.returnChannel);
  });
  ipcMain.on(eleActions.deleteTemplate, async (event, args) => {
    const { id } = args;
    const lastStore = templateStore.get();
    const newStore =  { templates: (lastStore.templates || []).filter(t=> t.id !== id) }
    templateStore.set(newStore);
    mainWindow.webContents.send(args.returnChannel);
  });
  ipcMain.on(eleActions.getTemplate, async (event, args) => {
    const lastStore = templateStore.get();
    mainWindow.webContents.send(args.returnChannel, (lastStore.templates || []));
  });
}
import _ from 'lodash';
import fs from 'fs';
import path from 'path';
import { eleActions } from '../../../shared/constants';
import { getConfigStore, updateConfigStore } from '../../functions';
import { isDev, SimpleStore } from '../functions';

const getLangFilePath = () => {
  if (isDev) {
    return path.join(process.cwd(), 'locales');
  } else {
    return path.join(process.resourcesPath, 'locales');
  }
};

const initLanguageJson = (lang) => {
  const langFilePath = getLangFilePath();
  const langStore = new SimpleStore(lang, langFilePath);
  const defaultLangStore = require(`../locales/${lang}.json`);
  langStore.set(_.merge(defaultLangStore, langStore.get()));
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
    const langStore = new SimpleStore(lang, langFilePath);
    return langStore.get();
  } catch (e) {
    console.error(`Failed to read locale ${lang}:`, e);
  }
  return {};
};

const printStore = new SimpleStore('print_config');
export default (wsManager) => {
  wsManager.on(eleActions.saveConfig, (event, args) => {
    const { Global, Config } = args.state;
    if(Global && Config) {
      delete Config?.globalBackground;
      updateConfigStore({ Config, Global: _.pick(Global, ['currentLang', 'isShowOverView']) });
    }
  });
  wsManager.on(eleActions.loadConfig, (event, args) => {
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

    wsManager.send(returnChannel, config);
  });
  wsManager.on(eleActions.savePrintConfig, (event, args) => {
    const { printConfig } = args;
    printStore.set('printConfig', printConfig);
  });
  wsManager.on(eleActions.loadPrintConfig, (event, args) => {
    const { returnChannel } = args;
    const result = printStore.get('printConfig', {
      scaleX: 100,
      scaleY: 100,
      offsetX: 0,
      offsetY: 0,
    })
    wsManager.send(returnChannel, result);
  });
}
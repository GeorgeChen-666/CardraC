const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const { eleActions } = require('../../shared/constants');
const { getConfigStore, updateConfigStore, isDev, SimpleStore } = require('../functions');

const printStore = new SimpleStore('print_config');

const getLangFilePath = () => {
  if (isDev) {
    return path.join(process.cwd(), 'locales');
  } else {
    return path.join(process.resourcesPath, 'locales');
  }
};

//初始化语言文件
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

//读取语言文件
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

const registerConfigAPI = (app, basePath = '/api') => {
  //加载配置
  app.get(`${basePath}/${eleActions.loadConfig}`, (req, res) => {
    try {
      // 初始化语言文件
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
      res.json(config);

    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  //保存配置
  app.post(`${basePath}/${eleActions.saveConfig}`, (req, res) => {
    try {
      const { Global, Config } = req.body;

      if (!Global && !Config) {
        return res.status(400).json({
          success: false,
          error: 'Global or Config is required',
        });
      }

      if (Global && Config) {
        const configCopy = { ...Config };
        delete configCopy.globalBackground;

        updateConfigStore({
          Config: configCopy,
          Global: _.pick(Global, ['currentLang', 'isShowOverView']),
        });
      }

      console.log('✅ Config saved');
      res.json({ success: true });

    } catch (err) {
      console.error('❌ Save config failed:', err);
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  //加载打印配置
  app.get(`${basePath}/${eleActions.loadPrintConfig}`, (req, res) => {
    try {
      const {
        printConfig = {
          scaleX: 100,
          scaleY: 100,
          offsetX: 0,
          offsetY: 0,
        },
      } = printStore.get();
      res.json(printConfig);

    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  //保存打印配置
  app.post(`${basePath}/${eleActions.savePrintConfig}`, (req, res) => {
    try {
      const { printConfig } = req.body;
      if (!printConfig) {
        return res.status(400).json({
          success: false,
          error: 'printConfig is required',
        });
      }
      printStore.set({printConfig})
      res.json({ success: true });
    } catch (err) {
      console.error('❌ Save print config failed:', err);
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

};

module.exports = { registerConfigAPI };

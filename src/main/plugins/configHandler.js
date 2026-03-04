const fs = require('fs');
const path = require('path');
const os = require('os');
const _ = require('lodash');
const { eleActions } = require('../../shared/constants');
const { getConfigStore, updateConfigStore } = require('../ele_action/functions');

// ✅ 配置文件路径
const CONFIG_DIR = path.join(os.homedir(), '.cardrac');
const LOCALES_DIR = path.join(CONFIG_DIR, 'locales');
const PRINT_CONFIG_FILE = path.join(CONFIG_DIR, 'print_config.json');

// ✅ 确保目录存在
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

if (!fs.existsSync(LOCALES_DIR)) {
  fs.mkdirSync(LOCALES_DIR, { recursive: true });
}

// ✅ 初始化语言文件
const initLanguageJson = (lang) => {
  try {
    const langFilePath = path.join(LOCALES_DIR, `${lang}.json`);

    // 读取默认语言包
    const defaultLangPath = path.join(__dirname, '../ele_action/locales', `${lang}.json`);
    let defaultLangStore = {};

    if (fs.existsSync(defaultLangPath)) {
      defaultLangStore = JSON.parse(fs.readFileSync(defaultLangPath, 'utf-8'));
    }

    // 读取用户自定义语言包
    let userLangStore = {};
    if (fs.existsSync(langFilePath)) {
      userLangStore = JSON.parse(fs.readFileSync(langFilePath, 'utf-8'));
    }

    // 合并并保存
    const mergedLang = _.merge({}, defaultLangStore, userLangStore);
    fs.writeFileSync(langFilePath, JSON.stringify(mergedLang, null, 2), 'utf-8');

    return mergedLang;
  } catch (e) {
    console.error(`Failed to init language ${lang}:`, e);
    return {};
  }
};

// ✅ 获取所有可用语言
const getAvailableLanguages = () => {
  try {
    if (!fs.existsSync(LOCALES_DIR)) {
      return [];
    }

    return fs.readdirSync(LOCALES_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
      .filter(lang => lang);
  } catch (e) {
    console.error('Failed to get available languages:', e);
    return [];
  }
};

// ✅ 读取语言文件
const getLocale = (lang) => {
  try {
    const langFilePath = path.join(LOCALES_DIR, `${lang}.json`);
    if (fs.existsSync(langFilePath)) {
      return JSON.parse(fs.readFileSync(langFilePath, 'utf-8'));
    }
  } catch (e) {
    console.error(`Failed to read locale ${lang}:`, e);
  }
  return {};
};

// ✅ 读取打印配置
const getPrintConfig = () => {
  try {
    if (fs.existsSync(PRINT_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(PRINT_CONFIG_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to read print config:', e);
  }

  // 默认打印配置
  return {
    scaleX: 100,
    scaleY: 100,
    offsetX: 0,
    offsetY: 0,
  };
};

// ✅ 保存打印配置
const setPrintConfig = (config) => {
  try {
    fs.writeFileSync(PRINT_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save print config:', e);
    throw e;
  }
};

const registerConfigAPI = (app, basePath = '/api') => {

  // ✅ 加载配置
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

      console.log('✅ Config loaded');
      res.json({
        success: true,
        config
      });

    } catch (err) {
      console.error('❌ Load config failed:', err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  // ✅ 保存配置
  app.post(`${basePath}/${eleActions.saveConfig}`, (req, res) => {
    try {
      const { Global, Config } = req.body;

      if (!Global && !Config) {
        return res.status(400).json({
          success: false,
          error: 'Global or Config is required'
        });
      }

      if (Global && Config) {
        const configCopy = { ...Config };
        delete configCopy.globalBackground;

        updateConfigStore({
          Config: configCopy,
          Global: _.pick(Global, ['currentLang', 'isShowOverView'])
        });
      }

      console.log('✅ Config saved');
      res.json({ success: true });

    } catch (err) {
      console.error('❌ Save config failed:', err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  // ✅ 加载打印配置
  app.get(`${basePath}/${eleActions.loadPrintConfig}`, (req, res) => {
    try {
      const printConfig = getPrintConfig();

      console.log('✅ Print config loaded');
      res.json({
        success: true,
        printConfig
      });

    } catch (err) {
      console.error('❌ Load print config failed:', err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  // ✅ 保存打印配置
  app.post(`${basePath}/${eleActions.savePrintConfig}`, (req, res) => {
    try {
      const { printConfig } = req.body;

      if (!printConfig) {
        return res.status(400).json({
          success: false,
          error: 'printConfig is required'
        });
      }

      setPrintConfig(printConfig);

      console.log('✅ Print config saved');
      res.json({ success: true });

    } catch (err) {
      console.error('❌ Save print config failed:', err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  // ✅ 获取单个语言包
  app.get(`${basePath}/locale/:lang`, (req, res) => {
    try {
      const { lang } = req.params;
      const locale = getLocale(lang);

      if (!locale || Object.keys(locale).length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Locale not found'
        });
      }

      res.json({
        success: true,
        locale
      });

    } catch (err) {
      console.error('Error getting locale:', err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  // ✅ 更新语言包
  app.put(`${basePath}/locale/:lang`, (req, res) => {
    try {
      const { lang } = req.params;
      const { locale } = req.body;

      if (!locale) {
        return res.status(400).json({
          success: false,
          error: 'locale data is required'
        });
      }

      const langFilePath = path.join(LOCALES_DIR, `${lang}.json`);
      fs.writeFileSync(langFilePath, JSON.stringify(locale, null, 2), 'utf-8');

      console.log(`✅ Locale updated: ${lang}`);
      res.json({ success: true });

    } catch (err) {
      console.error('❌ Update locale failed:', err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });
};

module.exports = { registerConfigAPI };

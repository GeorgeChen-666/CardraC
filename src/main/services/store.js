import { emptyImg } from '../../shared/constants';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { SimpleStore } from '../core/SimpleStore';
import { SmartCache } from '../core/SmartCache';

export const defaultImageStorage = {
  '_emptyImg': emptyImg.path,
};

export const ImageStorage = new SmartCache('ImageStorage', {
  maxMemorySize: 50,  // 内存中最多保留 50 张高质量图片
});

export const OverviewStorage = new SmartCache('OverviewStorage');

// 初始化默认图片
ImageStorage['_emptyImg'] = defaultImageStorage['_emptyImg'];
OverviewStorage['_emptyImg'] = defaultImageStorage['_emptyImg'];

// 在文件顶部添加缓存
export const PreviewStorage = new SmartCache('PreviewStorage', {
  maxMemorySize: 10,
});
const previewTasks = new Map(); // 存储进行中的任务



export const clearPrerenderCache = () => {
  PreviewStorage.clear();
  previewTasks.clear();
}

export const printStore = new SimpleStore('print_config');
export const defaultPathStore = new SimpleStore('defaultPathConfig');

let store = null;

export const updateConfigStore = (value) => {
  getConfigStore();
  store.set(value);
}

export const initConfigStore = async () => {
  return new Promise((resolve, reject) => {
    try {
      if (!store) {
        store = new SimpleStore('config');
        resolve();
      }
    } catch (e) {
      console.error('Failed to init config store:', e);
      // 兼容原有逻辑
      const appName = process.env.npm_package_name || 'cardrac';
      const configDir = path.join(os.homedir(), '.config', appName);
      const configPath = path.join(configDir, 'config.json');
      fs.unlink(configPath, () => {
        store = new SimpleStore();
        resolve();
      });
    }
  })
}

export const getConfigStore = () => {
  if (!store) {
    store = new SimpleStore();
  }
  return store.get() || {};
}

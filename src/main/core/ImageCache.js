import Keyv from 'keyv';
import KeyvSqlite from '@keyv/sqlite';
import path from 'path';
import fs from 'fs';
import os from 'os';

const getAppDataPath = () => {
  const platform = os.platform();
  const home = os.homedir();
  if (platform === 'win32') {
    return process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
  } else if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support');
  } else {
    return process.env.XDG_CONFIG_HOME || path.join(home, '.config');
  }
};

export class ImageCache {
  constructor(name, options = {}) {
    this.name = name;
    this.pid = process.pid;
    this.maxMemorySize = options.maxMemorySize || 1000;

    const appDataPath = getAppDataPath();
    const cacheDir = path.join(appDataPath, 'cardrac', 'cache', name);

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const dbPath = path.join(cacheDir, `pid-${this.pid}.db`);

    // ✅ 内存缓存使用 Map（同步）
    this.memoryCache = new Map();

    // ✅ 磁盘缓存（异步）
    this.diskCache = new Keyv({
      store: new KeyvSqlite(`sqlite://${dbPath}`),
      ttl: 1000 * 60 * 60 * 24
    });

    this.allKeys = new Set();
    this.dbPath = dbPath;
    this.cacheDir = cacheDir;

    this.cleanupOldCaches();
    this.registerCleanup();

    // ✅ 后台加载磁盘数据到内存
    this.loadFromDiskInBackground();

    return new Proxy(this, {
      get: (target, prop) => {
        if (prop === 'toJSON') return () => target.toPlainObject();
        if (typeof target[prop] === 'function') return target[prop].bind(target);

        // ✅ 方括号访问 - 同步从内存读取
        return target.getSync(prop);
      },
      set: (target, prop, value) => {
        // ✅ 方括号赋值 - 同步写入内存，异步写入磁盘
        target.setSync(prop, value);
        return true;
      },
      deleteProperty: (target, prop) => {
        target.deleteSync(prop);
        return true;
      },
      has: (target, prop) => target.has(prop),
      ownKeys: (target) => Array.from(target.allKeys),
      getOwnPropertyDescriptor: (target, prop) => {
        if (target.has(prop)) {
          return { enumerable: true, configurable: true };
        }
      }
    });
  }

  // ✅ 同步获取（仅内存）
  getSync(key) {
    return this.memoryCache.get(key);
  }

  // ✅ 异步获取（内存 + 磁盘）
  async get(key) {
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }

    const value = await this.diskCache.get(key);
    if (value !== undefined) {
      this.memoryCache.set(key, value);
      this.allKeys.add(key);
    }
    return value;
  }

  // ✅ 同步设置（立即写入内存，后台写入磁盘）
  setSync(key, value) {
    this.allKeys.add(key);
    this.memoryCache.set(key, value);

    // 后台异步写入磁盘（不阻塞）
    this.diskCache.set(key, value).catch(err => {
      console.error(`Failed to write ${key} to disk:`, err);
    });
  }

  // ✅ 异步设置（等待磁盘写入完成）
  async set(key, value) {
    this.allKeys.add(key);
    this.memoryCache.set(key, value);
    await this.diskCache.set(key, value);
  }

  // ✅ 同步删除
  deleteSync(key) {
    this.allKeys.delete(key);
    this.memoryCache.delete(key);

    // 后台异步删除磁盘数据
    this.diskCache.delete(key).catch(err => {
      console.error(`Failed to delete ${key} from disk:`, err);
    });
  }

  // ✅ 异步删除
  async delete(key) {
    this.allKeys.delete(key);
    this.memoryCache.delete(key);
    await this.diskCache.delete(key);
  }

  async clear() {
    this.allKeys.clear();
    this.memoryCache.clear();
    await this.diskCache.clear();
  }

  has(key) {
    return this.memoryCache.has(key);
  }

  keys() {
    return Array.from(this.allKeys);
  }

  get size() {
    return this.allKeys.size;
  }

  // ✅ 后台加载磁盘数据到内存
  async loadFromDiskInBackground() {
    try {
      // 这里可以根据需要实现预加载逻辑
      // 例如：加载最近使用的 N 个条目
    } catch (err) {
      console.error('Failed to load from disk:', err);
    }
  }

  cleanupOldCaches() {
    try {
      const files = fs.readdirSync(this.cacheDir);
      files.forEach(file => {
        const match = file.match(/^pid-(\d+)\.db$/);
        if (!match) return;
        const pid = parseInt(match[1], 10);
        if (pid === this.pid) return;
        if (!this.isProcessRunning(pid)) {
          const dbPath = path.join(this.cacheDir, file);
          fs.unlinkSync(dbPath);
          [`${dbPath}-wal`, `${dbPath}-shm`].forEach(f => {
            if (fs.existsSync(f)) fs.unlinkSync(f);
          });
        }
      });
    } catch (err) {}
  }

  isProcessRunning(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      return err.code !== 'ESRCH';
    }
  }

  registerCleanup() {
    const cleanup = () => {
      try {
        if (fs.existsSync(this.dbPath)) fs.unlinkSync(this.dbPath);
        [`${this.dbPath}-wal`, `${this.dbPath}-shm`].forEach(f => {
          if (fs.existsSync(f)) fs.unlinkSync(f);
        });
      } catch (err) {}
    };

    let called = false;
    const safe = () => { if (!called) { called = true; cleanup(); } };

    process.on('exit', safe);
    process.on('SIGINT', () => { safe(); process.exit(0); });
    process.on('SIGTERM', () => { safe(); process.exit(0); });
  }

  toPlainObject() {
    const obj = {};
    for (const key of this.allKeys) {
      obj[key] = this.memoryCache.get(key);
    }
    return obj;
  }
}

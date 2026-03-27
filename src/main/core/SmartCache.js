import Keyv from 'keyv';
import KeyvSqlite from '@keyv/sqlite';
import path from 'path';
import fs from 'fs';
import { getAppDataPath } from '../../shared/functions';

export class SmartCache {
  constructor(name, options = {}) {
    this.name = name;
    this.pid = process.pid;
    this.maxMemorySize = options.maxMemorySize || 50; // 默认 50 个

    const appDataPath = getAppDataPath();
    const cacheDir = path.join(appDataPath, 'cardrac', 'cache', name);

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const dbPath = path.join(cacheDir, `pid-${this.pid}.db`);

    this.memoryCache = new Map();

    this.frequencyMap = new Map();

    this.diskCache = new Keyv({
      store: new KeyvSqlite(`sqlite://${dbPath}`),
      ttl: 1000 * 60 * 60 * 24
    });

    this.allKeys = new Set();
    this.dbPath = dbPath;
    this.cacheDir = cacheDir;

    this.cleanupOldCaches();
    this.registerCleanup();

    return new Proxy(this, {
      get: (target, prop) => {
        if (prop === 'toJSON') return () => target.toPlainObject();
        if (typeof target[prop] === 'function') return target[prop].bind(target);
        return target.getSync(prop);
      },
      set: (target, prop, value) => {
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

  getAverageFrequency() {
    if (this.frequencyMap.size === 0) return 1;
    const total = Array.from(this.frequencyMap.values()).reduce((sum, freq) => sum + freq, 0);
    return Math.ceil(total / this.frequencyMap.size);
  }

  evictLFU() {
    let minFreq = Infinity;
    let leastFreqKey = null;

    for (const [key, freq] of this.frequencyMap.entries()) {
      if (freq < minFreq) {
        minFreq = freq;
        leastFreqKey = key;
      }
    }

    if (leastFreqKey) {
      this.memoryCache.delete(leastFreqKey);
      this.frequencyMap.delete(leastFreqKey);
      console.log(`🗑️ LFU 淘汰: ${leastFreqKey} (访问次数: ${minFreq})`);
    }
  }

  getSync(key) {
    if (this.memoryCache.has(key)) {
      // 增加访问次数
      this.frequencyMap.set(key, (this.frequencyMap.get(key) || 0) + 1);
      return this.memoryCache.get(key);
    }
    return undefined;
  }

  async get(key) {
    if (this.memoryCache.has(key)) {
      // 增加访问次数
      this.frequencyMap.set(key, (this.frequencyMap.get(key) || 0) + 1);
      return this.memoryCache.get(key);
    }

    const value = await this.diskCache.get(key);
    if (value !== undefined) {
      // 检查容量
      if (this.memoryCache.size >= this.maxMemorySize) {
        this.evictLFU();
      }

      this.memoryCache.set(key, value);
      this.allKeys.add(key);

      const avgFreq = this.getAverageFrequency();
      this.frequencyMap.set(key, avgFreq);
      console.log(`📥 从磁盘加载: ${key}, 初始热度: ${avgFreq}`);
    }
    return value;
  }

  setSync(key, value) {
    this.allKeys.add(key);

    if (!this.memoryCache.has(key) && this.memoryCache.size >= this.maxMemorySize) {
      this.evictLFU();
    }

    this.memoryCache.set(key, value);

    if (!this.frequencyMap.has(key)) {
      const avgFreq = this.getAverageFrequency();
      this.frequencyMap.set(key, avgFreq);
      console.log(`📝 新增数据: ${key}, 初始热度: ${avgFreq}`);
    }

    this.diskCache.set(key, value).catch(err => {
      console.error(`Failed to write ${key} to disk:`, err);
    });
  }

  async set(key, value) {
    this.allKeys.add(key);

    if (!this.memoryCache.has(key) && this.memoryCache.size >= this.maxMemorySize) {
      this.evictLFU();
    }

    this.memoryCache.set(key, value);

    if (!this.frequencyMap.has(key)) {
      const avgFreq = this.getAverageFrequency();
      this.frequencyMap.set(key, avgFreq);
    }

    await this.diskCache.set(key, value);
  }

  deleteSync(key) {
    this.allKeys.delete(key);
    this.memoryCache.delete(key);
    this.frequencyMap.delete(key);

    this.diskCache.delete(key).catch(err => {
      console.error(`Failed to delete ${key} from disk:`, err);
    });
  }

  async delete(key) {
    this.allKeys.delete(key);
    this.memoryCache.delete(key);
    this.frequencyMap.delete(key);
    await this.diskCache.delete(key);
  }

  async clear() {
    this.allKeys.clear();
    this.memoryCache.clear();
    this.frequencyMap.clear();
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

  getFrequencyStats() {
    const stats = {
      total: this.frequencyMap.size,
      average: this.getAverageFrequency(),
      min: Math.min(...this.frequencyMap.values()),
      max: Math.max(...this.frequencyMap.values()),
      details: Array.from(this.frequencyMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10) // 前 10 个热点
    };
    return stats;
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

  async toPlainObjectAsync() {
    const obj = {};
    for (const key of this.allKeys) {
      obj[key] = await this.get(key);
    }
    return obj;
  }
}

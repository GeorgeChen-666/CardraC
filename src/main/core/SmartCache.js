// SmartCache.js
import path from 'path';
import fs from 'fs';
import { getAppDataPath } from '../../shared/functions';
import { FileKV } from './FileKV';

export class SmartCache {
  constructor(name, options = {}) {
    this.name = name;
    this.pid = process.pid;
    this.maxMemorySize = options.maxMemorySize || 500;
    const appDataPath = getAppDataPath();
    const cacheDir = path.join(appDataPath, 'cardrac', 'cache', name);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    const dbPath = path.join(cacheDir, `pid-${this.pid}.db`);
    this.memoryCache = new Map();
    this.frequencyMap = new Map();
    this.diskCache = new FileKV({
      dir: path.join(cacheDir, `pid-${this.pid}`),
      ttl: 1000 * 60 * 60 * 24 / 1000,
      pid: this.pid
    });
    this.allKeys = new Set();
    this.dbPath = dbPath;
    this.cacheDir = cacheDir;

    this._writeQueue = new Map();   // key -> value 待写队列
    this._writeTimer = null;
    this._diskReadLock = new Map(); // key -> Promise 防并发读

    this.cleanupOldCaches();
    this.registerCleanup();

    const internalProps = new Set([
      'name', 'pid', 'maxMemorySize', 'memoryCache', 'frequencyMap',
      'diskCache', 'allKeys', 'dbPath', 'cacheDir',
      '_writeQueue', '_writeTimer', '_diskReadLock',
      'get', 'set', 'delete', 'clear', 'has', 'keys', 'size',
      'getAverageFrequency', 'evictLFU', 'cleanupOldCaches',
      'isProcessRunning', 'registerCleanup', 'toPlainObject',
      'toPlainObjectAsync', 'getFrequencyStats',
      '_scheduleDiskWrite', 'flush'
    ]);

    return new Proxy(this, {
      get: (target, prop) => {
        if (prop === 'toJSON') return () => target.toPlainObject();
        if (internalProps.has(prop) || typeof target[prop] === 'function') {
          return typeof target[prop] === 'function'
            ? target[prop].bind(target)
            : target[prop];
        }
        return target.get(prop);
      },

      set: (target, prop, value) => {
        if (internalProps.has(prop)) {
          target[prop] = value;
          return true;
        }
        target.set(prop, value).catch(err => {
          console.error(`Error in proxy set:`, err);
        });
        return true;
      },

      deleteProperty: (target, prop) => {
        target.delete(prop).catch(err => {
          console.error(`Error in proxy delete:`, err);
        });
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

  _scheduleDiskWrite() {
    if (this._writeTimer) return;
    this._writeTimer = setTimeout(async () => {
      this._writeTimer = null;
      const queue = new Map(this._writeQueue);
      this._writeQueue.clear();
      for (const [key, value] of queue) {
        try {
          await this.diskCache.set(key, value);
        } catch (e) {
          console.error(`Failed to write disk cache: ${key}`, e);
        }
      }
    }, 500);
  }

  // 强制立即写盘，应用退出前调用
  async flush() {
    if (this._writeTimer) {
      clearTimeout(this._writeTimer);
      this._writeTimer = null;
    }
    const queue = new Map(this._writeQueue);
    this._writeQueue.clear();
    for (const [key, value] of queue) {
      try {
        await this.diskCache.set(key, value);
      } catch (e) {
        console.error(`Failed to flush disk cache: ${key}`, e);
      }
    }
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
      if (!this._writeQueue.has(leastFreqKey)) {
        const value = this.memoryCache.get(leastFreqKey);
        if (value !== undefined) {
          this._writeQueue.set(leastFreqKey, value);
          this._scheduleDiskWrite();
        }
      }
      this.memoryCache.delete(leastFreqKey);
      this.frequencyMap.delete(leastFreqKey);
      console.log(`💾 LFU 淘汰到磁盘: ${leastFreqKey} (访问次数: ${minFreq})`);
    }
  }


  async get(key) {
    if (this.memoryCache.has(key)) {
      this.frequencyMap.set(key, (this.frequencyMap.get(key) || 0) + 1);
      return this.memoryCache.get(key);
    }

    // 先检查写队列，避免读到旧数据
    if (this._writeQueue.has(key)) {
      return this._writeQueue.get(key);
    }

    // 防止同一个 key 并发读盘
    if (this._diskReadLock.has(key)) {
      return this._diskReadLock.get(key);
    }

    const readPromise = this.diskCache.get(key).then(value => {
      this._diskReadLock.delete(key);
      if (value !== undefined) {
        if (this.memoryCache.size >= this.maxMemorySize) this.evictLFU();
        this.memoryCache.set(key, value);
        this.allKeys.add(key);
        const avgFreq = this.getAverageFrequency();
        this.frequencyMap.set(key, avgFreq);
        console.log(`📥 从磁盘加载: ${key}, 初始热度: ${avgFreq}`);
      }
      return value;
    }).catch(e => {
      this._diskReadLock.delete(key);
      throw e;
    });

    this._diskReadLock.set(key, readPromise);
    return readPromise;
  }

  async set(key, value) {
    this.allKeys.add(key);
    if (!this.memoryCache.has(key) && this.memoryCache.size >= this.maxMemorySize) {
      this.evictLFU();
    }
    this.memoryCache.set(key, value);
    if (!this.frequencyMap.has(key)) {
      this.frequencyMap.set(key, this.getAverageFrequency());
    }
    // 写入队列，延迟批量写盘
    this._writeQueue.set(key, value);
    this._scheduleDiskWrite();
  }

  async delete(key) {
    this.allKeys.delete(key);
    this.memoryCache.delete(key);
    this.frequencyMap.delete(key);
    this._writeQueue.delete(key);
    await this.diskCache.delete(key);
  }

  async clear() {
    this.allKeys.clear();
    this.memoryCache.clear();
    this.frequencyMap.clear();
    this._writeQueue.clear();
    if (this._writeTimer) {
      clearTimeout(this._writeTimer);
      this._writeTimer = null;
    }
    await this.diskCache.clear();
  }

  has(key) {
    return this.allKeys.has(key);
  }

  keys() {
    return Array.from(this.allKeys);
  }

  get size() {
    return this.allKeys.size;
  }

  getFrequencyStats() {
    return {
      total: this.frequencyMap.size,
      average: this.getAverageFrequency(),
      min: Math.min(...this.frequencyMap.values()),
      max: Math.max(...this.frequencyMap.values()),
      details: Array.from(this.frequencyMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
    };
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
    const cleanup = async () => {
      try {
        await this.flush(); // 退出前强制写盘
        if (fs.existsSync(this.dbPath)) fs.unlinkSync(this.dbPath);
        [`${this.dbPath}-wal`, `${this.dbPath}-shm`].forEach(f => {
          if (fs.existsSync(f)) fs.unlinkSync(f);
        });
      } catch (err) {}
    };
    let called = false;
    const safe = async () => { if (!called) { called = true; await cleanup(); } };
    process.on('exit', safe);
    process.on('SIGINT', async () => { await safe(); process.exit(0); });
    process.on('SIGTERM', async () => { await safe(); process.exit(0); });
  }

  toPlainObject(fast = true) {
    const obj = {};
    for (const key of this.allKeys) {
      if (this.memoryCache.has(key)) {
        obj[key] = this.memoryCache.get(key);
      } else if (this._writeQueue.has(key)) {
        obj[key] = this._writeQueue.get(key);
      } else if (fast) {
        obj[key] = '==disk data==';
      } else {
        obj[key] = undefined;
      }
    }
    return obj;
  }

  async toPlainObjectAsync(fast = true) {
    const obj = {};
    for (const key of this.allKeys) {
      if (this.memoryCache.has(key)) {
        obj[key] = this.memoryCache.get(key);
      } else if (this._writeQueue.has(key)) {
        obj[key] = this._writeQueue.get(key);
      } else if (fast) {
        obj[key] = '==disk data==';
      } else {
        obj[key] = await this.get(key);
      }
    }
    return obj;
  }
}

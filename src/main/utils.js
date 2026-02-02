import fs from 'fs';
import path from 'path';
import { app } from 'electron';

/**
 * LRU 缓存
 */
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.accessOrder = [];
  }

  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
    return this.cache.get(key);
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    }
    this.cache.set(key, value);
    this.accessOrder.push(key);
  }

  getLRUKeys(count) {
    return this.accessOrder.slice(0, count);
  }

  has(key) {
    return this.cache.has(key);
  }

  delete(key) {
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  keys() {
    return Array.from(this.cache.keys());
  }

  get size() {
    return this.cache.size;
  }
}

/**
 * 磁盘缓存（优化版）
 */
class DiskCache {
  constructor(cacheDir) {
    const processId = process.pid;
    this.cacheDir = path.join(cacheDir, `pid-${processId}`);
    this.baseCacheDir = cacheDir;

    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    // 写入队列
    this.writeQueue = [];
    this.isWriting = false;
    this.maxBatchSize = 20;

    console.log(`📁 DiskCache initialized at: ${this.cacheDir}`);

    this.cleanupOldCaches();
    this.registerCleanupOnExit();
  }

  getCachePath(key) {
    const hash = Buffer.from(key).toString('base64')
      .replace(/\//g, '_')
      .replace(/\+/g, '-')
      .replace(/=/g, '');
    return path.join(this.cacheDir, `${hash}.cache`);
  }

  get(key) {
    const cachePath = this.getCachePath(key);
    try {
      if (fs.existsSync(cachePath)) {
        const buffer = fs.readFileSync(cachePath);

        // 检查是否是原始 Buffer（优化后的格式）
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
          // JPEG magic number
          return `data:image/jpeg;base64,${buffer.toString('base64')}`;
        } else if (buffer[0] === 0x89 && buffer[1] === 0x50) {
          // PNG magic number
          return `data:image/png;base64,${buffer.toString('base64')}`;
        } else if (buffer[0] === 0x52 && buffer[1] === 0x49) {
          // WEBP magic number
          return `data:image/webp;base64,${buffer.toString('base64')}`;
        } else {
          // 旧格式（UTF-8 字符串）
          return buffer.toString('utf-8');
        }
      }
    } catch (error) {
      console.error(`Failed to read disk cache for ${key}:`, error);
    }
    return undefined;
  }

  set(key, value) {
    return new Promise((resolve, reject) => {
      this.writeQueue.push({ key, value, resolve, reject });
      this.processWriteQueue();
    });
  }

  async processWriteQueue() {
    if (this.isWriting || this.writeQueue.length === 0) {
      return;
    }

    this.isWriting = true;

    try {
      while (this.writeQueue.length > 0) {
        const batch = this.writeQueue.splice(0, this.maxBatchSize);

        await Promise.all(
          batch.map(async ({ key, value, resolve, reject }) => {
            try {
              const cachePath = this.getCachePath(key);

              let buffer;
              if (value.startsWith('data:image/')) {
                const base64Data = value.split(',')[1];
                buffer = Buffer.from(base64Data, 'base64');
              } else {
                buffer = Buffer.from(value, 'utf-8');
              }

              await fs.promises.writeFile(cachePath, buffer);
              resolve();

            } catch (error) {
              console.error(`Failed to write disk cache for ${key}:`, error);
              reject(error);
            }
          })
        );

        await new Promise(r => setImmediate(r));
      }
    } finally {
      this.isWriting = false;

      if (this.writeQueue.length > 0) {
        this.processWriteQueue();
      }
    }
  }

  delete(key) {
    const cachePath = this.getCachePath(key);
    try {
      if (fs.existsSync(cachePath)) {
        fs.unlinkSync(cachePath);
      }
    } catch (error) {
      console.error(`Failed to delete disk cache for ${key}:`, error);
    }
  }

  clear() {
    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir);
        files.forEach(file => {
          fs.unlinkSync(path.join(this.cacheDir, file));
        });
      }
    } catch (error) {
      console.error('Failed to clear disk cache:', error);
    }
  }

  cleanupOldCaches() {
    try {
      if (!fs.existsSync(this.baseCacheDir)) return;

      const entries = fs.readdirSync(this.baseCacheDir, { withFileTypes: true });
      const currentPid = process.pid;

      entries.forEach(entry => {
        if (!entry.isDirectory()) return;

        const match = entry.name.match(/^pid-(\d+)$/);
        if (!match) return;

        const pid = parseInt(match[1], 10);
        if (pid === currentPid) return;

        if (!this.isProcessRunning(pid)) {
          const oldCacheDir = path.join(this.baseCacheDir, entry.name);
          console.log(`🗑️ Cleaning up old cache from PID ${pid}`);

          try {
            this.removeDirectory(oldCacheDir);
          } catch (error) {
            console.error(`Failed to cleanup old cache for PID ${pid}:`, error);
          }
        }
      });
    } catch (error) {
      console.error('Failed to cleanup old caches:', error);
    }
  }

  isProcessRunning(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return error.code !== 'ESRCH';
    }
  }

  removeDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) return;

    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        this.removeDirectory(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    });

    fs.rmdirSync(dirPath);
  }

  registerCleanupOnExit() {
    const cleanup = () => {
      console.log(`🗑️ Cleaning up cache on exit`);
      try {
        this.removeDirectory(this.cacheDir);
      } catch (error) {
        console.error('Failed to cleanup cache on exit:', error);
      }
    };

    app.on('before-quit', cleanup);
    process.on('exit', cleanup);
    process.on('SIGINT', () => {
      cleanup();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      cleanup();
      process.exit(0);
    });
  }

  getCacheSize() {
    try {
      if (!fs.existsSync(this.cacheDir)) return 0;

      const files = fs.readdirSync(this.cacheDir);
      let totalSize = 0;

      files.forEach(file => {
        const filePath = path.join(this.cacheDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      });

      return totalSize;
    } catch (error) {
      console.error('Failed to get cache size:', error);
      return 0;
    }
  }
}

/**
 * 智能存储
 */
export class SmartStorage {
  constructor(name, options = {}) {
    this.name = name;
    this.allKeys = new Set();

    if (options.maxMemorySize !== undefined) {
      this.maxMemorySize = options.maxMemorySize;
      this.useDiskCache = true;
    } else {
      this.maxMemorySize = 1000;
      this.useDiskCache = true;
    }

    this._diskCache = null;
    this.targetMemorySize = this.maxMemorySize;
    this.compactionThreshold = Math.floor(this.maxMemorySize * 1.5);
    this.isCompacting = false;
    this.protectedKeys = new Set();
    this.keysOnDisk = new Set();
    this.memoryCache = new LRUCache(this.maxMemorySize);

    return new Proxy(this, {
      get: (target, prop) => {
        if (prop === 'toJSON') return () => target.toPlainObject();
        if (prop === 'constructor' || prop === 'prototype') return target[prop];
        if (typeof target[prop] === 'function') return target[prop].bind(target);
        return target.get(prop);
      },
      set: (target, prop, value) => {
        if (value instanceof Promise) {
          console.error(`❌ Cannot store Promise for key: ${prop}`);
          throw new Error(`Cannot store Promise for key: ${prop}`);
        }
        target.set(prop, value);
        return true;
      },
      deleteProperty: (target, prop) => {
        target.delete(prop);
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

  get diskCache() {
    if (!this._diskCache) {
      const appDataPath = app.getPath('appData');
      const cachePath = path.join(appDataPath, 'cardrac', 'cache', this.name);
      this._diskCache = new DiskCache(cachePath);
    }
    return this._diskCache;
  }

  get(key) {
    if (this.memoryCache.has(key)) {
      const value = this.memoryCache.get(key);
      if (value instanceof Promise) {
        console.error(`❌ Found Promise in memory cache for key: ${key}`);
        return undefined;
      }
      return value;
    }

    try {
      const value = this.diskCache.get(key);
      if (value) {
        this.memoryCache.set(key, value);
        this.keysOnDisk.add(key);
        this.checkAndStartCompaction();
        return value;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`Failed to get from disk cache for key ${key}:`, error);
      }
    }

    return undefined;
  }

  set(key, value) {
    this.allKeys.add(key);
    this.memoryCache.set(key, value);
    // ✅ 不需要 this.keysOnDisk.delete(key)
    this.checkAndStartCompaction();
  }

  delete(key) {
    this.allKeys.delete(key);
    this.memoryCache.delete(key);
    this.protectedKeys.delete(key);
    this.keysOnDisk.delete(key);
    this.diskCache.delete(key);
  }

  checkAndStartCompaction() {
    if (this.isCompacting) return;

    if (this.memoryCache.size > this.compactionThreshold) {
      console.log(`📊 Memory: ${this.memoryCache.size} > ${this.compactionThreshold}, starting compaction...`);
      this.startBackgroundCompaction();
    }
  }

  async startBackgroundCompaction() {
    if (this.isCompacting) return;

    this.isCompacting = true;
    console.log(`🔄 Compaction started (current: ${this.memoryCache.size}, target: ${this.targetMemorySize})`);

    try {
      let evictedCount = 0;
      let skippedCount = 0;

      while (this.memoryCache.size > this.targetMemorySize) {
        const lruKeys = this.memoryCache.getLRUKeys(10);
        if (lruKeys.length === 0) break;

        const keysToEvict = lruKeys.filter(key => {
          if (this.protectedKeys.has(key)) return false;

          if (this.keysOnDisk.has(key)) {
            this.memoryCache.delete(key);
            skippedCount++;
            return false;
          }

          return true;
        });

        if (keysToEvict.length === 0 && skippedCount === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }

        await Promise.all(
          keysToEvict.map(async (key) => {
            try {
              const value = this.memoryCache.cache.get(key);
              if (!value) return;

              this.protectedKeys.add(key);
              await this.diskCache.set(key, value);
              this.keysOnDisk.add(key);
              this.memoryCache.delete(key);
              evictedCount++;

            } catch (error) {
              console.error(`Failed to evict key ${key}:`, error);
            } finally {
              this.protectedKeys.delete(key);
            }
          })
        );

        await new Promise(resolve => setImmediate(resolve));
      }

      console.log(`✅ Compaction done. Evicted ${evictedCount} items, Skipped ${skippedCount} items. Current: ${this.memoryCache.size}`);

    } catch (error) {
      console.error('❌ Compaction failed:', error);
    } finally {
      this.isCompacting = false;
    }
  }

  clear() {
    this.allKeys.clear();
    this.memoryCache.clear();
    this.protectedKeys.clear();
    this.keysOnDisk.clear();
    this.diskCache.clear();
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

  async waitForCompaction() {
    while (this.isCompacting) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  async toPlainObjectAsync() {
    await this.waitForCompaction();
    const obj = {};
    for (const key of this.allKeys) {
      if (this.memoryCache.has(key)) {
        obj[key] = this.memoryCache.get(key);
      } else {
        try {
          const value = this.diskCache.get(key);
          if (value) obj[key] = value;
        } catch (error) {
          if (error.code !== 'ENOENT') {
            console.error(`Failed to read disk cache for key ${key}:`, error);
          }
        }
      }
    }
    return obj;
  }

  toPlainObject() {
    const obj = {};
    for (const key of this.allKeys) {
      if (this.memoryCache.has(key)) {
        obj[key] = this.memoryCache.get(key);
      } else {
        try {
          const value = this.diskCache.get(key);
          if (value) obj[key] = value;
        } catch (error) {
          if (error.code !== 'ENOENT') {
            console.error(`Failed to read disk cache for key ${key}:`, error);
          }
        }
      }
    }
    return obj;
  }

  getMemoryStats() {
    return {
      memorySize: this.memoryCache.size,
      totalSize: this.allKeys.size,
      maxMemorySize: this.maxMemorySize,
      targetMemorySize: this.targetMemorySize,
      compactionThreshold: this.compactionThreshold,
      protectedKeys: this.protectedKeys.size,
      keysOnDisk: this.keysOnDisk.size,
      isCompacting: this.isCompacting,
      diskCacheEnabled: this.useDiskCache,
      diskCachePath: this._diskCache?.cacheDir,
      diskCacheSize: this._diskCache?.getCacheSize()
    };
  }
}

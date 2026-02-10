import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import Database from 'better-sqlite3';
import { ipcMain } from 'electron';
import os from 'os';

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
 * SQLite 磁盘缓存
 */
class DiskCache {
  constructor(cacheDir) {
    const processId = process.pid;
    this.baseCacheDir = cacheDir;

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    //SQLite 数据库文件名为进程 ID
    this.dbPath = path.join(cacheDir, `pid-${processId}.db`);
    this.db = new Database(this.dbPath);

    //创建表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value BLOB NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    //预编译语句
    this.insertStmt = this.db.prepare('INSERT OR REPLACE INTO cache (key, value) VALUES (?, ?)');
    this.selectStmt = this.db.prepare('SELECT value FROM cache WHERE key = ?');
    this.deleteStmt = this.db.prepare('DELETE FROM cache WHERE key = ?');
    this.clearStmt = this.db.prepare('DELETE FROM cache');
    this.keysStmt = this.db.prepare('SELECT key FROM cache');

    //写入队列
    this.writeQueue = [];
    this.isWriting = false;
    this.maxBatchSize = 20;

    console.log(`📁 DiskCache (SQLite) initialized at: ${this.dbPath}`);

    this.cleanupOldCaches();
    this.registerCleanupOnExit();
  }

  get(key) {
    try {
      const row = this.selectStmt.get(key);
      if (!row) return undefined;

      const buffer = row.value;

      //检查图片类型
      if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
        return `data:image/jpeg;base64,${buffer.toString('base64')}`;
      } else if (buffer[0] === 0x89 && buffer[1] === 0x50) {
        return `data:image/png;base64,${buffer.toString('base64')}`;
      } else if (buffer[0] === 0x52 && buffer[1] === 0x49) {
        return `data:image/webp;base64,${buffer.toString('base64')}`;
      } else {
        return buffer.toString('utf-8');
      }
    } catch (error) {
      console.error(`Failed to read cache for ${key}:`, error);
      return undefined;
    }
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

        //使用事务批量写入
        const insert = this.db.transaction((items) => {
          for (const { key, value, resolve, reject } of items) {
            try {
              let buffer;
              if (value.startsWith('data:image/')) {
                const base64Data = value.split(',')[1];
                buffer = Buffer.from(base64Data, 'base64');
              } else {
                buffer = Buffer.from(value, 'utf-8');
              }

              this.insertStmt.run(key, buffer);
              resolve();
            } catch (error) {
              console.error(`Failed to write cache for ${key}:`, error);
              reject(error);
            }
          }
        });

        insert(batch);

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
    try {
      this.deleteStmt.run(key);
    } catch (error) {
      console.error(`Failed to delete cache for ${key}:`, error);
    }
  }

  clear() {
    try {
      this.clearStmt.run();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  cleanupOldCaches() {
    try {
      if (!fs.existsSync(this.baseCacheDir)) return;

      const files = fs.readdirSync(this.baseCacheDir);
      const currentPid = process.pid;

      files.forEach(file => {
        const match = file.match(/^pid-(\d+)\.db$/);
        if (!match) return;

        const pid = parseInt(match[1], 10);
        if (pid === currentPid) return;

        if (!this.isProcessRunning(pid)) {
          const oldDbPath = path.join(this.baseCacheDir, file);
          console.log(`🗑️ Cleaning up old cache from PID ${pid}`);

          try {
            fs.unlinkSync(oldDbPath);
            // 删除 WAL 和 SHM 文件
            const walPath = `${oldDbPath}-wal`;
            const shmPath = `${oldDbPath}-shm`;
            if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
            if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
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

  registerCleanupOnExit() {
    const cleanup = () => {
      console.log(`🗑️ Cleaning up cache on exit`);
      try {
        //先关闭数据库
        if (this.db) {
          this.db.close();
        }

        //检查文件是否存在再删除
        if (fs.existsSync(this.dbPath)) {
          fs.unlinkSync(this.dbPath);
        }

        // 删除 WAL 和 SHM 文件
        const walPath = `${this.dbPath}-wal`;
        const shmPath = `${this.dbPath}-shm`;

        if (fs.existsSync(walPath)) {
          fs.unlinkSync(walPath);
        }

        if (fs.existsSync(shmPath)) {
          fs.unlinkSync(shmPath);
        }

        console.log('✅ Cache cleanup completed');
      } catch (error) {
        //忽略文件不存在的错误
        if (error.code !== 'ENOENT') {
          console.error('Failed to cleanup cache on exit:', error);
        }
      }
    };

    //防止重复清理
    let cleanupCalled = false;
    const safeCleanup = () => {
      if (cleanupCalled) return;
      cleanupCalled = true;
      cleanup();
    };

    app.on('before-quit', safeCleanup);
    process.on('exit', safeCleanup);
    process.on('SIGINT', () => {
      safeCleanup();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      safeCleanup();
      process.exit(0);
    });
  }


  getCacheSize() {
    try {
      if (!fs.existsSync(this.dbPath)) return 0;
      const stats = fs.statSync(this.dbPath);
      return stats.size;
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
    //不需要 this.keysOnDisk.delete(key)
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

/**
 * 从主进程异步调用渲染进程功能
 * @param {BrowserWindow} window - 目标窗口
 * @param {string} channel - 通信频道名
 * @param {any} data - 发送的数据
 * @param {number} timeout - 超时时间（毫秒），默认 30 秒
 * @returns {Promise<any>} 渲染进程返回的结果
 */
export const invokeRenderer = (window, channel, data = {}, timeout = 30000) => {
  return new Promise((resolve, reject) => {
    const requestId = `${channel}-${Date.now()}-${Math.random()}`;
    const resultChannel = `${channel}-result-${requestId}`;

    // 设置超时
    const timer = setTimeout(() => {
      ipcMain.removeAllListeners(resultChannel);
      reject(new Error(`Renderer invoke timeout: ${channel}`));
    }, timeout);

    // 监听结果
    ipcMain.once(resultChannel, (event, result) => {
      clearTimeout(timer);

      if (result.error) {
        reject(new Error(result.error));
      } else {
        resolve(result.data);
      }
    });

    // 发送请求
    window.webContents.send(channel, {
      requestId,
      resultChannel,
      ...data
    });
  });
};

/**
 * 将绝对路径压缩为使用 ~ 的相对路径
 */
export const fixPath = (filePath) => {
  if (!filePath || typeof filePath !== 'string') return filePath;

  const homeDir = os.homedir();
  const normalizedPath = path.normalize(filePath);
  const normalizedHome = path.normalize(homeDir);

  if (normalizedPath.toLowerCase().startsWith(normalizedHome.toLowerCase())) {
    const relativePath = normalizedPath.substring(normalizedHome.length);
    return '~' + relativePath;
  }

  return filePath;
};

/**
 * 展开 ~ 为实际的用户目录路径
 */
export const expandPath = (filePath) => {
  if (!filePath || typeof filePath !== 'string') return filePath;

  if (filePath.startsWith('~')) {
    const homeDir = os.homedir();
    return path.join(homeDir, filePath.substring(1));
  }

  return filePath;
};
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
/**
 * LRU 缓存实现
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

    // 更新访问顺序
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);

    return this.cache.get(key);
  }

  set(key, value) {
    // 如果已存在，先删除
    if (this.cache.has(key)) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    }

    // 如果超过容量，删除最久未使用的
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.accessOrder.shift();
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, value);
    this.accessOrder.push(key);
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
 * 磁盘缓存管理器
 */
class DiskCache {
  constructor(cacheDir) {
    this.cacheDir = cacheDir;

    // 确保缓存目录存在
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  getCachePath(key) {
    // 使用 key 的 hash 作为文件名，避免特殊字符问题
    const hash = Buffer.from(key).toString('base64')
      .replace(/\//g, '_')
      .replace(/\+/g, '-')
      .replace(/=/g, '');
    return path.join(this.cacheDir, `${hash}.cache`);
  }

  async get(key) {
    const cachePath = this.getCachePath(key);

    try {
      if (fs.existsSync(cachePath)) {
        return fs.readFileSync(cachePath, 'utf-8');
      }
    } catch (error) {
      console.error(`Failed to read disk cache for ${key}:`, error);
    }

    return undefined;
  }

  async set(key, value) {
    const cachePath = this.getCachePath(key);

    try {
      fs.writeFileSync(cachePath, value, 'utf-8');
    } catch (error) {
      console.error(`Failed to write disk cache for ${key}:`, error);
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
      const files = fs.readdirSync(this.cacheDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(this.cacheDir, file));
      });
    } catch (error) {
      console.error('Failed to clear disk cache:', error);
    }
  }
}

/**
 * 智能存储代理
 */
// src/main/ele_action/handlers/file_render/ImageStorageCache.js

class SmartStorage {
  constructor(name, options = {}) {
    this.name = name;
    this.memoryCache = new LRUCache(options.maxMemorySize || 50);
    this.useDiskCache = options.useDiskCache || false;
    this._diskCache = null;
    this.allKeys = new Set();

    // ✅ 新增：跟踪正在写入磁盘的 key
    this.pendingDiskWrites = new Set();

    return new Proxy(this, {
      get: (target, prop) => {
        if (prop === 'toJSON') {
          return () => target.toPlainObject();
        }

        if (prop === 'constructor' || prop === 'prototype') {
          return target[prop];
        }

        if (typeof target[prop] === 'function') {
          return target[prop].bind(target);
        }

        return target.get(prop);
      },

      set: (target, prop, value) => {
        target.set(prop, value);
        return true;
      },

      deleteProperty: (target, prop) => {
        target.delete(prop);
        return true;
      },

      has: (target, prop) => {
        return target.has(prop);
      },

      ownKeys: (target) => {
        return Array.from(target.allKeys);
      },

      getOwnPropertyDescriptor: (target, prop) => {
        if (target.has(prop)) {
          return {
            enumerable: true,
            configurable: true,
          };
        }
      }
    });
  }

  get diskCache() {
    if (this.useDiskCache && !this._diskCache) {
      this._diskCache = new DiskCache(this.name);
    }
    return this._diskCache;
  }

  get(key) {
    // 1. 先从内存缓存获取
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }

    // 2. 从磁盘缓存获取
    if (this.diskCache) {
      try {
        // ✅ 检查是否正在写入磁盘
        if (this.pendingDiskWrites.has(key)) {
          // 正在写入，返回 undefined（或等待写入完成）
          return undefined;
        }

        const value = this.diskCache.get(key);
        if (value) {
          // 重新加载到内存缓存
          this.memoryCache.set(key, value);
          return value;
        }
      } catch (error) {
        // ✅ 磁盘读取失败时，不抛出错误，只记录日志
        if (error.code !== 'ENOENT') {
          console.error(`Failed to get from disk cache for key ${key}:`, error);
        }
      }
    }

    return undefined;
  }

  set(key, value) {
    this.allKeys.add(key);
    this.memoryCache.set(key, value);

    // 异步存入磁盘缓存
    if (this.diskCache) {
      // ✅ 标记为正在写入
      this.pendingDiskWrites.add(key);

      setImmediate(async () => {
        try {
          await this.diskCache.set(key, value);
        } catch (error) {
          console.error(`Failed to set disk cache for key ${key}:`, error);
        } finally {
          // ✅ 写入完成，移除标记
          this.pendingDiskWrites.delete(key);
        }
      });
    }
  }

  has(key) {
    return this.allKeys.has(key);
  }

  delete(key) {
    this.allKeys.delete(key);
    this.memoryCache.delete(key);
    this.pendingDiskWrites.delete(key);

    if (this.diskCache) {
      this.diskCache.delete(key);
    }
  }

  clear() {
    this.allKeys.clear();
    this.memoryCache.clear();
    this.pendingDiskWrites.clear();

    if (this.diskCache) {
      this.diskCache.clear();
    }
  }

  keys() {
    return Array.from(this.allKeys);
  }

  get size() {
    return this.allKeys.size;
  }

  // ✅ 改进：toPlainObject 只从内存和磁盘获取已存在的数据
  toPlainObject() {
    const obj = {};

    for (const key of this.allKeys) {
      // 优先从内存获取
      if (this.memoryCache.has(key)) {
        obj[key] = this.memoryCache.get(key);
      } else if (this.diskCache) {
        // 从磁盘获取（如果存在）
        try {
          const value = this.diskCache.get(key);
          if (value) {
            obj[key] = value;
          }
        } catch (error) {
          // ✅ 忽略不存在的文件
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
      pendingWrites: this.pendingDiskWrites.size,
      memoryUsage: `${this.memoryCache.size}/${this.allKeys.size}`,
      diskCacheEnabled: this.useDiskCache
    };
  }
}

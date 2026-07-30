import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { SmartCache } from '../core/SmartCache';
import { SimpleStore } from '../core/SimpleStore';
import { TaskPool } from '../core/TaskPool';

const tempDirs = [];
const caches = [];
const stores = [];

const makeTempDir = async () => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cardrac-core-'));
  tempDirs.push(dir);
  return dir;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

beforeEach(() => {
  TaskPool.globalRunningCount = 0;
  TaskPool.maxGlobalConcurrent = 1;
});

afterEach(async () => {
  await Promise.allSettled(caches.splice(0).map(cache => cache.close({ flush: false, removeDiskCache: true })));
  await Promise.allSettled(stores.splice(0).map(store => store.close({ flush: false })));
  await Promise.allSettled(tempDirs.splice(0).map(dir => fs.promises.rm(dir, { recursive: true, force: true })));
  TaskPool.globalRunningCount = 0;
});

describe('core', () => {
  describe('SmartCache', () => {
    test('会在内存淘汰后从磁盘回读缓存项', async () => {
      const baseDir = await makeTempDir();
      const cache = new SmartCache('images', {
        baseDir,
        pid: 43210,
        maxMemorySize: 1,
        writeDebounceMs: 5,
        registerCleanup: false,
        cleanupStaleCaches: false,
        cleanupOnExit: false,
        startCleanupInterval: false,
      });
      caches.push(cache);

      await cache.set('first', { value: 1 });
      await cache.set('second', { value: 2 });
      await cache.flush();

      expect(cache.keys().sort()).toEqual(['first', 'second']);
      expect(cache.has('first')).toBe(true);
      expect(cache.has('second')).toBe(true);
      expect(cache.size).toBe(2);
      expect(cache.memoryCache.has('first')).toBe(false);
      expect(cache.memoryCache.has('second')).toBe(true);

      const reloaded = await cache.get('first');
      expect(reloaded).toEqual({ value: 1 });
      expect(cache.memoryCache.has('first')).toBe(true);
    });

    test('delete 和 clear 会同时清理内存与磁盘状态', async () => {
      const baseDir = await makeTempDir();
      const cache = new SmartCache('preview', {
        baseDir,
        pid: 43211,
        maxMemorySize: 2,
        writeDebounceMs: 5,
        registerCleanup: false,
        cleanupStaleCaches: false,
        cleanupOnExit: false,
        startCleanupInterval: false,
      });
      caches.push(cache);

      await cache.set('a', 'A');
      await cache.set('b', 'B');
      await cache.flush();

      await cache.delete('a');
      expect(cache.has('a')).toBe(false);
      expect(await cache.get('a')).toBeUndefined();

      await cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.keys()).toEqual([]);
      expect(await fs.promises.readdir(cache.diskCacheDir)).toEqual([]);
    });

    test('支持代理式读写删除，并能枚举 key', async () => {
      const baseDir = await makeTempDir();
      const cache = new SmartCache('proxy', {
        baseDir,
        pid: 43212,
        writeDebounceMs: 5,
        registerCleanup: false,
        cleanupStaleCaches: false,
        cleanupOnExit: false,
        startCleanupInterval: false,
      });
      caches.push(cache);

      cache.alpha = 'A';
      cache.beta = 'B';

      expect(await cache.alpha).toBe('A');
      expect(await cache.beta).toBe('B');
      expect(Object.keys(cache).sort()).toEqual(['alpha', 'beta']);

      delete cache.alpha;
      await sleep(0);

      expect(await cache.alpha).toBeUndefined();
      expect(cache.has('alpha')).toBe(false);
      expect(cache.keys()).toEqual(['beta']);
    });

    test('过期磁盘缓存会在读取时返回 undefined 并删除文件', async () => {
      const baseDir = await makeTempDir();
      const cache = new SmartCache('ttl', {
        baseDir,
        pid: 43213,
        ttlSeconds: 60,
        writeDebounceMs: 5,
        registerCleanup: false,
        cleanupStaleCaches: false,
        cleanupOnExit: false,
        startCleanupInterval: false,
      });
      caches.push(cache);

      await cache.set('soon-expired', 'value');
      await cache.flush();
      cache.memoryCache.delete('soon-expired');
      cache.frequencyMap.delete('soon-expired');

      const [fileName] = await fs.promises.readdir(cache.diskCacheDir);
      const filePath = path.join(cache.diskCacheDir, fileName);
      await fs.promises.writeFile(filePath, JSON.stringify({ expire: Date.now() - 1, value: 'value' }), 'utf8');

      const value = await cache.get('soon-expired');

      expect(value).toBeUndefined();
      expect(await fs.promises.readdir(cache.diskCacheDir)).toEqual([]);
    });
  });

  describe('SimpleStore', () => {
    test('set 会合并数据并可 flush 到磁盘', async () => {
      const dir = await makeTempDir();
      const store = new SimpleStore('settings', dir, {
        registerCleanup: false,
        writeDebounceMs: 5,
      });
      stores.push(store);

      expect(store.get({ empty: true })).toEqual({ empty: true });

      store.set({ theme: 'dark' });
      store.set({ zoom: 125 });
      await store.flush();

      const content = JSON.parse(await fs.promises.readFile(path.join(dir, 'settings.json'), 'utf8'));
      expect(content).toEqual({ theme: 'dark', zoom: 125 });

      const reloaded = new SimpleStore('settings', dir, { registerCleanup: false });
      stores.push(reloaded);
      expect(reloaded.get()).toEqual({ theme: 'dark', zoom: 125 });
    });

    test('clear 与 delete 会正确落盘和删除文件', async () => {
      const dir = await makeTempDir();
      const store = new SimpleStore('workspace', dir, {
        registerCleanup: false,
        writeDebounceMs: 5,
      });
      stores.push(store);

      store.set({ foo: 'bar' });
      await store.flush();
      store.clear();
      await store.flush();

      const cleared = JSON.parse(await fs.promises.readFile(path.join(dir, 'workspace.json'), 'utf8'));
      expect(cleared).toEqual({});

      store.delete();
      expect(fs.existsSync(path.join(dir, 'workspace.json'))).toBe(false);
    });

    test('遇到损坏 JSON 时会回退到默认值', async () => {
      const dir = await makeTempDir();
      await fs.promises.writeFile(path.join(dir, 'broken.json'), '{not-json', 'utf8');

      const store = new SimpleStore('broken', dir, { registerCleanup: false });
      stores.push(store);

      expect(store.get({ fallback: true })).toEqual({ fallback: true });
      expect(store.get()).toEqual({});
    });

    test('close({ flush: false }) 会丢弃待写队列而不落盘', async () => {
      const dir = await makeTempDir();
      const store = new SimpleStore('draft', dir, {
        registerCleanup: false,
        writeDebounceMs: 50,
      });
      stores.push(store);

      store.set({ draft: true });
      await store.close({ flush: false });
      await sleep(80);

      const content = JSON.parse(await fs.promises.readFile(path.join(dir, 'draft.json'), 'utf8'));
      expect(content).toEqual({});
    });
  });

  describe('TaskPool', () => {
    test('uniqueKey 相同的 pending/running 任务会复用同一个 taskId', async () => {
      const pool = new TaskPool();

      const job = pool.task(async (_task, value) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return value;
      }, {
        tag: 'dedupe',
        uniqueKey: ([value]) => `value-${value}`,
      });

      const taskId1 = job(7);
      const taskId2 = job(7);

      expect(taskId2).toBe(taskId1);
      await expect(pool.waitTask(taskId1)).resolves.toBe(7);
    });

    test('高优先级任务会先于低优先级任务执行', async () => {
      const pool = new TaskPool();
      const order = [];

      const lowPriority = pool.task(async () => {
        order.push('low');
        return 'low';
      }, { tag: 'priority', priority: 0 });

      const highPriority = pool.task(async () => {
        order.push('high');
        return 'high';
      }, { tag: 'priority', priority: 10 });

      const lowId = lowPriority();
      const highId = highPriority();

      await Promise.all([pool.waitTask(lowId), pool.waitTask(highId)]);
      expect(order).toEqual(['high', 'low']);
    });

    test('可以取消 pending 任务并保留统计信息', async () => {
      const pool = new TaskPool();

      const job = pool.task(async (_task, label, delay) => {
        await new Promise(resolve => setTimeout(resolve, delay));
        return label;
      }, { tag: 'cancel' });

      const firstId = job('first', 20);
      const secondId = job('second', 0);
      const cancelledPromise = pool.waitTask(secondId);

      expect(pool.cancelTask(secondId)).toBe(true);
      await expect(cancelledPromise).rejects.toThrow('Task cancelled');
      await expect(pool.waitTask(firstId)).resolves.toBe('first');

      const stats = pool.getStatsByTag('cancel');
      expect(stats.cancelled).toBe(1);
      expect(stats.completed).toBe(1);
    });

    test('失败任务会 reject，并允许后续以相同 uniqueKey 重试', async () => {
      const pool = new TaskPool();
      let shouldFail = true;

      const job = pool.task(async () => {
        if (shouldFail) throw new Error('boom');
        return 'ok';
      }, {
        tag: 'failure',
        uniqueKey: 'same-key',
      });

      const failedTaskId = job();
      await expect(pool.waitTask(failedTaskId)).rejects.toThrow('boom');

      shouldFail = false;
      const retriedTaskId = job();
      expect(retriedTaskId).not.toBe(failedTaskId);
      await expect(pool.waitTask(retriedTaskId)).resolves.toBe('ok');

      const stats = pool.getStatsByTag('failure');
      expect(stats.failed).toBe(1);
      expect(stats.completed).toBe(1);
    });

    test('waitTasksByTag 会返回对应任务的 settled 结果并汇报进度', async () => {
      const pool = new TaskPool();
      const progresses = [];

      const job = pool.task(async (_task, value, delay, shouldFail = false) => {
        await sleep(delay);
        if (shouldFail) throw new Error(`fail-${value}`);
        return value;
      }, { tag: 'batch' });

      const firstId = job('first', 5, false);
      const secondId = job('second', 10, true);
      void pool.waitTask(firstId).catch(() => {});
      void pool.waitTask(secondId).catch(() => {});

      const settled = await pool.waitTasksByTag('batch', {
        timeout: 1000,
        interval: 5,
        progressCallback: (progress) => progresses.push(progress),
      });

      expect(settled).toHaveLength(2);
      expect(settled[0].status).toBe('fulfilled');
      expect(settled[1].status).toBe('rejected');
      expect(settled[0].value).toBe('first');
      expect(settled[1].reason.message).toBe('fail-second');
      expect(progresses.at(-1)).toBe(1);
    });

    test('可以取消运行中的任务，并在完成时结算为 cancelled', async () => {
      const pool = new TaskPool();

      const job = pool.task(async () => {
        await sleep(20);
        return 'done';
      }, { tag: 'running-cancel' });

      const taskId = job();
      const taskPromise = pool.waitTask(taskId);

      await sleep(5);
      expect(pool.cancelTask(taskId)).toBe(true);

      await expect(taskPromise).rejects.toThrow('Task cancelled');

      const stats = pool.getStatsByTag('running-cancel');
      expect(stats.cancelled).toBe(1);
      expect(stats.completed).toBe(0);
    });
  });
});



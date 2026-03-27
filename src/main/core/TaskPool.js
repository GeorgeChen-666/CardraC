import workerpool from 'workerpool';
import os from 'os';

/**
 * TaskPool - 任务池管理器
 *
 * tag：标签，可以批量处理
 * priority：优先级数字越大优先级越高
 *
 * 用法：
 * 1. 定义任务：const task = pool.task(fn, { tag: 'myTag', priority: 10 })
 * 2. 执行任务：const taskId = task(arg1, arg2)
 * 3. 等待结果：const result = await pool.waitTask(taskId)
 * 4. 获取统计：pool.getStatsByTag('myTag')
 *
 * @example
 * const compress = pool.task(async (path) => { ... }, { tag: 'compress' });
 * const taskId = compress('/path/to/image.jpg');
 * const result = await pool.waitTask(taskId);
 */

export class TaskPool {
  constructor(options = {}) {
    const defaultMaxWorkers = this._getDefaultMaxWorkers();

    this.pool = workerpool.pool(options.workerScript, {
      maxWorkers: options.maxWorkers ?? defaultMaxWorkers
    });

    this.tasks = new Map();
    this.tagIndex = new Map();
    this.tagProgressCallbacks = new Map();

    this.stats = {
      total: 0,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };

    console.log(`✅ TaskPool initialized with ${this.pool.maxWorkers} workers (CPU cores: ${this._getCPUCount()})`);
  }

  _getCPUCount() {
    if (typeof os !== 'undefined' && os.cpus) {
      return os.cpus().length;
    }
    if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
      return navigator.hardwareConcurrency;
    }
    return 4;
  }

  _getDefaultMaxWorkers() {
    const cpuCount = this._getCPUCount();
    return Math.max(1, cpuCount - 1);
  }

  /**
   * 定义一个可重复使用的任务
   * @param {Function} fn - 要在 worker 中执行的函数
   * @param {Object} options - 任务选项
   * @param {string} [options.tag] - 任务标签
   * @param {number} [options.priority=0] - 优先级（数字越大优先级越高）
   * @returns {Function} 返回一个函数，调用时执行任务并返回 taskId
   */
  task(fn, options = {}) {
    return (...args) => {
      const taskId = crypto.randomUUID();
      const { tag, priority = 0, timeout } = options;

      const task = {
        id: taskId,
        fn,
        args,
        tag,
        priority,
        timeout,
        status: 'pending',
        createdAt: Date.now(),
        startedAt: null,
        completedAt: null,
        result: null,
        error: null,
        promise: null
      };

      // ✅ 使用 workerpool 的优先级功能
      task.promise = this.pool.exec(fn, args, {
        priority: priority, // workerpool 支持优先级
        on: (payload) => {
          if (tag && this.tagProgressCallbacks.has(tag)) {
            const callback = this.tagProgressCallbacks.get(tag);
            callback({
              taskId,
              tag,
              payload,
              stats: this.getStatsByTag(tag)
            });
          }
        }
      }).then(result => {
        task.result = result;
        task.status = 'completed';
        task.completedAt = Date.now();
        this._updateStats(task, 'completed');
        return result;
      }).catch(error => {
        task.error = error;
        task.status = 'failed';
        task.completedAt = Date.now();
        this._updateStats(task, 'failed');
        throw error;
      });

      this.tasks.set(taskId, task);

      if (tag) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag).add(taskId);
      }

      this.stats.total++;
      this.stats.pending++;

      task.status = 'running';
      task.startedAt = Date.now();
      this._updateStats(task, 'running');

      return taskId;
    };
  }

  onTagProgress(tag, callback) {
    this.tagProgressCallbacks.set(tag, callback);
  }

  _updateStats(task, newStatus) {
    const oldStatus = task.status;

    if (oldStatus === 'pending') this.stats.pending--;
    if (oldStatus === 'running') this.stats.running--;

    if (newStatus === 'running') this.stats.running++;
    if (newStatus === 'completed') this.stats.completed++;
    if (newStatus === 'failed') this.stats.failed++;
    if (newStatus === 'cancelled') this.stats.cancelled++;
  }

  getTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    return {
      id: task.id,
      tag: task.tag,
      priority: task.priority,
      status: task.status,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      duration: task.completedAt ? task.completedAt - task.createdAt : null,
      result: task.result,
      error: task.error
    };
  }

  async waitTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    return await task.promise;
  }

  getTasksByTag(tag) {
    const taskIds = this.tagIndex.get(tag);
    if (!taskIds) return [];
    return Array.from(taskIds).map(id => this.getTask(id));
  }

  getStatsByTag(tag) {
    const tasks = this.getTasksByTag(tag);
    return {
      tag,
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      running: tasks.filter(t => t.status === 'running').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length
    };
  }

  async waitTasksByTag(tag) {
    const taskIds = this.tagIndex.get(tag);
    if (!taskIds) return [];

    const promises = Array.from(taskIds).map(id => this.waitTask(id));
    return await Promise.allSettled(promises);
  }

  getStats() {
    return { ...this.stats };
  }

  getAllTagStats() {
    const tagStats = {};
    this.tagIndex.forEach((_, tag) => {
      tagStats[tag] = this.getStatsByTag(tag);
    });
    return tagStats;
  }

  async terminate() {
    await this.pool.terminate();
  }
}

export const taskPool = new TaskPool();

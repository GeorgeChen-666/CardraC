// src/main/core/TaskPool.js
import os from 'os';
import { generateUUID } from '../../shared/functions';

export class TaskPool {
  constructor(options = {}) {
    this.maxConcurrent = options.maxWorkers ?? Math.max(1, os.cpus().length - 2);
    this.tasks = new Map();
    this.tagIndex = new Map();
    this.tagStats = new Map();
    this.uniqueKeyIndex = new Map();
    this.runningCount = 0;
    this.queue = [];
    this.taskTypeCounter = 0;
    this.isProcessing = false; // ✅ 新增

    this.callbacksByTag = {
      create: new Map(),
      beforeStart: new Map(),
      complete: new Map(),
      error: new Map()
    };

    this.callbacksByTaskId = {
      create: new Map(),
      beforeStart: new Map(),
      complete: new Map(),
      error: new Map()
    };

    this.stats = {
      total: 0,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };

    console.log(`✅ TaskPool initialized with max ${this.maxConcurrent} concurrent tasks`);
  }

  // ✅ 新增：异步调度
  _scheduleProcessQueue() {
    if (this.isProcessing) return;
    setImmediate(() => this._processQueue());
  }

  task(fn, options = {}) {
    const taskTypeId = `task_${this.taskTypeCounter++}`;

    return (...args) => {
      const { tag, priority = 0, uniqueKey } = options;
      let actualUniqueKey = null;

      if (uniqueKey) {
        const userKey = typeof uniqueKey === 'function' ? uniqueKey(args) : uniqueKey;
        actualUniqueKey = `${taskTypeId}:${userKey}`;
        const existingTaskId = this.uniqueKeyIndex.get(actualUniqueKey);

        if (existingTaskId) {
          const existingTask = this.tasks.get(existingTaskId);
          if (existingTask && (existingTask.status === 'pending' || existingTask.status === 'running')) {
            console.log(`♻️ [${tag}] Reusing task: ${userKey}`);
            return existingTaskId;
          }
        }
      }

      const taskId = generateUUID();
      const task = {
        id: taskId,
        fn,
        args,
        tag,
        priority,
        uniqueKey: actualUniqueKey,
        taskTypeId,
        status: 'pending',
        createdAt: Date.now(),
        startedAt: null,
        completedAt: null,
        result: null,
        error: null,
        promise: null,
        resolve: null,
        reject: null,
        cancelled: false,
        pendingPromise: null
      };

      task.promise = new Promise((resolve, reject) => {
        task.resolve = resolve;
        task.reject = reject;
      });

      if (actualUniqueKey) {
        this.uniqueKeyIndex.set(actualUniqueKey, taskId);
      }

      this.tasks.set(taskId, task);

      if (tag) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag).add(taskId);

        if (!this.tagStats.has(tag)) {
          this.tagStats.set(tag, {
            total: 0,
            pending: 0,
            running: 0,
            completed: 0,
            failed: 0,
            cancelled: 0
          });
        }
        this.tagStats.get(tag).total++;
        this.tagStats.get(tag).pending++;
      }

      this.stats.total++;
      this.stats.pending++;
      this.queue.push(task);
      this.queue.sort((a, b) => b.priority - a.priority);

      const shouldContinue = this._triggerCallbacks(task, 'create', {
        taskId: task.id,
        tag: task.tag,
        fn: task.fn,
        args: task.args,
        options: { tag, priority, uniqueKey },
        updateTask: (newFn, newOptions) => this._updateTask(taskId, newFn, newOptions),
        cancel: () => this.cancelTask(taskId)
      });

      if (shouldContinue === false) {
        this.cancelTask(taskId);
        return taskId;
      }

      this._scheduleProcessQueue(); // ✅ 改为异步调度
      return taskId;
    };
  }

  _updateTask(taskId, fn, options) {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'pending') return false;

    if (fn !== undefined) task.fn = fn;

    if (options !== undefined) {
      if (options.tag !== undefined && options.tag !== task.tag) {
        const oldTag = task.tag;
        const newTag = options.tag;

        if (oldTag && this.tagIndex.has(oldTag)) {
          this.tagIndex.get(oldTag).delete(taskId);
          if (this.tagIndex.get(oldTag).size === 0) {
            this.tagIndex.delete(oldTag);
          }
        }

        const statusField = task.status === 'running' ? 'running' : 'pending';
        if (oldTag && this.tagStats.has(oldTag)) {
          this.tagStats.get(oldTag)[statusField]--;
          this.tagStats.get(oldTag).total--;
        }

        task.tag = newTag;
        if (newTag) {
          if (!this.tagIndex.has(newTag)) {
            this.tagIndex.set(newTag, new Set());
          }
          this.tagIndex.get(newTag).add(taskId);

          if (!this.tagStats.has(newTag)) {
            this.tagStats.set(newTag, {
              total: 0, pending: 0, running: 0,
              completed: 0, failed: 0, cancelled: 0
            });
          }
          this.tagStats.get(newTag).total++;
          this.tagStats.get(newTag)[statusField]++;
        }

        if (oldTag && !newTag) {
          this.stats[statusField]--;
          this.stats.total--;
        } else if (!oldTag && newTag) {
          this.stats[statusField]++;
          this.stats.total++;
        }
      }

      if (options.priority !== undefined) {
        task.priority = options.priority;
        this.queue.sort((a, b) => b.priority - a.priority);
      }

      if (options.uniqueKey !== undefined) {
        console.warn('⚠️ Changing uniqueKey is not supported');
        return false;
      }
    }

    return true;
  }

  _updateTagStats(task, oldStatus, newStatus) {
    if (!task.tag) return;
    const stats = this.tagStats.get(task.tag);
    if (!stats) return;
    if (oldStatus) stats[oldStatus]--;
    if (newStatus) stats[newStatus]++;
  }

  _removeFromTagIndex(task) {
    if (task.tag && this.tagIndex.has(task.tag)) {
      this.tagIndex.get(task.tag).delete(task.id);
      if (this.tagIndex.get(task.tag).size === 0) {
        this.tagIndex.delete(task.tag);
      }
    }
  }

  cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    if (['completed', 'failed', 'cancelled'].includes(task.status)) return false;

    const wasPending = task.status === 'pending';
    task.cancelled = true;

    if (wasPending) {
      task.status = 'cancelled';
      task.completedAt = Date.now();

      const queueIndex = this.queue.findIndex(t => t.id === taskId);
      if (queueIndex !== -1) this.queue.splice(queueIndex, 1);

      this.stats.pending--;
      this.stats.cancelled++;

      this._updateTagStats(task, 'pending', 'cancelled');
      this._removeFromTagIndex(task);

      if (task.uniqueKey) this.uniqueKeyIndex.delete(task.uniqueKey);
      this._cleanupTaskCallbacks(taskId);
      this.tasks.delete(taskId);
      task.reject(new Error('Task cancelled'));
    }

    console.log(`🚫 [${task.tag}] Task ${wasPending ? 'cancelled' : 'cancelling'}: ${taskId.substring(0, 8)}`);
    return true;
  }

  cancelTasksByTag(tag, options = {}) {
    const { onlyPending = false } = options;
    const taskIds = this.tagIndex.get(tag);
    if (!taskIds || taskIds.size === 0) return 0;

    let count = 0;
    const taskIdsCopy = Array.from(taskIds);
    for (const taskId of taskIdsCopy) {
      const task = this.tasks.get(taskId);
      if (!task) continue;
      if (onlyPending && task.status === 'running') continue;
      if (['completed', 'failed', 'cancelled'].includes(task.status)) continue;
      if (this.cancelTask(taskId)) count++;
    }

    console.log(`🚫 [${tag}] Cancelled ${count} tasks`);
    this._scheduleProcessQueue(); // ✅ 改为异步调度
    return count;
  }

  cancelAllTasks(options = {}) {
    const { onlyPending = false } = options;
    let count = 0;

    for (const [taskId, task] of this.tasks) {
      if (onlyPending && task.status === 'running') continue;
      if (['completed', 'failed', 'cancelled'].includes(task.status)) continue;
      if (this.cancelTask(taskId)) count++;
    }

    console.log(`🚫 Cancelled ${count} tasks`);
    this._scheduleProcessQueue(); // ✅ 改为异步调度
    return count;
  }

  _triggerCallbacks(task, event, data) {
    const callbackData = {
      ...data,
      stats: task.tag ? this.getStatsByTag(task.tag) : null
    };

    const taskCallback = this.callbacksByTaskId[event].get(task.id);
    if (taskCallback) {
      try {
        const result = taskCallback(callbackData);
        if (result === false) return false;
      } catch (err) {
        console.error(`Error in taskId ${event} callback:`, err);
      }
    }

    if (task.tag) {
      const tagCallback = this.callbacksByTag[event].get(task.tag);
      if (tagCallback) {
        try {
          const result = tagCallback(callbackData);
          if (result === false) return false;
        } catch (err) {
          console.error(`Error in tag ${event} callback:`, err);
        }
      }
    }

    return true;
  }

  _cleanupTaskCallbacks(taskId) {
    this.callbacksByTaskId.create.delete(taskId);
    this.callbacksByTaskId.beforeStart.delete(taskId);
    this.callbacksByTaskId.complete.delete(taskId);
    this.callbacksByTaskId.error.delete(taskId);
  }

  _handleCancelledTask(task) {
    task.status = 'cancelled';
    task.completedAt = Date.now();
    this.stats.running--;
    this.stats.cancelled++;
    this._updateTagStats(task, 'running', 'cancelled');
    this._removeFromTagIndex(task);
    if (task.uniqueKey) this.uniqueKeyIndex.delete(task.uniqueKey);
    this._cleanupTaskCallbacks(task.id);
    this.tasks.delete(task.id);
    task.reject(new Error('Task cancelled'));
  }

  // ✅ 重构：使用 while 循环，移除递归
  async _processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.runningCount < this.maxConcurrent && this.queue.length > 0) {
        const task = this.queue.shift();
        if (!task || task.cancelled) continue;

        this.runningCount++;
        task.status = 'running';
        task.startedAt = Date.now();
        this.stats.pending--;
        this.stats.running++;
        this._updateTagStats(task, 'pending', 'running');

        const shouldContinue = this._triggerCallbacks(task, 'beforeStart', {
          taskId: task.id,
          tag: task.tag,
          fn: task.fn,
          args: task.args,
          options: { tag: task.tag, priority: task.priority, uniqueKey: task.uniqueKey },
          cancel: () => this.cancelTask(task.id),
          waitFor: (promiseOrFn) => {
            task.pendingPromise = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
          }
        });

        if (shouldContinue === false || task.cancelled) {
          this._handleCancelledTask(task);
          this.runningCount--;
          continue;
        }

        if (task.pendingPromise) {
          try {
            await task.pendingPromise;
          } catch (error) {
            console.error(`⚠️ Error in waitFor:`, error);
            task.error = error;
            task.status = 'failed';
            task.completedAt = Date.now();
            this.stats.running--;
            this.stats.failed++;
            this._updateTagStats(task, 'running', 'failed');
            this._removeFromTagIndex(task);
            if (task.uniqueKey) this.uniqueKeyIndex.delete(task.uniqueKey);
            this._triggerCallbacks(task, 'error', {
              taskId: task.id,
              tag: task.tag,
              error: error,
              duration: task.completedAt - task.createdAt
            });
            this._cleanupTaskCallbacks(task.id);
            this.tasks.delete(task.id);
            task.reject(error);
            this.runningCount--;
            continue;
          }
          task.pendingPromise = null;
        }

        if (task.cancelled) {
          this._handleCancelledTask(task);
          this.runningCount--;
          continue;
        }

        this._executeTask(task); // ✅ 异步执行
      }
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0 && this.runningCount < this.maxConcurrent) {
        this._scheduleProcessQueue();
      }
    }
  }

  // ✅ 新增：独立任务执行
  async _executeTask(task) {
    try {
      const result = await task.fn(task, ...task.args);

      if (task.cancelled) {
        this._handleCancelledTask(task);
        this.runningCount--;
        this._scheduleProcessQueue();
        return;
      }

      task.result = result;
      task.status = 'completed';
      task.completedAt = Date.now();
      this.stats.running--;
      this.stats.completed++;
      this._updateTagStats(task, 'running', 'completed');
      this._removeFromTagIndex(task);
      if (task.uniqueKey) this.uniqueKeyIndex.delete(task.uniqueKey);
      this._triggerCallbacks(task, 'complete', {
        taskId: task.id,
        tag: task.tag,
        result: result,
        duration: task.completedAt - task.createdAt
      });
      this._cleanupTaskCallbacks(task.id);
      this.tasks.delete(task.id);
      task.resolve(result);

    } catch (error) {
      if (task.cancelled) {
        this._handleCancelledTask(task);
        this.runningCount--;
        this._scheduleProcessQueue();
        return;
      }

      task.error = error;
      task.status = 'failed';
      task.completedAt = Date.now();
      this.stats.running--;
      this.stats.failed++;
      this._updateTagStats(task, 'running', 'failed');
      this._removeFromTagIndex(task);
      this._triggerCallbacks(task, 'error', {
        taskId: task.id,
        tag: task.tag,
        error: error,
        duration: task.completedAt - task.createdAt
      });
      if (task.uniqueKey) this.uniqueKeyIndex.delete(task.uniqueKey);
      this._cleanupTaskCallbacks(task.id);
      this.tasks.delete(task.id);
      task.reject(error);

    } finally {
      this.runningCount--;
      this._scheduleProcessQueue();
    }
  }

  onCreateByTag(tag, callback) { this.callbacksByTag.create.set(tag, callback); }
  onCreateByTaskId(taskId, callback) { this.callbacksByTaskId.create.set(taskId, callback); }
  onBeforeStartByTag(tag, callback) { this.callbacksByTag.beforeStart.set(tag, callback); }
  onBeforeStartByTaskId(taskId, callback) { this.callbacksByTaskId.beforeStart.set(taskId, callback); }
  onCompleteByTag(tag, callback) { this.callbacksByTag.complete.set(tag, callback); }
  onCompleteByTaskId(taskId, callback) { this.callbacksByTaskId.complete.set(taskId, callback); }
  onErrorByTag(tag, callback) { this.callbacksByTag.error.set(tag, callback); }
  onErrorByTaskId(taskId, callback) { this.callbacksByTaskId.error.set(taskId, callback); }

  async waitTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    return await task.promise;
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

  getTasksByTag(tag) {
    const taskIds = this.tagIndex.get(tag);
    if (!taskIds) return [];
    return Array.from(taskIds).map(id => this.getTask(id)).filter(t => t !== null);
  }

  getStatsByTag(tag) {
    const stats = this.tagStats.get(tag);
    if (!stats) {
      return {
        tag,
        total: 0,
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0
      };
    }
    return { tag, ...stats };
  }

  async waitTasksByTag(tag, options = {}) {
    const { timeout = 60000 } = options;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkCompletion = () => {
        const stats = this.getStatsByTag(tag);
        if (stats.pending === 0 && stats.running === 0) {
          const taskIds = this.tagIndex.get(tag);
          if (taskIds && taskIds.size > 0) {
            Promise.allSettled(Array.from(taskIds).map(id => this.waitTask(id)))
              .then(resolve)
              .catch(reject);
          } else {
            resolve([]);
          }
          return;
        }
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for tag: ${tag}`));
          return;
        }
        setImmediate(checkCompletion);
      };

      checkCompletion();
    });
  }

  getStats() { return { ...this.stats }; }

  clearCompletedStatsByTag(tag) {
    const stats = this.tagStats.get(tag);
    if (!stats) {
      this.tagStats.set(tag, {
        total: 0,
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0
      });
      return;
    }
    const activeTasks = stats.pending + stats.running;
    this.tagStats.set(tag, {
      total: activeTasks,
      pending: stats.pending,
      running: stats.running,
      completed: 0,
      failed: 0,
      cancelled: 0
    });
    console.log(`🧹 Cleared completed stats for tag: ${tag} (kept ${activeTasks} active tasks)`);
  }

  clearAllTagStats() {
    this.tagStats.clear();
    console.log('🧹 Cleared all tag stats');
  }

  getAllTagStats() {
    const tagStats = {};
    this.tagStats.forEach((stats, tag) => {
      tagStats[tag] = { tag, ...stats };
    });
    return tagStats;
  }

  async terminate() {
    this.cancelAllTasks();
    this.queue = [];
    this.tasks.clear();
    this.tagIndex.clear();
    this.tagStats.clear();
    this.uniqueKeyIndex.clear();
    console.log('🛑 TaskPool terminated');
  }
}

export const taskPool = new TaskPool();

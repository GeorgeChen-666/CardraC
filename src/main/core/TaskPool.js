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

    // 调度状态，新增：避免重复 schedule
    this.isProcessing = false;
    this.isScheduled = false;

    // callbacks 存 Set，支持多回调
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

  // 调度：加入 isScheduled 防止重复 setImmediate 调用
  _scheduleProcessQueue() {
    if (this.isProcessing || this.isScheduled) return;
    this.isScheduled = true;
    setImmediate(() => this._processQueue());
  }


  task(fn, options = {}) {
    return (...args) => {
      const { tag, priority = 0, uniqueKey } = options;

      // ✅ 用 tag:userKey 作为实际 key
      let actualUniqueKey = null;
      if (uniqueKey) {
        const userKey = typeof uniqueKey === 'function' ? uniqueKey(args) : uniqueKey;

        // ✅ tag 作为 namespace
        actualUniqueKey = tag ? `${tag}:${userKey}` : userKey;

        // 检查是否已存在
        const existingTaskId = this.uniqueKeyIndex.get(actualUniqueKey);
        if (existingTaskId) {
          const existingTask = this.tasks.get(existingTaskId);
          if (existingTask && ['pending', 'running'].includes(existingTask.status)) {
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
        status: 'pending',
        createdAt: Date.now(),
        startedAt: null,
        completedAt: null,
        result: null,
        error: null,
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

        const stats = this._initTagStats(tag);
        stats.total++;
        stats.pending++;
      }

      this.stats.total++;
      this.stats.pending++;
      this.queue.push(task);
      this.queue.sort((a, b) => b.priority - a.priority);

      const shouldContinue = this._triggerCallbacks(task, 'create', {
        taskId,
        tag,
        fn,
        args,
        options,
        updateTask: (newFn, newOptions) => this._updateTask(taskId, newFn, newOptions),
        cancel: () => this.cancelTask(taskId)
      });

      if (shouldContinue === false) {
        this.cancelTask(taskId);
        return taskId;
      }

      this._scheduleProcessQueue();
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
  _initTagStats(tag) {
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
    return this.tagStats.get(tag);
  }
  _removeFromTagIndex(task) {
    if (task.tag && this.tagIndex.has(task.tag)) {
      this.tagIndex.get(task.tag).delete(task.id);
      if (this.tagIndex.get(task.tag).size === 0) {
        this.tagIndex.delete(task.tag);
      }
    }
  }

  // 统一 finalize / 清理逻辑，减少重复
  _finalizeTask(task, newStatus, { result = null, error = null } = {}) {
    if (!task) return;
    const oldStatus = task.status;

    // 防止重复 finalize
    if (['completed', 'failed', 'cancelled'].includes(oldStatus)) return;

    task.status = newStatus;
    task.completedAt = Date.now();
    task.result = result;
    task.error = error;

    // 从全局统计上，减少 oldStatus 并增加 newStatus
    if (oldStatus && typeof this.stats[oldStatus] === 'number') {
      this.stats[oldStatus]--;
    }
    if (newStatus && typeof this.stats[newStatus] === 'number') {
      this.stats[newStatus]++;
    }

    // 更新 tagStats（内部会基于 task.tag）
    this._updateTagStats(task, oldStatus, newStatus);

    // 从队列中移除（可能在 pending 状态）
    const queueIndex = this.queue.findIndex(t => t.id === task.id);
    if (queueIndex !== -1) this.queue.splice(queueIndex, 1);

    // 移除 tagIndex
    this._removeFromTagIndex(task);

    // 移除 uniqueKey 索引
    if (task.uniqueKey) this.uniqueKeyIndex.delete(task.uniqueKey);

    // 触发回调（成功/失败）
    if (newStatus === 'completed') {
      this._triggerCallbacks(task, 'complete', {
        taskId: task.id,
        tag: task.tag,
        result: result,
        duration: task.completedAt - task.createdAt
      });
    } else if (newStatus === 'failed') {
      this._triggerCallbacks(task, 'error', {
        taskId: task.id,
        tag: task.tag,
        error: error,
        duration: task.completedAt - task.createdAt
      });
    }

    // 清理回调映射（按 taskId）
    this._cleanupTaskCallbacks(task.id);

    // 从活跃 tasks 中删除
    this.tasks.delete(task.id);

    // resolve / reject promise
    if (newStatus === 'completed') {
      try { task.resolve(result); } catch (e) { /* ignore */ }
    } else {
      const err = error || new Error(`Task ${task.id} ${newStatus}`);
      try { task.reject(err); } catch (e) { /* ignore */ }
    }
  }

  _cleanupTaskCallbacks(taskId) {
    this.callbacksByTaskId.create.delete(taskId);
    this.callbacksByTaskId.beforeStart.delete(taskId);
    this.callbacksByTaskId.complete.delete(taskId);
    this.callbacksByTaskId.error.delete(taskId);
  }

  _handleCancelledTask(task) {
    // 把具体清理交给 _finalizeTask，传入 cancelled 状态
    this._finalizeTask(task, 'cancelled', { error: new Error('Task cancelled') });
  }

  // 使用 while 循环处理队列，移除递归
  async _processQueue() {
    if (this.isProcessing) return;
    // 已经安排的 schedule 请求现在要 clear（因为马上会运行）
    this.isProcessing = true;
    this.isScheduled = false;

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
          // 取消正在运行的任务（在 _finalizeTask 中会对 stats 进行调整）
          this._handleCancelledTask(task);
          this.runningCount--;
          continue;
        }

        if (task.pendingPromise) {
          try {
            await task.pendingPromise;
          } catch (error) {
            console.error(`⚠️ Error in waitFor:`, error);
            // 统一清理为 failed
            this._finalizeTask(task, 'failed', { error });
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

        this._executeTask(task); // 异步执行，不 await
      }
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0 && this.runningCount < this.maxConcurrent) {
        this._scheduleProcessQueue();
      }
    }
  }

  // 独立任务执行
  async _executeTask(task) {
    try {
      const result = await task.fn(task, ...task.args);

      if (task.cancelled) {
        this._handleCancelledTask(task);
        this.runningCount--;
        this._scheduleProcessQueue();
        return;
      }

      // 完成：使用统一 finalize
      this._finalizeTask(task, 'completed', { result });

    } catch (error) {
      if (task.cancelled) {
        this._handleCancelledTask(task);
        this.runningCount--;
        this._scheduleProcessQueue();
        return;
      }

      this._finalizeTask(task, 'failed', { error });

    } finally {
      this.runningCount--;
      this._scheduleProcessQueue();
    }
  }

  // callbacks 注册：新增为多回调支持（Set）
  onCreateByTag(tag, callback) {
    if (!this.callbacksByTag.create.has(tag)) this.callbacksByTag.create.set(tag, new Set());
    this.callbacksByTag.create.get(tag).add(callback);
  }
  onCreateByTaskId(taskId, callback) {
    if (!this.callbacksByTaskId.create.has(taskId)) this.callbacksByTaskId.create.set(taskId, new Set());
    this.callbacksByTaskId.create.get(taskId).add(callback);
  }
  onBeforeStartByTag(tag, callback) {
    if (!this.callbacksByTag.beforeStart.has(tag)) this.callbacksByTag.beforeStart.set(tag, new Set());
    this.callbacksByTag.beforeStart.get(tag).add(callback);
  }
  onBeforeStartByTaskId(taskId, callback) {
    if (!this.callbacksByTaskId.beforeStart.has(taskId)) this.callbacksByTaskId.beforeStart.set(taskId, new Set());
    this.callbacksByTaskId.beforeStart.get(taskId).add(callback);
  }
  onCompleteByTag(tag, callback) {
    if (!this.callbacksByTag.complete.has(tag)) this.callbacksByTag.complete.set(tag, new Set());
    this.callbacksByTag.complete.get(tag).add(callback);
  }
  onCompleteByTaskId(taskId, callback) {
    if (!this.callbacksByTaskId.complete.has(taskId)) this.callbacksByTaskId.complete.set(taskId, new Set());
    this.callbacksByTaskId.complete.get(taskId).add(callback);
  }
  onErrorByTag(tag, callback) {
    if (!this.callbacksByTag.error.has(tag)) this.callbacksByTag.error.set(tag, new Set());
    this.callbacksByTag.error.get(tag).add(callback);
  }
  onErrorByTaskId(taskId, callback) {
    if (!this.callbacksByTaskId.error.has(taskId)) this.callbacksByTaskId.error.set(taskId, new Set());
    this.callbacksByTaskId.error.get(taskId).add(callback);
  }

  // 触发回调：支持多个回调，若任一返回 false 则停止并返回 false
  _triggerCallbacks(task, event, data) {
    const callbackData = {
      ...data,
      stats: task.tag ? this.getStatsByTag(task.tag) : null
    };

    const taskCallbacks = this.callbacksByTaskId[event].get(task.id);
    if (taskCallbacks) {
      try {
        for (const cb of taskCallbacks) {
          const result = cb(callbackData);
          if (result === false) return false;
        }
      } catch (err) {
        console.error(`Error in taskId ${event} callback:`, err);
      }
    }

    if (task.tag) {
      const tagCallbacks = this.callbacksByTag[event].get(task.tag);
      if (tagCallbacks) {
        try {
          for (const cb of tagCallbacks) {
            const result = cb(callbackData);
            if (result === false) return false;
          }
        } catch (err) {
          console.error(`Error in tag ${event} callback:`, err);
        }
      }
    }

    return true;
  }

  cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    if (['completed', 'failed', 'cancelled'].includes(task.status)) return false;

    const wasPending = task.status === 'pending';
    task.cancelled = true;

    if (wasPending) {
      // 统一使用 finalizeTask 来清理 pending -> cancelled
      this._finalizeTask(task, 'cancelled', { error: new Error('Task cancelled') });
      console.log(`🚫 [${task.tag}] Task cancelled: ${taskId.substring(0, 8)}`);
      return true;
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
    this._scheduleProcessQueue();
    return count;
  }

  cancelAllTasks(options = {}) {
    const { onlyPending = false } = options;
    let count = 0;

    // 使用快照避免迭代时删除造成的问题
    for (const taskId of Array.from(this.tasks.keys())) {
      const task = this.tasks.get(taskId);
      if (!task) continue;
      if (onlyPending && task.status === 'running') continue;
      if (['completed', 'failed', 'cancelled'].includes(task.status)) continue;
      if (this.cancelTask(taskId)) count++;
    }

    console.log(`🚫 Cancelled ${count} tasks`);
    this._scheduleProcessQueue();
    return count;
  }

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

  getTaskByTagAndUniqueKey(tag, uniqueKey) {
    const actualKey = tag ? `${tag}:${uniqueKey}` : uniqueKey;
    const taskId = this.uniqueKeyIndex.get(actualKey);
    return taskId ? this.getTask(taskId) : null;
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
    const { timeout = 60000, interval = 100, progressCallback = null } = options;
    const startTime = Date.now();

    // 如果调用者期望清理已完成的统计，保持该行为
    if (progressCallback) {
      this.clearCompletedStatsByTag(tag);
    }
    const initialStats = this.getStatsByTag(tag);
    const expectedTotal = initialStats.total;

    // 如果没有任务，直接返回
    if (expectedTotal === 0) {
      progressCallback?.(1);
      return [];
    }

    // 设置进度轮询
    let pollInterval;
    if (progressCallback) {
      pollInterval = setInterval(() => {
        const stats = this.getStatsByTag(tag);
        const completed = stats.completed + stats.failed + stats.cancelled;
        const progress = Math.min(completed / expectedTotal, 1);
        progressCallback(progress);
      }, interval);
    }

    return new Promise((resolve, reject) => {
      const checkCompletion = () => {
        const stats = this.getStatsByTag(tag);
        if (stats.pending === 0 && stats.running === 0) {
          if (pollInterval) {
            clearInterval(pollInterval);
            progressCallback?.(1);
          }

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
          if (pollInterval) clearInterval(pollInterval);
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
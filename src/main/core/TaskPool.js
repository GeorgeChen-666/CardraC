import os from 'os';
import { generateUUID } from '../../shared/functions';



/**
 * TaskPool - 任务池管理器
 *
 * tag：标签，可以批量处理
 * priority：优先级数字越大优先级越高
 * uniqueKey：唯一键，用于任务去重
 *
 * 基础用法：
 * 1. 定义任务: const task = pool.task(fn, { tag: 'myTag', priority: 10, uniqueKey: (args) => args[0] })
 * 2. 执行任务: const taskId = task(arg1, arg2)
 * 3. 等待结果: const result = await pool.waitTask(taskId)
 * 4. 获取统计: pool.getStatsByTag('myTag')
 *
 * 回调用法：
 *
 * Tag 级别回调（监听所有同 tag 的任务）：
 * - pool.onCreateByTag(tag, callback)      // 任务创建时
 * - pool.onBeforeStartByTag(tag, callback) // 任务开始前
 * - pool.onCompleteByTag(tag, callback)    // 任务完成时
 * - pool.onErrorByTag(tag, callback)       // 任务失败时
 *
 * TaskId 级别回调（监听特定任务）：
 * - pool.onCreateByTaskId(taskId, callback)      // 任务创建时
 * - pool.onBeforeStartByTaskId(taskId, callback) // 任务开始前
 * - pool.onCompleteByTaskId(taskId, callback)    // 任务完成时
 * - pool.onErrorByTaskId(taskId, callback)       // 任务失败时
 *
 * 回调参数：
 *
 * onCreate 回调：
 * {
 *   taskId: string,
 *   tag: string,
 *   fn: Function,
 *   args: Array,
 *   options: { tag, priority, uniqueKey },
 *   updateTask: (fn, options) => boolean,  // 修改任务
 *   cancel: () => boolean                   // 取消任务
 * }
 *
 * onBeforeStart 回调：
 * {
 *   taskId: string,
 *   tag: string,
 *   fn: Function,
 *   args: Array,
 *   options: { tag, priority, uniqueKey },
 *   cancel: () => boolean                   // 取消任务
 * }
 *
 * onComplete 回调：
 * {
 *   taskId: string,
 *   tag: string,
 *   result: any,
 *   duration: number
 * }
 *
 * onError 回调：
 * {
 *   taskId: string,
 *   tag: string,
 *   error: Error,
 *   duration: number
 * }
 *
 * @example
 * // 基础用法
 * const compress = pool.task(async (path) => { ... }, { tag: 'compress', priority: 10 });
 * const taskId = compress('/path/to/image.jpg');
 * const result = await pool.waitTask(taskId);
 *
 * @example
 * // Tag 级别回调
 * pool.onCreateByTag('compress', (data) => {
 *   console.log(`Task created: ${data.taskId}`);
 *   // 动态调整优先级
 *   if (isUrgent) {
 *     data.updateTask(data.fn, { ...data.options, priority: 100 });
 *   }
 * });
 *
 * pool.onErrorByTag('compress', (data) => {
 *   console.error(`Task failed: ${data.error.message}`);
 * });
 *
 * @example
 * // TaskId 级别回调
 * const taskId = compress('/path/to/image.jpg');
 *
 * pool.onCreateByTaskId(taskId, (data) => {
 *   console.log('Specific task created');
 * });
 *
 * pool.onCompleteByTaskId(taskId, (data) => {
 *   console.log(`Task completed: ${data.result}`);
 * });
 *
 * @example
 * // 修改任务函数
 * pool.onCreateByTag('compress', (data) => {
 *   const originalFn = data.fn;
 *   const wrappedFn = async (...args) => {
 *     console.log('Before execution');
 *     const result = await originalFn(...args);
 *     console.log('After execution');
 *     return result;
 *   };
 *   data.updateTask(wrappedFn, data.options);
 * });
 *
 * @example
 * // 取消任务
 * pool.onCreateByTag('compress', (data) => {
 *   if (shouldCancel) {
 *     data.cancel();
 *     return false; // 返回 false 阻止任务执行
 *   }
 * });
 */
export class TaskPool {
  constructor(options = {}) {
    this.maxConcurrent = options.maxWorkers ?? Math.max(1, os.cpus().length - 1);
    this.tasks = new Map();
    this.tagIndex = new Map();
    this.uniqueKeyIndex = new Map();
    this.runningCount = 0;
    this.queue = [];
    this.taskTypeCounter = 0;

    // ✅ Tag 级别的回调
    this.callbacksByTag = {
      create: new Map(),
      beforeStart: new Map(),
      complete: new Map(),
      error: new Map()
    };

    // ✅ TaskId 级别的回调
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

    console.log(`✅ TaskPool initialized with max ${this.maxConcurrent} concurrent tasks (CPU cores: ${os.cpus().length})`);
  }

  task(fn, options = {}) {
    const taskTypeId = `task_${this.taskTypeCounter++}`;

    return (...args) => {
      const { tag, priority = 0, uniqueKey } = options;
      let actualUniqueKey = null;

      // 处理 uniqueKey
      if (uniqueKey) {
        const userKey = typeof uniqueKey === 'function' ? uniqueKey(args) : uniqueKey;
        actualUniqueKey = `${taskTypeId}:${userKey}`;
        const existingTaskId = this.uniqueKeyIndex.get(actualUniqueKey);

        if (existingTaskId) {
          const existingTask = this.tasks.get(existingTaskId);
          if (existingTask && (existingTask.status === 'pending' || existingTask.status === 'running')) {
            console.log(`♻️ [${tag}] Reusing task: ${userKey} (taskId: ${existingTaskId.substring(0, 8)})`);
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
      }

      this.stats.total++;
      this.stats.pending++;
      this.queue.push(task);
      this.queue.sort((a, b) => b.priority - a.priority);

      // ✅ 触发 "create" 回调
      const shouldContinue = this._triggerCallbacks(task, 'create', {
        taskId: task.id,
        tag: task.tag,
        fn: task.fn,
        args: task.args,
        options: { tag, priority, uniqueKey },
        updateTask: (newFn, newOptions) => this._updateTask(taskId, newFn, newOptions),
        cancel: () => this._cancelTask(taskId)
      });

      if (shouldContinue === false) {
        this._cancelTask(taskId);
        return taskId;
      }

      this._processQueue();
      return taskId;
    };
  }

  // ✅ 更新任务
  _updateTask(taskId, fn, options) {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'pending') {
      console.warn(`Cannot update task ${taskId}: not found or not pending`);
      return false;
    }

    // 更新函数
    if (fn !== undefined) {
      task.fn = fn;
    }

    // 更新 options
    if (options !== undefined) {
      // 更新 tag
      if (options.tag !== undefined && options.tag !== task.tag) {
        // 从旧 tag 中移除
        if (task.tag && this.tagIndex.has(task.tag)) {
          this.tagIndex.get(task.tag).delete(taskId);
        }
        // 添加到新 tag
        task.tag = options.tag;
        if (!this.tagIndex.has(options.tag)) {
          this.tagIndex.set(options.tag, new Set());
        }
        this.tagIndex.get(options.tag).add(taskId);
      }

      // 更新优先级
      if (options.priority !== undefined) {
        task.priority = options.priority;
        // 重新排序队列
        this.queue.sort((a, b) => b.priority - a.priority);
      }

      // 更新 uniqueKey
      if (options.uniqueKey !== undefined) {
        // 删除旧的 uniqueKey
        if (task.uniqueKey) {
          this.uniqueKeyIndex.delete(task.uniqueKey);
        }
        // 设置新的 uniqueKey
        task.uniqueKey = options.uniqueKey;
        if (options.uniqueKey) {
          this.uniqueKeyIndex.set(options.uniqueKey, taskId);
        }
      }
    }

    console.log(`✏️ [${task.tag}] Task updated:`, {
      taskId: taskId.substring(0, 8)
    });

    return true;
  }

  // ✅ 取消任务
  _cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      console.warn(`Cannot cancel task ${taskId}: not found`);
      return false;
    }

    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      console.warn(`Cannot cancel task ${taskId}: already ${task.status}`);
      return false;
    }

    const wasRunning = task.status === 'running';

    task.cancelled = true;
    task.status = 'cancelled';
    task.completedAt = Date.now();

    // 从队列中移除
    const queueIndex = this.queue.findIndex(t => t.id === taskId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
    }

    // 更新统计
    if (task.status === 'pending') {
      this.stats.pending--;
    } else if (wasRunning) {
      this.stats.running--;
    }
    this.stats.cancelled++;

    // 清理唯一键
    if (task.uniqueKey) {
      this.uniqueKeyIndex.delete(task.uniqueKey);
    }

    // 清理回调
    this._cleanupTaskCallbacks(taskId);

    // Reject promise
    task.reject(new Error('Task cancelled'));

    console.log(`🚫 [${task.tag}] Task cancelled:`, {
      taskId: taskId.substring(0, 8)
    });

    return true;
  }

  _triggerCallbacks(task, event, data) {
    let result;

    // ✅ 添加 stats
    const callbackData = {
      ...data,
      stats: task.tag ? this.getStatsByTag(task.tag) : null
    };

    // 调试日志
    if (event === 'beforeStart') {
      console.log(`🔍 beforeStart callbackData:`, callbackData);
    }

    // 1. TaskId 级别
    const taskCallback = this.callbacksByTaskId[event].get(task.id);
    if (taskCallback) {
      try {
        result = taskCallback(callbackData);
        if (result === false) return false;
      } catch (err) {
        console.error(`Error in taskId ${event} callback:`, err);
      }
    }

    // 2. Tag 级别
    if (task.tag) {
      const tagCallback = this.callbacksByTag[event].get(task.tag);
      if (tagCallback) {
        try {
          result = tagCallback(callbackData);
          if (result === false) return false;
        } catch (err) {
          console.error(`Error in tag ${event} callback:`, err);
        }
      }
    }

    return result;
  }

  // ✅ 清理 TaskId 级别的回调
  _cleanupTaskCallbacks(taskId) {
    this.callbacksByTaskId.create.delete(taskId);
    this.callbacksByTaskId.beforeStart.delete(taskId);
    this.callbacksByTaskId.complete.delete(taskId);
    this.callbacksByTaskId.error.delete(taskId);
  }

  async _processQueue() {
    while (this.runningCount < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task || task.cancelled) continue;

      this.runningCount++;
      task.status = 'running';
      task.startedAt = Date.now();
      this.stats.pending--;
      this.stats.running++;

      // ✅ 提供 waitFor 方法
      const shouldContinue = this._triggerCallbacks(task, 'beforeStart', {
        taskId: task.id,
        tag: task.tag,
        fn: task.fn,
        args: task.args,
        options: {
          tag: task.tag,
          priority: task.priority,
          uniqueKey: task.uniqueKey
        },
        cancel: () => this._cancelTask(task.id),
        // ✅ 新增：waitFor 方法
        waitFor: (promiseOrFn) => {
          if (typeof promiseOrFn === 'function') {
            task.pendingPromise = promiseOrFn();
          } else {
            task.pendingPromise = promiseOrFn;
          }
        }
      });

      if (shouldContinue === false || task.cancelled) {
        this._cancelTask(task.id);
        this.runningCount--;
        continue;
      }

      // ✅ 如果有 pendingPromise，等待它完成
      if (task.pendingPromise) {
        try {
          await task.pendingPromise;
        } catch (error) {
          console.error(`Error in waitFor promise:`, error);
        }
        task.pendingPromise = null;
      }

      // ✅ 再次检查是否被取消
      if (task.cancelled) {
        this._cancelTask(task.id);
        this.runningCount--;
        continue;
      }

      try {
        const result = await task.fn(...task.args);

        if (task.cancelled) {
          this.runningCount--;
          continue;
        }

        task.result = result;
        task.status = 'completed';
        task.completedAt = Date.now();
        const duration = task.completedAt - task.createdAt;
        this.stats.running--;
        this.stats.completed++;

        if (task.uniqueKey) {
          this.uniqueKeyIndex.delete(task.uniqueKey);
        }

        // ✅ 触发 "complete" 回调
        this._triggerCallbacks(task, 'complete', {
          taskId: task.id,
          tag: task.tag,
          result: result,
          duration: duration
        });

        // 清理回调
        this._cleanupTaskCallbacks(task.id);

        task.resolve(result);
      } catch (error) {
        if (task.cancelled) {
          this.runningCount--;
          continue;
        }

        task.error = error;
        task.status = 'failed';
        task.completedAt = Date.now();
        const duration = task.completedAt - task.createdAt;
        this.stats.running--;
        this.stats.failed++;

        // ✅ 触发 "error" 回调
        this._triggerCallbacks(task, 'error', {
          taskId: task.id,
          tag: task.tag,
          error: error,
          duration: duration
        });

        if (task.uniqueKey) {
          this.uniqueKeyIndex.delete(task.uniqueKey);
        }

        // 清理回调
        this._cleanupTaskCallbacks(task.id);

        task.reject(error);
      } finally {
        this.runningCount--;
        this._processQueue();
      }
    }
  }

  // ✅ 注册回调方法
  onCreateByTag(tag, callback) {
    this.callbacksByTag.create.set(tag, callback);
  }

  onCreateByTaskId(taskId, callback) {
    this.callbacksByTaskId.create.set(taskId, callback);
  }

  onBeforeStartByTag(tag, callback) {
    this.callbacksByTag.beforeStart.set(tag, callback);
  }

  onBeforeStartByTaskId(taskId, callback) {
    this.callbacksByTaskId.beforeStart.set(taskId, callback);
  }

  onCompleteByTag(tag, callback) {
    this.callbacksByTag.complete.set(tag, callback);
  }

  onCompleteByTaskId(taskId, callback) {
    this.callbacksByTaskId.complete.set(taskId, callback);
  }

  onErrorByTag(tag, callback) {
    this.callbacksByTag.error.set(tag, callback);
  }

  onErrorByTaskId(taskId, callback) {
    this.callbacksByTaskId.error.set(taskId, callback);
  }

  // ✅ 公共方法
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
    this.queue = [];
  }
}

export const taskPool = new TaskPool();

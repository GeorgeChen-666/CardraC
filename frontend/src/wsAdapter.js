// src/renderer/wsAdapter.js

/**
 * WebSocket 适配器 - 模仿 ipcRenderer API
 */
class WebSocketAdapter {
  constructor(url, options = {}) {
    this.url = url;
    this.ws = null;
    this.listeners = new Map(); // channel -> Set<handler>
    this.pendingRequests = new Map(); // requestId -> { resolve, reject, timeout }
    this.messageQueue = []; // ✅ 消息队列
    this.requestId = 0;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.isInitialized = false; // ✅ 是否已初始化

    // 配置选项
    this.options = {
      autoReconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      requestTimeout: 30000,
      initDelay: 1000, // ✅ 初始化延迟（毫秒）
      ...options
    };

    this.heartbeatTimer = null;
    this.reconnectTimer = null;

    // ✅ 延迟初始化
    if (this.options.initDelay > 0) {
      console.log(`⏳ WebSocket will initialize in ${this.options.initDelay}ms`);
      setTimeout(() => {
        this.connect();
      }, this.options.initDelay);
    } else {
      this.connect();
    }
  }

  /**
   * 连接 WebSocket
   */
  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.isConnected = true;
        this.isInitialized = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit('connected');

        // ✅ 发送队列中的消息
        this.flushMessageQueue();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.emit('error', error);
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket closed');
        this.isConnected = false;
        this.stopHeartbeat();
        this.emit('disconnected');
        this.handleReconnect();
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.handleReconnect();
    }
  }

  /**
   * 处理接收到的消息
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      const { action, requestId, success, data: payload } = message;

      // 处理请求-响应模式
      if (requestId && this.pendingRequests.has(requestId)) {
        const { resolve, reject, timeout } = this.pendingRequests.get(requestId);
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);

        if (success) {
          resolve(payload);
        } else {
          reject(new Error(payload?.error || 'Request failed'));
        }
        return;
      }

      // 触发事件监听器
      if (action) {
        this.emit(action, payload);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * 发送消息（类似 ipcRenderer.send）
   */
  send(channel, ...args) {
    const message = {
      action: channel,
      data: args.length === 1 ? args[0] : args,
      timestamp: Date.now()
    };

    // ✅ 如果未连接，加入队列
    if (!this.isConnected) {
      console.log(`📦 Message queued: ${channel}`);
      this.messageQueue.push({
        type: 'send',
        message
      });
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * 请求-响应模式（类似 ipcRenderer.invoke）
   */
  invoke(channel, data) {
    return new Promise((resolve, reject) => {
      const requestId = ++this.requestId;

      // 设置超时
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${channel}`));
      }, this.options.requestTimeout);

      // 保存 Promise 的 resolve/reject
      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // 发送请求
      const message = {
        action: channel,
        requestId,
        data,
        timestamp: Date.now()
      };

      // ✅ 如果未连接，加入队列
      if (!this.isConnected) {
        console.log(`📦 Request queued: ${channel}`);
        this.messageQueue.push({
          type: 'invoke',
          message
        });
        return;
      }

      this.ws.send(JSON.stringify(message));
    });
  }

  /**
   * ✅ 发送队列中的所有消息
   */
  flushMessageQueue() {
    if (this.messageQueue.length === 0) {
      return;
    }

    console.log(`📤 Flushing ${this.messageQueue.length} queued messages`);

    while (this.messageQueue.length > 0) {
      const { type, message } = this.messageQueue.shift();

      try {
        this.ws.send(JSON.stringify(message));
        console.log(`✅ Sent queued ${type}: ${message.action}`);
      } catch (error) {
        console.error(`❌ Failed to send queued message:`, error);
        // 如果发送失败，重新加入队列
        this.messageQueue.unshift({ type, message });
        break;
      }
    }
  }

  /**
   * ✅ 清空消息队列
   */
  clearMessageQueue() {
    const count = this.messageQueue.length;
    this.messageQueue = [];
    console.log(`🗑️ Cleared ${count} queued messages`);
  }

  /**
   * ✅ 获取队列中的消息数量
   */
  getQueueSize() {
    return this.messageQueue.length;
  }

  /**
   * 监听事件（类似 ipcRenderer.on）
   */
  on(channel, handler) {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel).add(handler);

    // 返回移除监听器的函数
    return () => this.off(channel, handler);
  }

  /**
   * 监听一次（类似 ipcRenderer.once）
   */
  once(channel, handler) {
    const onceHandler = (...args) => {
      handler(...args);
      this.off(channel, onceHandler);
    };
    return this.on(channel, onceHandler);
  }

  /**
   * 移除监听（类似 ipcRenderer.off）
   */
  off(channel, handler) {
    if (!this.listeners.has(channel)) {
      return;
    }

    if (handler) {
      this.listeners.get(channel).delete(handler);
    } else {
      // 如果没有指定 handler，移除所有监听器
      this.listeners.delete(channel);
    }
  }

  /**
   * 移除所有监听器
   */
  removeAllListeners(channel) {
    if (channel) {
      this.listeners.delete(channel);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * 触发事件
   */
  emit(channel, ...args) {
    if (!this.listeners.has(channel)) {
      return;
    }

    const handlers = this.listeners.get(channel);
    handlers.forEach(handler => {
      try {
        handler(...args);
      } catch (error) {
        console.error(`Error in handler for channel "${channel}":`, error);
      }
    });
  }

  /**
   * 启动心跳
   */
  startHeartbeat() {
    this.stopHeartbeat();

    if (this.options.heartbeatInterval > 0) {
      this.heartbeatTimer = setInterval(() => {
        if (this.isConnected) {
          this.send('heartbeat', { timestamp: Date.now() });
        }
      }, this.options.heartbeatInterval);
    }
  }

  /**
   * 停止心跳
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 处理重连
   */
  handleReconnect() {
    if (!this.options.autoReconnect) {
      return;
    }

    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      this.emit('reconnect-failed');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnecting... (${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.options.reconnectInterval);
  }

  /**
   * 关闭连接
   */
  close() {
    this.options.autoReconnect = false;
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.listeners.clear();
    this.pendingRequests.clear();
    this.clearMessageQueue(); // ✅ 清空队列
  }

  /**
   * 获取连接状态
   */
  getReadyState() {
    return this.ws?.readyState;
  }

  /**
   * 是否已连接
   */
  get connected() {
    return this.isConnected;
  }
}

let wsAdapter = null;

export const createWSAdapter = (url, options) => {
  if (wsAdapter) {
    wsAdapter.close();
  }
  wsAdapter = new WebSocketAdapter(url, options);
  return wsAdapter;
};

// ✅ 延迟 1 秒初始化
createWSAdapter('ws://localhost:3333/ws', {
  autoReconnect: true,
  reconnectInterval: 3000,
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000,
  requestTimeout: 30000,
  initDelay: 1000 // ✅ 延迟 1 秒
});

// 监听连接事件
wsAdapter.on('connected', () => {
  console.log('✅ WebSocket connected!');
  console.log(`📊 Queue size: ${wsAdapter.getQueueSize()}`);
});

wsAdapter.on('disconnected', () => {
  console.log('🔌 WebSocket disconnected!');
});

wsAdapter.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

export { wsAdapter };

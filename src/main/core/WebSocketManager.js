// src/main/WebSocketManager.js
class WebSocketManager {
  constructor() {
    this.handlers = new Map();
    this.wss = null;
  }

  init(wss) {
    this.wss = wss;

    wss.on('connection', (ws) => {
      console.log('🔌 WebSocket client connected');

      ws.on('message', (message) => {
        this.handleMessage(ws, message);
      });

      ws.on('close', () => {
        console.log('🔌 WebSocket client disconnected');
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
      });

      ws.send(JSON.stringify({
        action: 'connected',
        message: 'WebSocket connected',
        timestamp: Date.now()
      }));
    });

    console.log('✅ WebSocket Manager initialized');
  }

  on(action, handler) {
    if (this.handlers.has(action)) {
      console.warn(`⚠️ Handler for action "${action}" already exists, overwriting`);
    }
    this.handlers.set(action, handler);
    console.log(`📝 Registered handler for action: ${action}`);
  }

  async handleMessage(ws, message) {
    try {
      const { action, data, requestId } = JSON.parse(message);

      if (!this.handlers.has(action)) {
        this.sendError(ws, requestId, action, `Unknown action: ${action}`);
        return;
      }

      const handler = this.handlers.get(action);

      const event = {
        sender: {
          // ✅ 修改这里：添加 send 方法
          send: (channel, data) => this.sendTo(ws, channel, data)
        },
        reply: (result) => this.sendResponse(ws, requestId, action, true, result),
        replyError: (error) => this.sendError(ws, requestId, action, error)
      };

      await handler(event, data);

    } catch (err) {
      console.error('❌ WebSocket message error:', err);
      try {
        const { requestId, action } = JSON.parse(message);
        this.sendError(ws, requestId, action, err.message);
      } catch (parseErr) {
        console.error('Failed to parse error message:', parseErr);
      }
    }
  }

  sendResponse(ws, requestId, action, success, data) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        action,
        requestId,
        success,
        data
      }));
    }
  }

  sendError(ws, requestId, action, error) {
    this.sendResponse(ws, requestId, action, false, { error });
  }

  // ✅ 支持发送到指定频道（兼容 IPC 的 returnChannel）
  sendTo(ws, channel, data) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        action: channel,
        data,
        timestamp: Date.now()
      }));
    }
  }

  // ✅ 添加 send() 方法（广播给所有客户端）
  send(channel, data) {
    this.broadcast(channel, data);
  }

  broadcast(action, data) {
    if (!this.wss) return;

    const message = JSON.stringify({
      action,
      data,
      timestamp: Date.now()
    });

    this.wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  }
}

const wsManager = new WebSocketManager();

module.exports = { wsManager };

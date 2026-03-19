package websocket

import (
	"encoding/json"
	"log"
	"sync"
	"time"
)

// Event WebSocket 事件
type Event struct {
	Sender     *Sender
	Reply      func(result interface{})
	ReplyError func(error string)
}

// Sender 发送器
type Sender struct {
	client *Client
}

// Send 发送消息到指定频道
func (s *Sender) Send(channel string, data interface{}) {
	message := map[string]interface{}{
		"action":    channel,
		"data":      data,
		"timestamp": time.Now().UnixMilli(),
	}

	jsonData, err := json.Marshal(message)
	if err != nil {
		log.Printf("❌ Failed to marshal message: %v", err)
		return
	}

	if s.client != nil && s.client.send != nil {
		select {
		case s.client.send <- jsonData:
			log.Printf("📤 Sent to channel '%s'\n", channel)
		default:
			log.Printf("⚠️ Client send buffer full\n")
		}
	}
}

// MessageHandler 消息处理器
type MessageHandler func(event *Event, data map[string]interface{})

// Manager WebSocket 管理器
type Manager struct {
	hub      *Hub
	handlers map[string]MessageHandler
	mu       sync.RWMutex
}

// NewManager 创建新的管理器
func NewManager(hub *Hub) *Manager {
	return &Manager{
		hub:      hub,
		handlers: make(map[string]MessageHandler),
	}
}

// On 注册消息处理器
func (m *Manager) On(action string, handler MessageHandler) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.handlers[action]; exists {
		log.Printf("⚠️ Handler for action %q already exists, overwriting\n", action)
	}

	m.handlers[action] = handler
	log.Printf("📝 Registered handler for action: %s\n", action)
}

// HandleMessage 处理接收到的消息
func (m *Manager) HandleMessage(client *Client, message []byte) {
	log.Printf("📥 Received message: %s\n", string(message))

	var msg map[string]interface{}
	if err := json.Unmarshal(message, &msg); err != nil {
		log.Printf("❌ Failed to unmarshal message: %v", err)
		return
	}

	action, ok := msg["action"].(string)
	if !ok {
		log.Printf("❌ Invalid message format: missing action")
		return
	}

	data, _ := msg["data"].(map[string]interface{})
	requestId, _ := msg["requestId"].(string)

	log.Printf("🎯 Action: %s, RequestId: %s\n", action, requestId)

	m.mu.RLock()
	handler, exists := m.handlers[action]
	m.mu.RUnlock()

	if !exists {
		log.Printf("⚠️ No handler for action: %s", action)
		m.sendError(client, requestId, action, "Unknown action: "+action)
		return
	}

	log.Printf("✅ Found handler for action: %s\n", action)

	// 创建 event 对象
	event := &Event{
		Sender: &Sender{client: client},
		Reply: func(result interface{}) {
			m.sendResponse(client, requestId, action, true, result)
		},
		ReplyError: func(error string) {
			m.sendError(client, requestId, action, error)
		},
	}

	// 调用处理器
	go handler(event, data)
}

// sendResponse 发送响应
func (m *Manager) sendResponse(client *Client, requestId, action string, success bool, data interface{}) {
	message := map[string]interface{}{
		"action":    action,
		"requestId": requestId,
		"success":   success,
		"data":      data,
	}

	jsonData, err := json.Marshal(message)
	if err != nil {
		log.Printf("❌ Failed to marshal response: %v", err)
		return
	}

	if client != nil && client.send != nil {
		select {
		case client.send <- jsonData:
			log.Printf("✅ Sent response for action: %s\n", action)
		default:
			log.Printf("⚠️ Client send buffer full\n")
		}
	}
}

// sendError 发送错误
func (m *Manager) sendError(client *Client, requestId, action, error string) {
	m.sendResponse(client, requestId, action, false, map[string]interface{}{
		"error": error,
	})
}

// Send 广播消息到所有客户端
func (m *Manager) Send(channel string, data interface{}) {
	m.Broadcast(channel, data)
}

// Broadcast 广播消息
func (m *Manager) Broadcast(action string, data interface{}) {
	message := map[string]interface{}{
		"action":    action,
		"data":      data,
		"timestamp": time.Now().UnixMilli(),
	}

	jsonData, err := json.Marshal(message)
	if err != nil {
		log.Printf("❌ Failed to marshal broadcast: %v", err)
		return
	}

	m.hub.broadcast <- jsonData
}

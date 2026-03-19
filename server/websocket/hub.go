package websocket

import (
	"log"
)

// Hub 管理所有 WebSocket 连接
type Hub struct {
	// 已注册的客户端
	clients map[*Client]bool

	// 广播消息到所有客户端
	broadcast chan []byte

	// 注册新客户端
	register chan *Client

	// 注销客户端
	unregister chan *Client
}

// 创建新的 Hub
func NewHub() *Hub {
	return &Hub{
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
	}
}

// 运行 Hub
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			log.Printf("Client connected. Total clients: %d", len(h.clients))

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				log.Printf("Client disconnected. Total clients: %d", len(h.clients))
			}

		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}
}

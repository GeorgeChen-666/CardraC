package server

import (
	"context"
	"log"
	"net/http"
	"time"

	"main/server/plugins"
	"main/server/storage"
	"main/server/websocket"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

var srv *http.Server

// StartServer 启动服务器
func StartServer() {
	storage.InitConfigStore()

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	mux := http.NewServeMux()
	plugins.RegisterFileBrowserRoutes(mux, "/browse")
	
	r.Any("/api/*path", gin.WrapH(mux))
	r.Any("/browse", gin.WrapH(mux))
	r.Any("/browse/*filepath", gin.WrapH(mux))

	hub := websocket.NewHub()
	go hub.Run()
	wsManager := websocket.NewManager(hub)

	plugins.RegisterImageWsHandler(wsManager)
	plugins.RegisterConfigHandler(wsManager)
	plugins.RegisterTemplateHandler(wsManager)
	plugins.RegisterFileBrowserHandler(wsManager)
	plugins.RegisterProjectHandler(wsManager)
	plugins.RegisterOtherHandler(wsManager)

	r.GET("/ws", func(c *gin.Context) {
		websocket.ServeWs(hub, wsManager, c.Writer, c.Request)
	})

	srv = &http.Server{
		Addr:    ":3333",
		Handler: r,
	}

	log.Println("✅ HTTP Server: http://localhost:3333")
	log.Println("✅ WebSocket Server: ws://localhost:3333/ws")
	log.Println("✅ File Browser: http://localhost:3333/browse")

	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal("Server failed to start:", err)
	}
}

// StopServer 优雅关闭服务器
func StopServer() {
	if srv != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := srv.Shutdown(ctx); err != nil {
			log.Println("Server shutdown error:", err)
		} else {
			log.Println("✅ Server stopped gracefully")
		}
	}
}

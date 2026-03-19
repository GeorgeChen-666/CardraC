package plugins

import (
	"archive/zip"
	"bytes"
	"fmt"
	"log"
	"os"

	"main/server/file_render"
	"main/server/file_render/adapter"
	"main/server/shared"
	"main/server/storage"
	"main/server/websocket"
)

// RegisterOtherHandler registers miscellaneous WebSocket handlers
func RegisterOtherHandler(wsManager *websocket.Manager) {
	// exportFile handler
	wsManager.On(shared.ExportFile, func(event *websocket.Event, data map[string]interface{}) {
		log.Println("📤 ExportFile called")

		cardListRaw, _ := data["CardList"]
		globalBackgroundRaw, _ := data["globalBackground"]
		targetFileType, _ := data["targetFileType"].(string)
		returnChannel, _ := data["returnChannel"].(string)
		progressChannel, _ := data["progressChannel"].(string)
		filePath, _ := data["filePath"].(string)

		// Get config
		config := storage.GetConfig()
		state := map[string]interface{}{
			"CardList":         cardListRaw,
			"globalBackground": globalBackgroundRaw,
			"Config":           config, // ← 添加 Config 到 state
		}

		// Get paged image list
		pagedImageList := file_render.GetPagedImageListByCardList(state, config)

		// Determine if we need ZIP
		extension := targetFileType
		sides, _ := config["sides"].(string)
		isFoldInHalf := sides == shared.FoldInHalf

		pageCount := len(pagedImageList)
		if isFoldInHalf {
			pageCount = pageCount / 2
		}

		needsZip := pageCount > 1 && targetFileType != shared.ExportPDF

		if needsZip {
			extension = shared.ExportZIP
		}

		if progressChannel != "" {
			event.Sender.Send(progressChannel, 0.1)
		}

		// Create adapter based on file type
		var adapterInstance adapter.IAdapter
		var err error

		switch targetFileType {
		case shared.ExportPDF:
			adapterInstance = adapter.NewPDFAdapter(config)
		case shared.ExportPNG:
			// 默认使用 high 质量
			quality := "high"
			if q, ok := data["quality"].(string); ok {
				quality = q
			}
			adapterInstance = adapter.NewSharpAdapter(config, quality)
		case shared.ExportSVG:
			// TODO: 实现 SVG adapter
			err = fmt.Errorf("SVG export not yet implemented")
		default:
			err = fmt.Errorf("unsupported file type: %s", targetFileType)
		}

		if err != nil {
			log.Printf("❌ Failed to create adapter: %v", err)
			event.Sender.Send("notification", map[string]interface{}{
				"status":      "error",
				"description": "util.operationFailed",
			})
			event.Sender.Send(returnChannel, false)
			return
		}

		if progressChannel != "" {
			event.Sender.Send(progressChannel, 0.3)
		}

		// Export file - 传入 nil 表示渲染所有页面
		blob, err := file_render.ExportFile(adapterInstance, state, nil)
		if err != nil {
			log.Printf("❌ Failed to export file: %v", err)
			event.Sender.Send("notification", map[string]interface{}{
				"status":      "error",
				"description": "util.operationFailed",
			})
			event.Sender.Send(returnChannel, false)
			return
		}

		if progressChannel != "" {
			event.Sender.Send(progressChannel, 0.5)
		}

		var returnContent []byte

		// Handle multiple pages - create ZIP
		if blobArray, ok := blob.([][]byte); ok && len(blobArray) > 1 {
			log.Printf("📦 Creating ZIP archive with %d pages", len(blobArray))

			buf := new(bytes.Buffer)
			zipWriter := zip.NewWriter(buf)

			for pageNumber, pageData := range blobArray {
				fileName := fmt.Sprintf("page%d.%s", pageNumber, targetFileType)

				writer, err := zipWriter.Create(fileName)
				if err != nil {
					log.Printf("❌ Failed to create ZIP entry: %v", err)
					continue
				}

				_, err = writer.Write(pageData)
				if err != nil {
					log.Printf("❌ Failed to write ZIP entry: %v", err)
					continue
				}
			}

			err = zipWriter.Close()
			if err != nil {
				log.Printf("❌ Failed to close ZIP: %v", err)
				event.Sender.Send("notification", map[string]interface{}{
					"status":      "error",
					"description": "util.operationFailed",
				})
				event.Sender.Send(returnChannel, false)
				return
			}

			returnContent = buf.Bytes()
			log.Printf("✅ ZIP created: %d bytes", len(returnContent))
		} else if singleBlob, ok := blob.([]byte); ok {
			returnContent = singleBlob
		} else {
			log.Printf("❌ Unexpected blob type: %T", blob)
			event.Sender.Send("notification", map[string]interface{}{
				"status":      "error",
				"description": "util.operationFailed",
			})
			event.Sender.Send(returnChannel, false)
			return
		}

		if progressChannel != "" {
			event.Sender.Send(progressChannel, 0.7)
		}

		// Write to file
		err = os.WriteFile(filePath, returnContent, 0644)
		if err != nil {
			log.Printf("❌ Failed to write file: %v", err)
			event.Sender.Send("notification", map[string]interface{}{
				"status":      "error",
				"description": "util.operationFailed",
			})
			event.Sender.Send(returnChannel, false)
			return
		}

		if progressChannel != "" {
			event.Sender.Send(progressChannel, 1.0)
		}

		log.Printf("✅ File exported successfully: %s (%s)", filePath, extension)
		event.Sender.Send(returnChannel, true)
	})

	log.Println("✅ Other handlers registered (1 handler)")
}

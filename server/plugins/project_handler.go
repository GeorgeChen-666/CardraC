package plugins

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"strings"

	"main/server/file_render"
	"main/server/shared"
	"main/server/storage"
	"main/server/utils"
	"main/server/websocket"
)

// ProjectData represents the project structure
type ProjectData struct {
	Config          map[string]interface{} `json:"Config"`
	CardList        []interface{}          `json:"CardList"`
	ImageStorage    map[string]string      `json:"ImageStorage"`
	OverviewStorage map[string]string      `json:"OverviewStorage"`
}

// getHomeDir returns the user's home directory
func getHomeDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return home
}

// refreshCardStorage cleans up unused images from storage
func refreshCardStorage(cardList []interface{}, globalBackground interface{}) {
	usedImagePath := make(map[string]bool)

	// Collect used image paths from cards
	for _, cardRaw := range cardList {
		card, ok := cardRaw.(map[string]interface{})
		if !ok {
			continue
		}

		if face, ok := card["face"].(map[string]interface{}); ok {
			if path, ok := face["path"].(string); ok {
				pathKey := strings.ReplaceAll(path, "\\", "")
				usedImagePath[pathKey] = true
			}
		}

		if back, ok := card["back"].(map[string]interface{}); ok {
			if path, ok := back["path"].(string); ok {
				pathKey := strings.ReplaceAll(path, "\\", "")
				usedImagePath[pathKey] = true
			}
		}
	}

	// Add global background path
	if globalBackground != nil {
		if bg, ok := globalBackground.(map[string]interface{}); ok {
			if path, ok := bg["path"].(string); ok {
				pathKey := strings.ReplaceAll(path, "\\", "")
				usedImagePath[pathKey] = true
			}
		}
	}

	// Clean up OverviewStorage
	overviewKeys := file_render.OverviewStorage.Keys()
	for _, key := range overviewKeys {
		if !usedImagePath[key] {
			file_render.OverviewStorage.Delete(key)
		}
	}

	// Clean up ImageStorage
	imageKeys := file_render.ImageStorage.Keys()
	for _, key := range imageKeys {
		if !usedImagePath[key] {
			file_render.ImageStorage.Delete(key)
		}
	}
}

// loadCpnpFile loads a project file with streaming JSON parsing
func loadCpnpFile(filePath string, progressChannel string, event *websocket.Event) (*ProjectData, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		return nil, fmt.Errorf("failed to get file info: %w", err)
	}
	fileSize := fileInfo.Size()

	// Clear existing storage
	file_render.ImageStorage.Clear()
	file_render.OverviewStorage.Clear()

	// Read entire file
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	// Send progress
	if progressChannel != "" {
		event.Sender.Send(progressChannel, 0.3)
	}

	var rawData map[string]interface{}
	if err := json.Unmarshal(data, &rawData); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	projectData := &ProjectData{
		CardList: []interface{}{},
		Config:   make(map[string]interface{}),
	}

	homeDir := getHomeDir()
	imageCount := 0
	overviewCount := 0

	// Process ImageStorage
	if imageStorageRaw, ok := rawData["ImageStorage"].(map[string]interface{}); ok {
		for imgKey, imgValue := range imageStorageRaw {
			if imgValueStr, ok := imgValue.(string); ok && imgValueStr != "" {
				fixedKey := strings.Replace(imgKey, strings.ReplaceAll(homeDir, "\\", ""), "~", 1)
				file_render.ImageStorage.Set(fixedKey, imgValueStr)
				imageCount++

				if imageCount%10 == 0 {
					log.Printf("📦 Loaded %d images...", imageCount)
				}
			}
		}
		log.Printf("✅ Loaded %d images from ImageStorage", imageCount)
	}

	if progressChannel != "" {
		event.Sender.Send(progressChannel, 0.6)
	}

	// Process OverviewStorage
	if overviewStorageRaw, ok := rawData["OverviewStorage"].(map[string]interface{}); ok {
		for ovKey, ovValue := range overviewStorageRaw {
			if ovValueStr, ok := ovValue.(string); ok && ovValueStr != "" {
				fixedKey := strings.Replace(ovKey, strings.ReplaceAll(homeDir, "\\", ""), "~", 1)
				file_render.OverviewStorage.Set(fixedKey, ovValueStr)
				overviewCount++
			}
		}
		log.Printf("✅ Loaded %d overviews from OverviewStorage", overviewCount)
	}

	if progressChannel != "" {
		event.Sender.Send(progressChannel, 0.8)
	}

	// Process CardList
	if cardListRaw, ok := rawData["CardList"].([]interface{}); ok {
		for _, cardRaw := range cardListRaw {
			if card, ok := cardRaw.(map[string]interface{}); ok {
				// Fix face path
				if face, ok := card["face"].(map[string]interface{}); ok {
					if path, ok := face["path"].(string); ok {
						face["path"] = utils.FixPath(path)
					}
					card["face"] = face
				}

				// Fix back path
				if back, ok := card["back"].(map[string]interface{}); ok {
					if path, ok := back["path"].(string); ok {
						back["path"] = utils.FixPath(path)
					}
					card["back"] = back
				}

				projectData.CardList = append(projectData.CardList, card)
			}
		}
	}

	// Process Config
	if configRaw, ok := rawData["Config"].(map[string]interface{}); ok {
		projectData.Config = configRaw

		// Fix global background path
		if gb, ok := configRaw["globalBackground"].(map[string]interface{}); ok {
			if path, ok := gb["path"].(string); ok {
				gb["path"] = utils.FixPath(path)
			}
			projectData.Config["globalBackground"] = gb
		}
	}

	// Handle special values
	if gb, ok := projectData.Config["globalBackground"].(map[string]interface{}); ok {
		if path, ok := gb["path"].(string); ok && path == "_emptyImg" {
			projectData.Config["globalBackground"] = nil
		}
	}

	// Clean up empty image references in CardList
	for i, cardRaw := range projectData.CardList {
		if card, ok := cardRaw.(map[string]interface{}); ok {
			if face, ok := card["face"].(map[string]interface{}); ok {
				if path, ok := face["path"].(string); ok && path == "_emptyImg" {
					card["face"] = nil
				}
			}
			if back, ok := card["back"].(map[string]interface{}); ok {
				if path, ok := back["path"].(string); ok && path == "_emptyImg" {
					card["back"] = nil
				}
			}
			projectData.CardList[i] = card
		}
	}

	if progressChannel != "" {
		event.Sender.Send(progressChannel, 1.0)
	}

	log.Printf("✅ Project loaded: %d images, %d overviews, file size: %d bytes", imageCount, overviewCount, fileSize)
	return projectData, nil
}

// saveProjectToFile saves project data to a file
func saveProjectToFile(projectData *ProjectData, filePath string, progressChannel string, event *websocket.Event) error {
	if progressChannel != "" {
		event.Sender.Send(progressChannel, 0.1)
	}

	// Convert ImageStorage to map
	imageStorageMap := make(map[string]string)
	imageKeys := file_render.ImageStorage.Keys()
	for _, key := range imageKeys {
		value := file_render.ImageStorage.Get(key)
		if value != nil {
			if valueStr, ok := value.(string); ok {
				imageStorageMap[key] = valueStr
			}
		}
	}

	if progressChannel != "" {
		event.Sender.Send(progressChannel, 0.5)
	}

	// Convert OverviewStorage to map
	overviewStorageMap := make(map[string]string)
	overviewKeys := file_render.OverviewStorage.Keys()
	for _, key := range overviewKeys {
		value := file_render.OverviewStorage.Get(key)
		if value != nil {
			if valueStr, ok := value.(string); ok {
				overviewStorageMap[key] = valueStr
			}
		}
	}

	if progressChannel != "" {
		event.Sender.Send(progressChannel, 0.8)
	}

	// Validate data integrity
	emptyKeys := []string{}
	for key, value := range imageStorageMap {
		if value == "" {
			emptyKeys = append(emptyKeys, key)
		}
	}

	if len(emptyKeys) > 0 {
		return fmt.Errorf("found %d empty image values: %v", len(emptyKeys), emptyKeys)
	}

	projectData.ImageStorage = imageStorageMap
	projectData.OverviewStorage = overviewStorageMap

	// Marshal to JSON
	data, err := json.MarshalIndent(projectData, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	// Write to file
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	if progressChannel != "" {
		event.Sender.Send(progressChannel, 1.0)
	}

	log.Println("✅ Project saved successfully")
	return nil
}

// RegisterProjectHandler registers project-related WebSocket handlers
func RegisterProjectHandler(wsManager *websocket.Manager) {
	// Check for .cpnp file in command line arguments
	go func() {
		args := os.Args
		for _, arg := range args {
			if strings.HasSuffix(arg, ".cpnp") {
				log.Printf("📂 Auto-loading project file: %s", arg)
				// This would need proper implementation with event handling
				break
			}
		}
	}()

	// saveProject handler
	wsManager.On(shared.SaveProject, func(event *websocket.Event, data map[string]interface{}) {
		log.Println("💾 SaveProject called")

		cardListRaw, _ := data["CardList"]
		globalBackgroundRaw, _ := data["globalBackground"]
		returnChannel, _ := data["returnChannel"].(string)
		progressChannel, _ := data["progressChannel"].(string)
		filePath, _ := data["filePath"].(string)

		cardList, ok := cardListRaw.([]interface{})
		if !ok {
			cardList = []interface{}{}
		}

		// Get config
		config := storage.GetConfig()
		config["globalBackground"] = globalBackgroundRaw

		projectData := &ProjectData{
			Config:   config,
			CardList: cardList,
		}

		// Clean up unused images
		refreshCardStorage(cardList, globalBackgroundRaw)

		// Save to file
		err := saveProjectToFile(projectData, filePath, progressChannel, event)
		if err != nil {
			log.Printf("❌ Failed to save project: %v", err)
			event.Sender.Send("notification", map[string]interface{}{
				"status":      "error",
				"description": "util.operationFailed",
			})
			event.Sender.Send(returnChannel, false)
			return
		}

		event.Sender.Send(returnChannel, true)
	})

	// openProject handler
	wsManager.On(shared.OpenProject, func(event *websocket.Event, data map[string]interface{}) {
		log.Println("📂 OpenProject called")

		returnChannel, _ := data["returnChannel"].(string)
		progressChannel, _ := data["progressChannel"].(string)
		filePath, _ := data["filePath"].(string)
		log.Println(returnChannel)
		projectData, err := loadCpnpFile(filePath, progressChannel, event)
		if err != nil {
			log.Printf("❌ Failed to load project: %v", err)
			event.Sender.Send("notification", map[string]interface{}{
				"status":      "error",
				"description": "util.invalidFile",
			})
			event.Sender.Send(returnChannel, nil)
			return
		}

		// Send the project data
		event.Sender.Send(returnChannel, map[string]interface{}{
			"Config":   projectData.Config,
			"CardList": projectData.CardList,
		})
	})

	log.Println("✅ Project handlers registered (2 handlers)")
}

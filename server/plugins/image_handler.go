package plugins

import (
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"main/server/file_render"
	"main/server/shared"
	"main/server/storage"
	"main/server/utils"
	"main/server/websocket"
)

// ImageLoadingJob 图片加载任务
type ImageLoadingJob struct {
	ImagePath string
	Job       func() error
}

var (
	imageStorageLoadingJobs = make(map[string]func() error)
	pendingList             = make(map[string]bool)
	pendingListMu           sync.Mutex
	progressClients         = make(map[string]interface{})
	progressClientsMu       sync.Mutex
)

// CompressParams 压缩参数
type CompressParams struct {
	MaxWidth int `json:"maxWidth"`
	Quality  int `json:"quality"`
	MaxDpi   int `json:"maxDpi"`
}

// ImageData 图片数据
type ImageData struct {
	Path  string `json:"path"`
	Mtime int64  `json:"mtime"`
}

// pathToImageData 将路径转换为图片数据
func pathToImageData(imagePath string, callback func()) (*ImageData, error) {
	config := storage.GetConfig()

	// ✅ 根据 config 的实际类型修改
	var cardWidth float64
	var compressLevel int

	// 如果 config 是 map[string]interface{}
	if cw, ok := config["cardWidth"].(float64); ok {
		cardWidth = cw
	} else {
		cardWidth = 300 // 默认值
	}

	if cl, ok := config["compressLevel"].(float64); ok {
		compressLevel = int(cl)
	} else {
		compressLevel = 2 // 默认值
	}

	compressParamsList := []CompressParams{
		{MaxWidth: int(cardWidth * 15), Quality: 100, MaxDpi: 300},
		{MaxWidth: int(cardWidth * 12), Quality: 90, MaxDpi: 200},
		{MaxWidth: int(cardWidth * 9), Quality: 85, MaxDpi: 150},
		{MaxWidth: int(cardWidth * 6), Quality: 80, MaxDpi: 75},
	}

	ext := filepath.Ext(imagePath)
	if ext != "" {
		ext = ext[1:]
	}

	imagePathKey := strings.ReplaceAll(utils.FixPath(imagePath), "\\", "")
	expandedPath := utils.ExpandPath(imagePath)

	fileInfo, err := os.Stat(expandedPath)
	if err != nil {
		return nil, err
	}
	mtime := fileInfo.ModTime().UnixMilli()

	returnObj := &ImageData{
		Path:  utils.FixPath(imagePath),
		Mtime: mtime,
	}

	pendingListMu.Lock()
	if !pendingList[imagePathKey] {
		pendingList[imagePathKey] = true
		pendingListMu.Unlock()

		imageStorageLoadingJobs[imagePath] = func() error {
			params := compressParamsList[compressLevel-1]
			compressed, err := utils.ReadCompressedImageWithOptions(expandedPath, utils.ImageOptions{
				MaxWidth: params.MaxWidth,
				Quality:  params.Quality,
			})
			if err != nil {
				return err
			}

			file_render.ImageStorage.Set(imagePathKey, compressed)

			pendingListMu.Lock()
			delete(pendingList, imagePathKey)
			pendingListMu.Unlock()

			delete(imageStorageLoadingJobs, imagePath)
			return nil
		}

		go imageStorageLoadingJobs[imagePath]()
	} else {
		pendingListMu.Unlock()
	}

	overview, err := utils.ReadCompressedImage(expandedPath, 100)
	if err != nil {
		log.Printf("Failed to load overview for %s: %v", imagePath, err)
	} else {
		file_render.OverviewStorage.Set(imagePathKey, overview)
	}

	// ✅ 使用 sync.Map 的 Delete 方法
	file_render.ColorCache.Delete(imagePathKey)

	if callback != nil {
		callback()
	}

	return returnObj, nil
}

// RegisterImageWsHandler 注册图片 WebSocket 处理器
func RegisterImageWsHandler(wsManager *websocket.Manager) {
	// 获取导出页面数量
	wsManager.On(shared.GetExportPageCount, func(event *websocket.Event, data map[string]interface{}) {
		cardListRaw, _ := data["CardList"]
		globalBackgroundRaw, _ := data["globalBackground"]
		returnChannel, _ := data["returnChannel"].(string)

		config := storage.GetConfig()
		state := map[string]interface{}{
			"CardList":         cardListRaw,
			"globalBackground": globalBackgroundRaw,
		}

		pagedImageList := file_render.GetPagedImageListByCardList(state, config)
		sides, _ := config["sides"].(string)
		isFoldInHalf := sides == shared.FoldInHalf

		var pageCount int
		if isFoldInHalf {
			pageCount = len(pagedImageList) / 2
		} else {
			pageCount = len(pagedImageList)
		}

		event.Sender.Send(returnChannel, pageCount)
	})

	// 获取导出预览
	wsManager.On(shared.GetExportPreview, func(event *websocket.Event, data map[string]interface{}) {
		pageIndex, _ := data["pageIndex"].(float64)
		cardListRaw, _ := data["CardList"]
		globalBackgroundRaw, _ := data["globalBackground"]
		returnChannel, _ := data["returnChannel"].(string)

		config := storage.GetConfig()
		state := map[string]interface{}{
			"CardList":         cardListRaw,
			"globalBackground": globalBackgroundRaw,
		}

		actualIndex := int(pageIndex) - 1
		requestStartTime := time.Now()
		log.Printf("\n📄 Request: Page %d", int(pageIndex))

		pagedImageList := file_render.GetPagedImageListByCardList(state, config)
		sides, _ := config["sides"].(string)
		isFoldInHalf := sides == shared.FoldInHalf

		var totalPages int
		if isFoldInHalf {
			totalPages = len(pagedImageList) / 2
		} else {
			totalPages = len(pagedImageList)
		}

		result, err := file_render.PrerenderPage(actualIndex, state, config, "exportFile")
		if err != nil {
			log.Printf("❌ Failed to prerender page %d: %v", int(pageIndex), err)
			event.Sender.Send(returnChannel, nil)
			return
		}

		requestEndTime := time.Now()
		totalDuration := requestEndTime.Sub(requestStartTime).Milliseconds()
		log.Printf("✨ Request completed in %dms\n", totalDuration)

		log.Println("🔮 Pre-rendering next 3 pages...")
		for i := 1; i <= 3; i++ {
			nextIndex := actualIndex + i
			if nextIndex < totalPages {
				go func(idx int) {
					_, err := file_render.PrerenderPage(idx, state, config, "exportFile")
					if err != nil {
						log.Printf("Failed to prerender page %d: %v", idx+1, err)
					}
				}(nextIndex)
			}
		}

		event.Sender.Send(returnChannel, result)
	})

	// 清除预览缓存
	wsManager.On(shared.ClearPreviewCache, func(event *websocket.Event, data map[string]interface{}) {
		returnChannel, _ := data["returnChannel"].(string)

		file_render.ClearPrerenderCache()
		log.Println("Preview cache cleared")

		event.Sender.Send(returnChannel, map[string]bool{"success": true})
	})

	// 加载图片列表
	wsManager.On(shared.LoadImageList, func(event *websocket.Event, data map[string]interface{}) {
		returnChannel, _ := data["returnChannel"].(string)
		imageListRaw, _ := data["imageList"]

		imageList, ok := imageListRaw.([]interface{})
		if !ok {
			event.Sender.Send(returnChannel, map[string]bool{"success": false})
			return
		}

		for _, imageDataRaw := range imageList {
			imageDataMap, ok := imageDataRaw.(map[string]interface{})
			if !ok {
				continue
			}

			path, ok := imageDataMap["path"].(string)
			if !ok {
				continue
			}

			go func(imagePath string) {
				_, err := pathToImageData(imagePath, nil)
				if err != nil {
					log.Printf("Failed to load image in background: %s, error: %v", imagePath, err)
				}
			}(path)
		}

		event.Sender.Send(returnChannel, map[string]bool{"success": true})
	})

	// 获取图片内容
	wsManager.On(shared.GetImageContent, func(event *websocket.Event, data map[string]interface{}) {
		returnChannel, _ := data["returnChannel"].(string)
		path, _ := data["path"].(string)
		quality, _ := data["quality"].(string)

		if quality == "" {
			quality = "low"
		}

		imagePathKey := strings.ReplaceAll(path, "\\", "")
		var content interface{}

		if quality == "high" {
			content = file_render.ImageStorage.Get(imagePathKey)

			if content == nil {
				success := shared.WaitCondition(
					func() bool {
						content = file_render.ImageStorage.Get(imagePathKey)
						return content != nil
					},
					50*time.Millisecond,
					10*time.Second,
				)

				if !success {
					log.Printf("Timeout waiting for high quality image: %s", path)
				}
			}
		} else {
			content = file_render.OverviewStorage.Get(imagePathKey)
		}

		if content == nil {
			event.Sender.Send(returnChannel, nil)
			return
		}

		event.Sender.Send(returnChannel, content)
	})

	// 检查图片是否存在
	wsManager.On(shared.CheckImage, func(event *websocket.Event, data map[string]interface{}) {
		returnChannel, _ := data["returnChannel"].(string)
		pathListRaw, _ := data["pathList"]

		pathList, ok := pathListRaw.([]interface{})
		if !ok {
			event.Sender.Send(returnChannel, []string{})
			return
		}

		invalidImages := []string{}

		for _, pathRaw := range pathList {
			path, ok := pathRaw.(string)
			if !ok {
				continue
			}

			expandedPath := utils.ExpandPath(path)
			if _, err := os.Stat(expandedPath); os.IsNotExist(err) {
				invalidImages = append(invalidImages, path)
			}
		}

		event.Sender.Send(returnChannel, invalidImages)
	})

	// 重新加载本地图片
	wsManager.On(shared.ReloadLocalImage, func(event *websocket.Event, data map[string]interface{}) {
		cardListRaw, _ := data["CardList"]
		globalBackgroundRaw, _ := data["globalBackground"]
		returnChannel, _ := data["returnChannel"].(string)
		progressChannel, _ := data["progressChannel"].(string)
		cancelChannel, _ := data["cancelChannel"].(string)

		config := storage.GetConfig()

		if globalBackgroundRaw != nil {
			config["globalBackground"] = globalBackgroundRaw
		}

		var reloadImageJobs []func() error

		file_render.ColorCache.Range(func(key, value interface{}) bool {
			file_render.ColorCache.Delete(key)
			return true
		})

		isTerminated := false
		var terminatedMu sync.Mutex

		if cancelChannel != "" {
			wsManager.On(cancelChannel, func(e *websocket.Event, d map[string]interface{}) {
				terminatedMu.Lock()
				isTerminated = true
				terminatedMu.Unlock()
			})
		}

		totalCount := 0
		currentCount := 0
		var countMu sync.Mutex
		alreadyKnownKey := make(map[string]bool)

		reloadImage := func(imageDataRaw interface{}, callback func(int64)) bool {
			if imageDataRaw == nil {
				return false
			}

			imageDataMap, ok := imageDataRaw.(map[string]interface{})
			if !ok {
				return false
			}

			imagePath, _ := imageDataMap["path"].(string)
			cardMtime, _ := imageDataMap["mtime"].(float64)

			imagePathKey := strings.ReplaceAll(utils.FixPath(imagePath), "\\", "")
			expandedPath := utils.ExpandPath(imagePath)

			fileInfo, err := os.Stat(expandedPath)
			if err != nil {
				return false
			}

			mtime := fileInfo.ModTime().UnixMilli()

			if int64(cardMtime) != mtime || !alreadyKnownKey[imagePathKey] {
				countMu.Lock()
				totalCount++
				alreadyKnownKey[imagePathKey] = true
				countMu.Unlock()

				reloadImageJobs = append(reloadImageJobs, func() error {
					terminatedMu.Lock()
					terminated := isTerminated
					terminatedMu.Unlock()

					if terminated {
						return nil
					}

					if callback != nil {
						callback(mtime)
					}

					_, err := pathToImageData(imagePath, nil)
					if err != nil {
						return err
					}

					terminatedMu.Lock()
					terminated = isTerminated
					terminatedMu.Unlock()

					if terminated {
						return nil
					}

					countMu.Lock()
					currentCount++
					progress := float64(currentCount) / float64(totalCount)
					countMu.Unlock()

					if progressChannel != "" {
						event.Sender.Send(progressChannel, progress)
					}

					return nil
				})

				return true
			}

			return false
		}

		cardList, ok := cardListRaw.([]interface{})
		if ok {
			for index, cardRaw := range cardList {
				cardMap, ok := cardRaw.(map[string]interface{})
				if !ok {
					continue
				}

				if face, ok := cardMap["face"]; ok {
					reloadImage(face, func(newMtime int64) {
						if faceMap, ok := cardMap["face"].(map[string]interface{}); ok {
							faceMap["mtime"] = newMtime
							cardList[index] = cardMap
						}
					})
				}

				if back, ok := cardMap["back"]; ok {
					reloadImage(back, func(newMtime int64) {
						if backMap, ok := cardMap["back"].(map[string]interface{}); ok {
							backMap["mtime"] = newMtime
							cardList[index] = cardMap
						}
					})
				}
			}
		}

		globalBackground, _ := config["globalBackground"]
		reloadImage(globalBackground, func(newMtime int64) {
			if bgMap, ok := config["globalBackground"].(map[string]interface{}); ok {
				bgMap["mtime"] = newMtime
			}
		})

		var wg sync.WaitGroup
		for _, job := range reloadImageJobs {
			wg.Add(1)
			go func(j func() error) {
				defer wg.Done()
				if err := j(); err != nil {
					log.Printf("Failed to reload image: %v", err)
				}
			}(job)
		}
		wg.Wait()

		terminatedMu.Lock()
		terminated := isTerminated
		terminatedMu.Unlock()

		if terminated {
			event.Sender.Send(returnChannel, map[string]bool{
				"isAborted": true,
			})
		} else {
			if progressChannel != "" {
				event.Sender.Send(progressChannel, 1.0)
			}
			event.Sender.Send(returnChannel, map[string]interface{}{
				"CardList": cardList,
				"Config":   config,
			})
		}
	})
}

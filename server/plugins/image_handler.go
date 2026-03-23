package plugins

import (
	"crypto/md5"
	"encoding/base64"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
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
	imageProcessQueue chan *ImageTask
	imageProcessOnce  sync.Once
	maxWorkers        = runtime.NumCPU()
)

type ImageTask struct {
	ImagePath  string
	Params     CompressParams
	IsOverview bool
	Callback   func(*ImageData, error)
	Done       chan struct{}
}

func initImageWorkerPool() {
	imageProcessOnce.Do(func() {
		imageProcessQueue = make(chan *ImageTask, 100) // 缓冲队列

		// 启动固定数量的 workers
		for i := 0; i < maxWorkers; i++ {
			go imageWorker()
		}

		log.Printf("Image worker pool initialized with %d workers", maxWorkers)
	})
}
func imageWorker() {
	for task := range imageProcessQueue {
		processImageTask(task)
	}
}
func processImageTask(task *ImageTask) {
	startTime := time.Now() // 开始计时

	defer func() {
		if task.Done != nil {
			close(task.Done)
		}
	}()

	imagePathKey := strings.ReplaceAll(utils.FixPath(task.ImagePath), "\\", "")
	expandedPath := utils.ExpandPath(task.ImagePath)

	fileInfo, err := os.Stat(expandedPath)
	if err != nil {
		if task.Callback != nil {
			task.Callback(nil, err)
		}
		return
	}

	mtime := fileInfo.ModTime().UnixMilli()

	if task.IsOverview {
		// 处理缩略图
		overview, err := utils.ReadCompressedImage(expandedPath, 100)
		if err != nil {
			log.Printf("Failed to load overview for %s: %v", task.ImagePath, err)
		} else {
			file_render.OverviewStorage.Set(imagePathKey, overview)

			// 保存缩略图到文件
			saveBase64ToFile(overview, imagePathKey, "overview")

			duration := time.Since(startTime)
			log.Printf("✅ Overview processed in %dms: %s", duration.Milliseconds(), task.ImagePath)
		}
	} else {
		// 处理高质量图片
		compressed, err := utils.ReadCompressedImageWithOptions(expandedPath, utils.ImageOptions{
			MaxWidth: task.Params.MaxWidth,
			Quality:  task.Params.Quality,
		})
		if err != nil {
			if task.Callback != nil {
				task.Callback(nil, err)
			}
			return
		}
		file_render.ImageStorage.Set(imagePathKey, compressed)

		// 保存高质量图到文件
		saveBase64ToFile(compressed, imagePathKey, "high_quality")

		duration := time.Since(startTime)
		log.Printf("✅ High quality processed in %dms: %s", duration.Milliseconds(), task.ImagePath)
	}

	file_render.ColorCache.Delete(imagePathKey)

	result := &ImageData{
		Path:  utils.FixPath(task.ImagePath),
		Mtime: mtime,
	}

	if task.Callback != nil {
		task.Callback(result, nil)
	}
}

// saveBase64ToFile 将base64数据保存为图片文件
func saveBase64ToFile(base64Data interface{}, imageKey string, quality string) error {
	// 创建输出目录
	outputDir := filepath.Join("output", quality)
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// 从base64字符串中提取实际数据
	base64Str, ok := base64Data.(string)
	if !ok {
		return fmt.Errorf("invalid base64 data type")
	}

	// 移除 data:image/xxx;base64, 前缀
	parts := strings.Split(base64Str, ",")
	if len(parts) != 2 {
		return fmt.Errorf("invalid base64 format")
	}

	// 解码base64
	imageData, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return fmt.Errorf("failed to decode base64: %w", err)
	}

	// 生成文件名（使用hash避免路径问题）
	hash := fmt.Sprintf("%x", md5.Sum([]byte(imageKey)))

	// 从base64前缀判断图片格式
	var ext string
	if strings.Contains(parts[0], "image/png") {
		ext = ".png"
	} else if strings.Contains(parts[0], "image/jpeg") || strings.Contains(parts[0], "image/jpg") {
		ext = ".jpg"
	} else if strings.Contains(parts[0], "image/webp") {
		ext = ".webp"
	} else {
		ext = ".jpg" // 默认
	}

	filename := filepath.Join(outputDir, hash+ext)

	// 写入文件
	if err := os.WriteFile(filename, imageData, 0644); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	log.Printf("💾 Saved %s image: %s", quality, filename)
	return nil
}

var (
	pendingList   = make(map[string]bool)
	pendingListMu sync.Mutex
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

// pathToImageData
func pathToImageData(imagePath string, callback func()) (*ImageData, error) {
	initImageWorkerPool()

	config := storage.GetConfig()
	var cardWidth float64
	var compressLevel int

	if cw, ok := config["cardWidth"].(float64); ok {
		cardWidth = cw
	} else {
		cardWidth = 300
	}

	if cl, ok := config["compressLevel"].(float64); ok {
		compressLevel = int(cl)
	} else {
		compressLevel = 2
	}

	compressParamsList := []CompressParams{
		{MaxWidth: int(cardWidth * 15), Quality: 100, MaxDpi: 300},
		{MaxWidth: int(cardWidth * 12), Quality: 90, MaxDpi: 200},
		{MaxWidth: int(cardWidth * 9), Quality: 85, MaxDpi: 150},
		{MaxWidth: int(cardWidth * 6), Quality: 80, MaxDpi: 75},
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

		params := compressParamsList[compressLevel-1]

		// 1. 先提交缩略图任务（优先处理）
		overviewTask := &ImageTask{
			ImagePath:  imagePath,
			Params:     CompressParams{MaxWidth: 100, Quality: 85},
			IsOverview: true,
			Callback:   nil, // 缩略图不需要回调
		}
		imageProcessQueue <- overviewTask

		// 2. 再提交高质量图片任务
		highQualityTask := &ImageTask{
			ImagePath:  imagePath,
			Params:     params,
			IsOverview: false,
			Callback: func(data *ImageData, err error) {
				pendingListMu.Lock()
				delete(pendingList, imagePathKey)
				pendingListMu.Unlock()

				if callback != nil {
					callback()
				}
			},
		}
		imageProcessQueue <- highQualityTask

	} else {
		pendingListMu.Unlock()
	}

	file_render.ColorCache.Delete(imagePathKey)

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

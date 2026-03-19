package file_render

import (
	"fmt"
	"log"
	"sync"

	"main/server/file_render/adapter"
)

// PreviewStorage 预览缓存
var PreviewStorage = &sync.Map{}

// previewTasks 进行中的预渲染任务
var previewTasks = &sync.Map{}

// PrerenderPage 预渲染页面
func PrerenderPage(pageIndex int, state map[string]interface{}, config map[string]interface{}, renderType string) (interface{}, error) {
	cacheKey := fmt.Sprintf("%s-%d", renderType, pageIndex)

	// 检查缓存
	if cached, ok := PreviewStorage.Load(cacheKey); ok {
		log.Printf("📦 Page %d: Loaded from cache", pageIndex+1)
		return cached, nil
	}

	// 检查是否已有任务在运行
	if task, ok := previewTasks.Load(cacheKey); ok {
		log.Printf("⏳ Page %d: Waiting for existing render task", pageIndex+1)
		return task, nil
	}

	// 创建新任务
	log.Printf("🎨 Page %d: Starting render...", pageIndex+1)

	// 创建 SVG 适配器（用于预览）
	svgAdapter := adapter.NewSVGAdapter(config, "low", true)

	// 渲染页面
	result, err := ExportFile(svgAdapter, state, []int{pageIndex})
	if err != nil {
		log.Printf("❌ Page %d: Render failed: %v", pageIndex+1, err)
		return nil, err
	}

	// 转换为 base64
	var svgString string
	switch v := result.(type) {
	case string:
		svgString = v
	case []string:
		if len(v) > 0 {
			svgString = v[0]
		}
	default:
		return nil, fmt.Errorf("unexpected result type: %T", result)
	}

	base64Result := adapter.ToBase64SVG(svgString)

	// 存入缓存
	PreviewStorage.Store(cacheKey, base64Result)
	previewTasks.Delete(cacheKey)

	log.Printf("✅ Page %d: Render completed", pageIndex+1)
	return base64Result, nil
}

// ClearPrerenderCache 清除预渲染缓存
func ClearPrerenderCache() {
	PreviewStorage = &sync.Map{}
	previewTasks = &sync.Map{}
	log.Println("🗑️ Preview cache cleared")
}

package plugins

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"main/server/file_render"
	"main/server/shared"
	"main/server/storage"
	"main/server/utils"
	"main/server/websocket"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"time"
)

var defaultPathStore *storage.SimpleStore

func init() {
	defaultPathStore = storage.NewSimpleStore("defaultPathConfig")
}

// FileItem 文件项
type FileItem struct {
	Name         string `json:"name"`
	Path         string `json:"path"`
	RealPath     string `json:"realPath"`
	SafePath     string `json:"safePath"`
	IsDirectory  bool   `json:"isDirectory"`
	Size         int64  `json:"size"`
	Modified     int64  `json:"modified"`
	Ext          string `json:"ext,omitempty"`
	IsImage      bool   `json:"isImage,omitempty"`
	URL          string `json:"url"`
	FileURL      string `json:"fileUrl"`
	ThumbnailURL string `json:"thumbnailUrl,omitempty"`
}

// DirectoryResponse 目录响应
type DirectoryResponse struct {
	Type        string     `json:"type"`
	CurrentPath string     `json:"currentPath"`
	FullPath    string     `json:"fullPath,omitempty"`
	Items       []FileItem `json:"items"`
	Parent      string     `json:"parent"`
}

// FileResponse 文件响应
type FileResponse struct {
	Type         string `json:"type"`
	Name         string `json:"name"`
	Path         string `json:"path"`
	RealPath     string `json:"realPath"`
	SafePath     string `json:"safePath"`
	Size         int64  `json:"size"`
	Modified     int64  `json:"modified"`
	URL          string `json:"url"`
	FileURL      string `json:"fileUrl"`
	ThumbnailURL string `json:"thumbnailUrl"`
}

// RegisterFileBrowserHandler 注册文件浏览器处理器
func RegisterFileBrowserHandler(wsManager *websocket.Manager) {
	wsManager.On(shared.GetDefaultPath, func(event *websocket.Event, data map[string]interface{}) {
		returnChannel, _ := data["returnChannel"].(string)

		// 直接返回路径字符串，不包装
		event.Sender.Send(returnChannel, getDefaultPath())
	})

	// 设置默认路径
	wsManager.On(shared.SetDefaultPath, func(event *websocket.Event, data map[string]interface{}) {
		returnChannel, _ := data["returnChannel"].(string)
		path, _ := data["path"].(string)

		setDefaultPath(path)

		// 直接返回 nil（表示成功）
		event.Sender.Send(returnChannel, nil)
	})

	log.Println("✅ File browser handlers registered")
}

// getDefaultPath 获取默认路径
func getDefaultPath() string {
	data := defaultPathStore.Get()
	if defaultPath, ok := data["defaultPath"].(string); ok && defaultPath != "" {
		return defaultPath
	}

	homeDir, _ := os.UserHomeDir()
	return strings.ReplaceAll(homeDir, "\\", "/")
}

// setDefaultPath 保存默认路径
func setDefaultPath(pathToSave string) error {
	return defaultPathStore.Set(map[string]interface{}{
		"defaultPath": pathToSave,
	})
}

// isHidden 判断是否为隐藏文件
func isHidden(filePath string) bool {
	fileName := filepath.Base(filePath)

	// Unix-style 隐藏文件（以 . 开头）
	if strings.HasPrefix(fileName, ".") {
		return true
	}

	// Windows 常见隐藏文件/文件夹
	if runtime.GOOS == "windows" {
		hiddenNames := []string{
			"desktop.ini",
			"thumbs.db",
			"$recycle.bin",
			"system volume information",
			"pagefile.sys",
			"hiberfil.sys",
		}

		lowerName := strings.ToLower(fileName)
		for _, hidden := range hiddenNames {
			if lowerName == hidden {
				return true
			}
		}
	}

	return false
}

// safeStat 安全的文件状态获取
func safeStat(p string) (os.FileInfo, error) {
	info, err := os.Stat(p)
	if err != nil {
		if os.IsNotExist(err) || os.IsPermission(err) {
			return nil, nil
		}
		return nil, err
	}
	return info, nil
}

// safeReaddir 安全的目录读取
func safeReaddir(p string) ([]string, error) {
	entries, err := ioutil.ReadDir(p)
	if err != nil {
		if os.IsNotExist(err) || os.IsPermission(err) {
			return []string{}, nil
		}
		return nil, err
	}

	result := []string{}
	for _, entry := range entries {
		fullPath := filepath.Join(p, entry.Name())

		// 跳过隐藏文件
		if isHidden(fullPath) {
			continue
		}

		// 尝试访问文件
		_, err := os.Stat(fullPath)
		if err != nil {
			if os.IsPermission(err) {
				continue
			}
		}

		result = append(result, entry.Name())
	}

	return result, nil
}

// formatSize 格式化文件大小
func formatSize(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}

	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}

	units := []string{"KB", "MB", "GB", "TB"}
	return fmt.Sprintf("%.1f %s", float64(b)/float64(div), units[exp])
}

// getDrives 获取所有驱动器
func getDrives() []string {
	if runtime.GOOS != "windows" {
		return []string{"/"}
	}

	drives := []string{}
	for i := 'A'; i <= 'Z'; i++ {
		drive := fmt.Sprintf("%c:\\", i)
		if info, _ := safeStat(drive); info != nil {
			drives = append(drives, string(i))
		}
	}

	return drives
}

// listDrives 列出所有驱动器
func listDrives(query map[string]string, basePath string) DirectoryResponse {
	drives := getDrives()

	items := []FileItem{}
	for _, d := range drives {
		drivePath := fmt.Sprintf("%s:", d)
		items = append(items, FileItem{
			Name:         drivePath,
			Path:         drivePath,
			URL:          fmt.Sprintf("%s/%s:/", basePath, d),
			FileURL:      fmt.Sprintf("%s/%s:/", basePath, d),
			ThumbnailURL: fmt.Sprintf("%s/%s:/", basePath, d),
			IsDirectory:  true,
		})
	}

	return DirectoryResponse{
		Type:        "directory",
		CurrentPath: "",
		Items:       items,
		Parent:      "",
	}
}

// browse 浏览指定路径
func browse(drivePath string, query map[string]string, basePath string) (interface{}, error) {
	// 解析路径 (例如: C:/path/to/file)
	re := regexp.MustCompile(`^([A-Z]):(.*)$`)
	matches := re.FindStringSubmatch(drivePath)

	if len(matches) == 0 {
		return nil, fmt.Errorf("invalid path")
	}

	drv := strings.ToUpper(matches[1])
	sub := matches[2]

	root := fmt.Sprintf("%s:\\", drv)
	if info, _ := safeStat(root); info == nil {
		return nil, fmt.Errorf("drive not found")
	}

	// 处理路径
	up := strings.ReplaceAll(sub, "\\", "/")
	if up != "" && !strings.HasPrefix(up, "/") {
		up = "/" + up
	}
	if up == "" {
		up = "/"
	}

	cur := drv + ":"
	if up != "/" {
		cur = drv + ":" + up
	}

	realPath := root
	if up != "/" {
		realPath = filepath.Join(root, strings.TrimPrefix(up, "/"))
	}

	// 获取查询参数
	sort := query["sort"]
	if sort == "" {
		sort = "name"
	}
	order := query["order"]
	if order == "" {
		order = "asc"
	}
	ext := query["ext"]

	// 检查路径
	st, err := safeStat(realPath)
	if err != nil {
		return nil, err
	}
	if st == nil {
		return nil, fmt.Errorf("not found")
	}

	// 如果是文件
	if !st.IsDir() {
		// 返回文件信息
		return FileResponse{
			Type:         "file",
			Name:         filepath.Base(realPath),
			Path:         cur,
			RealPath:     realPath,
			SafePath:     utils.FixPath(realPath),
			Size:         st.Size(),
			Modified:     st.ModTime().UnixMilli(),
			URL:          fmt.Sprintf("%s/%s", basePath, cur),
			FileURL:      fmt.Sprintf("%s/%s", basePath, cur),
			ThumbnailURL: fmt.Sprintf("%s/%s?thumbnail=true", basePath, cur),
		}, nil
	}

	// 读取目录
	files, err := safeReaddir(realPath)
	if err != nil {
		return nil, err
	}

	items := []FileItem{}
	for _, f := range files {
		fp := filepath.Join(realPath, f)
		fst, err := safeStat(fp)
		if err != nil || fst == nil {
			continue
		}

		itemPath := cur + "/" + f
		if up == "/" {
			itemPath = drv + ":/" + f
		}

		fileExt := strings.ToLower(strings.TrimPrefix(filepath.Ext(f), "."))
		isImage := regexp.MustCompile(`(?i)\.(jpg|jpeg|png|gif|bmp|webp)$`).MatchString(f)

		item := FileItem{
			Name:        f,
			Path:        itemPath,
			RealPath:    fp,
			SafePath:    utils.FixPath(fp),
			IsDirectory: fst.IsDir(),
			Size:        fst.Size(),
			Modified:    fst.ModTime().UnixMilli(),
			Ext:         fileExt,
			IsImage:     isImage,
		}

		if item.IsDirectory {
			item.URL = fmt.Sprintf("%s/%s/", basePath, itemPath)
			item.FileURL = fmt.Sprintf("%s/%s/", basePath, itemPath)
		} else {
			item.URL = fmt.Sprintf("%s/%s", basePath, itemPath)
			item.FileURL = fmt.Sprintf("%s/%s", basePath, itemPath)
		}

		if isImage {
			item.ThumbnailURL = fmt.Sprintf("%s/%s?thumbnail=true", basePath, itemPath)
		}

		items = append(items, item)
	}

	// 过滤扩展名
	if ext != "" {
		exts := strings.Split(strings.ToLower(ext), ",")
		filtered := []FileItem{}
		for _, item := range items {
			if item.IsDirectory {
				filtered = append(filtered, item)
				continue
			}

			for _, e := range exts {
				if item.Ext == strings.TrimSpace(e) {
					filtered = append(filtered, item)
					break
				}
			}
		}
		items = filtered
	}

	// 排序
	sortItems(items, sort, order)

	// 计算父路径
	parent := basePath
	if up != "/" {
		parentPath := filepath.Dir(up)
		if parentPath == "." || parentPath == "/" {
			parent = basePath
		} else {
			parent = fmt.Sprintf("%s/%s:%s", basePath, drv, parentPath)
		}
	}

	return DirectoryResponse{
		Type:        "directory",
		CurrentPath: cur,
		FullPath:    realPath,
		Items:       items,
		Parent:      parent,
	}, nil
}

// sortItems 排序文件列表
func sortItems(items []FileItem, sortBy, order string) {
	sort.Slice(items, func(i, j int) bool {
		// 目录优先
		if items[i].IsDirectory != items[j].IsDirectory {
			return items[i].IsDirectory
		}

		var result int
		switch sortBy {
		case "size":
			result = int(items[i].Size - items[j].Size)
		case "modified":
			result = int(items[i].Modified - items[j].Modified)
		default: // name
			result = naturalCompare(items[i].Name, items[j].Name)
		}

		if order == "desc" {
			return result > 0
		}
		return result < 0
	})
}

// naturalCompare 自然排序比较
func naturalCompare(a, b string) int {
	return strings.Compare(strings.ToLower(a), strings.ToLower(b))
}

// RegisterFileBrowserRoutes 注册文件浏览器路由
func RegisterFileBrowserRoutes(mux *http.ServeMux, basePath string) {
	if basePath == "" {
		basePath = "/browse"
	}
	// 新增：注册图片内容获取 endpoint
	mux.HandleFunc("/api/get-image-content", handleGetImageContent)

	// 列出所有驱动器
	mux.HandleFunc(basePath, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != basePath && r.URL.Path != basePath+"/" {
			return
		}
		handleListDrives(w, r, basePath)
	})

	// 浏览文件/目录
	pattern := basePath + "/"
	mux.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request) {
		handleBrowse(w, r, basePath)
	})

	log.Printf("✅ File browser routes registered at %s", basePath)
}

// handleListDrives 处理列出驱动器
func handleListDrives(w http.ResponseWriter, r *http.Request, basePath string) {
	query := parseQuery(r)
	response := listDrives(query, basePath)

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// handleBrowse 处理浏览文件/目录
func handleBrowse(w http.ResponseWriter, r *http.Request, basePath string) {
	// 提取路径
	path := strings.TrimPrefix(r.URL.Path, basePath+"/")
	path = strings.TrimSuffix(path, "/")

	if path == "" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	query := parseQuery(r)

	result, err := browse(path, query, basePath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	// 检查是否是缩略图请求
	if resultMap, ok := result.(map[string]interface{}); ok {
		if resultMap["type"] == "thumbnail" {
			handleThumbnail(w, r, resultMap["path"].(string))
			return
		}
	}

	// 检查是否是文件响应
	if fileResp, ok := result.(FileResponse); ok {
		// 如果请求缩略图，重定向到新 API
		if query["thumbnail"] == "true" {
			newURL := fmt.Sprintf("/api/get-image-content?path=%s&quality=low",
				url.QueryEscape(fileResp.RealPath))
			http.Redirect(w, r, newURL, http.StatusMovedPermanently)
			return
		}
		// 返回文件内容
		http.ServeFile(w, r, fileResp.RealPath)
		return
	}

	// 返回 JSON 响应
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(result); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// 修改 handleThumbnail 函数，直接调用图片获取逻辑
func handleThumbnail(w http.ResponseWriter, r *http.Request, imagePath string) {
	// 直接调用图片获取逻辑，不需要修改 request
	getImageContentByPath(w, imagePath, "low")
}

// 提取公共逻辑到独立函数
func getImageContentByPath(w http.ResponseWriter, path string, quality string) {
	if quality == "" {
		quality = "low"
	}

	// 生成缓存键
	imagePathKey := strings.ReplaceAll(path, "\\", "")
	var content interface{}

	// 根据质量获取图片
	if quality == "high" {
		content = file_render.ImageStorage.Get(imagePathKey)

		// 如果缓存中没有，尝试加载
		if content == nil {
			pathToImageData(path, nil)

			// 等待加载完成（最多10秒）
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
				http.Error(w, "Image loading timeout", http.StatusRequestTimeout)
				return
			}
		}
	} else {
		// 低质量图片：先从缓存获取
		content = file_render.OverviewStorage.Get(imagePathKey)

		if content == nil {
			// 改为异步处理
			pathToImageData(path, nil)

			// 等待 1 秒（缩略图应该很快）
			success := shared.WaitCondition(
				func() bool {
					content = file_render.OverviewStorage.Get(imagePathKey)
					return content != nil
				},
				50*time.Millisecond,
				1*time.Second,
			)

			if !success {
				// 返回占位图或错误
				http.Error(w, "Thumbnail not ready", http.StatusAccepted)
				return
			}
		}
	}

	if content == nil {
		http.Error(w, "Image not found", http.StatusNotFound)
		return
	}

	// 转换为字符串
	var imageData string
	if str, ok := content.(string); ok {
		imageData = str
	} else {
		http.Error(w, "Invalid image data format", http.StatusInternalServerError)
		return
	}

	// 解码 base64
	base64Data := regexp.MustCompile(`^data:image/\w+;base64,`).ReplaceAllString(imageData, "")
	buffer, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		log.Printf("Failed to decode base64: %v", err)
		http.Error(w, "Failed to decode image", http.StatusInternalServerError)
		return
	}

	// 确定 MIME 类型
	ext := strings.ToLower(filepath.Ext(path))
	mimeTypes := map[string]string{
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".png":  "image/png",
		".gif":  "image/gif",
		".webp": "image/webp",
		".bmp":  "image/bmp",
	}

	mimeType := mimeTypes[ext]
	if mimeType == "" {
		mimeType = "image/png"
	}

	// 设置响应头
	w.Header().Set("Content-Type", mimeType)
	w.Header().Set("Cache-Control", "public, max-age=31536000")
	w.Write(buffer)
}

// handleGetImageContent 处理 HTTP 请求
func handleGetImageContent(w http.ResponseWriter, r *http.Request) {
	log.Printf("✅ handleGetImageContent")
	// 获取查询参数
	path := r.URL.Query().Get("path")
	quality := r.URL.Query().Get("quality")

	if path == "" {
		http.Error(w, "Missing path parameter", http.StatusBadRequest)
		return
	}

	// 调用公共逻辑
	getImageContentByPath(w, path, quality)
}

// parseQuery 解析查询参数
func parseQuery(r *http.Request) map[string]string {
	query := make(map[string]string)
	for key, values := range r.URL.Query() {
		if len(values) > 0 {
			query[key] = values[0]
		}
	}
	return query
}

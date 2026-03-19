package shared

// eleActions - 所有操作常量
const (
	// Project 相关
	OpenProject = "open-project"
	SaveProject = "save-project"

	// Image 相关
	OpenImage        = "open-image"
	CheckImage       = "check-image"
	LoadImageList    = "load-image-list"
	GetImagePath     = "get-image-path"
	GetImageContent  = "get-image-content"
	ReloadLocalImage = "reload-local-image"

	// Config 相关
	LoadConfig      = "load-config"
	SaveConfig      = "save-config"
	LoadPrintConfig = "load-print-config"
	SavePrintConfig = "save-print-config"

	// Export 相关
	GetExportPageCount = "get-export-page-count"
	GetExportPreview   = "get-export-preview"
	ClearPreviewCache  = "clear-preview-cache"
	ExportFile         = "export-file"

	// Print 相关
	GetPrinters      = "get-printers"
	AdjustGuidePrint = "adjust-guide-print"
	PrintPages       = "print-pages"

	// Template 相关
	GetTemplate    = "get-template"
	SetTemplate    = "set-template"
	EditTemplate   = "edit-template"
	DeleteTemplate = "delete-template"

	// Other
	Version = "version"

	GetDefaultPath = "get-default-path"
	SetDefaultPath = "set-default-path"
)

// layoutSides - 布局方式
const (
	OneSide     = "one side"
	DoubleSides = "double sides"
	Brochure    = "brochure"
	FoldInHalf  = "fold in half"
)

// flipWay - 翻转方式
const (
	FlipNone         = "none"
	LongEdgeBinding  = "long-edge binding"
	ShortEdgeBinding = "short-edge binding"
)

// exportType - 导出类型
const (
	ExportPDF = "pdf"
	ExportPNG = "png"
	ExportSVG = "svg"
	ExportZIP = "zip"
)

// EmptyImg - 空图片
const EmptyImg = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEV/f3+QyhsjAAAACklEQVQI\n12NgAAAAAgAB4iG8MwAAAABJRU5ErkJggg=="

// InitialState - 初始状态
func GetInitialState() map[string]interface{} {
	return map[string]interface{}{
		"Global": map[string]interface{}{
			"availableLangs":     []string{},
			"currentLang":        "zh",
			"isLoading":          false,
			"loadingText":        "",
			"isInProgress":       false,
			"progress":           0,
			"lastSelection":      nil,
			"isBackEditing":      false,
			"isShowOverView":     true,
			"selections":         []interface{}{},
			"currentView":        "edit",
			"exportPageCount":    0,
			"exportPreviewIndex": 1,
			"imageVersion":       1,
		},
		"Config": map[string]interface{}{
			"pageSize":              "A4:210,297",
			"pageWidth":             210,
			"pageHeight":            297,
			"offsetX":               0,
			"offsetY":               0,
			"landscape":             true,
			"sides":                 DoubleSides,
			"autoConfigFlip":        false,
			"flip":                  LongEdgeBinding,
			"cardWidth":             63,
			"cardHeight":            88,
			"compressLevel":         2,
			"marginX":               3,
			"marginY":               3,
			"foldInHalfMargin":      0,
			"bleedX":                1,
			"bleedY":                1,
			"columns":               4,
			"rows":                  2,
			"autoColumnsRows":       true,
			"fCutLine":              "1",
			"bCutLine":              "1",
			"lineWeight":            0.5,
			"cutlineColor":          "#000000",
			"foldLineType":          "0",
			"globalBackground":      nil,
			"marginFilling":         false,
			"avoidDislocation":      false,
			"brochureRepeatPerPage": false,
		},
		"CardList": []interface{}{},
	}
}

// GetEmptyImgData - 获取空图片数据
func GetEmptyImgData() map[string]interface{} {
	return map[string]interface{}{
		"path": EmptyImg,
		"ext":  "png",
	}
}

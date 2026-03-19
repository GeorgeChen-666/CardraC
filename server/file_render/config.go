package file_render

// Config 渲染配置（基于 stateSchema）
type Config struct {
    // 页面设置
    PageSize   string  `json:"pageSize"`   // 页面尺寸，如 "A4:210,297"
    PageWidth  float64 `json:"pageWidth"`  // 页面宽度（mm）
    PageHeight float64 `json:"pageHeight"` // 页面高度（mm）
    OffsetX    float64 `json:"offsetX"`    // X 偏移
    OffsetY    float64 `json:"offsetY"`    // Y 偏移
    Landscape  bool    `json:"landscape"`  // 是否横向

    // 打印方式
    Sides          string `json:"sides"`          // 打印方式：one side, double sides, fold in half, brochure
    AutoConfigFlip bool   `json:"autoConfigFlip"` // 自动配置翻转
    Flip           string `json:"flip"`           // 翻转方式：long-edge binding, short-edge binding

    // 卡片尺寸
    CardWidth  float64 `json:"cardWidth"`  // 卡片宽度（mm）
    CardHeight float64 `json:"cardHeight"` // 卡片高度（mm）

    // 压缩级别
    CompressLevel int `json:"compressLevel"` // 压缩级别 0-4

    // 边距和出血
    MarginX         float64 `json:"marginX"`         // X 方向边距
    MarginY         float64 `json:"marginY"`         // Y 方向边距
    FoldInHalfMargin float64 `json:"foldInHalfMargin"` // 对折边距
    BleedX          float64 `json:"bleedX"`          // X 方向出血
    BleedY          float64 `json:"bleedY"`          // Y 方向出血

    // 行列设置
    Columns        int  `json:"columns"`        // 列数
    Rows           int  `json:"rows"`           // 行数
    AutoColumnsRows bool `json:"autoColumnsRows"` // 自动计算行列

    // 裁切线设置
    FCutLine     string  `json:"fCutLine"`     // 正面裁切线：1, 2, 3
    BCutLine     string  `json:"bCutLine"`     // 背面裁切线：1, 2, 3
    LineWeight   float64 `json:"lineWeight"`   // 线条粗细
    CutlineColor string  `json:"cutlineColor"` // 裁切线颜色
    FoldLineType string  `json:"foldLineType"` // 折叠线类型：0, 1

    // 其他设置
    GlobalBackground      interface{} `json:"globalBackground,omitempty"`      // 全局背景
    MarginFilling         bool        `json:"marginFilling,omitempty"`         // 边距填充
    AvoidDislocation      bool        `json:"avoidDislocation,omitempty"`      // 避免错位
    BrochureRepeatPerPage bool        `json:"brochureRepeatPerPage,omitempty"` // 小册子每页重复
    PageNumber            bool        `json:"pageNumber,omitempty"`            // 页码
}

// GlobalConfig 全局配置
type GlobalConfig struct {
    CurrentLang    string                 `json:"currentLang"`              // 当前语言
    IsShowOverView bool                   `json:"isShowOverView"`           // 是否显示概览
    AvailableLangs []string               `json:"availableLangs,omitempty"` // 可用语言列表
    IsLoading      bool                   `json:"isLoading,omitempty"`      // 是否加载中
    LoadingText    string                 `json:"loadingText,omitempty"`    // 加载文本
    IsInProgress   bool                   `json:"isInProgress,omitempty"`   // 是否进行中
    Progress       float64                `json:"progress,omitempty"`       // 进度
    LastSelection  interface{}            `json:"lastSelection,omitempty"`  // 最后选择
    IsBackEditing  bool                   `json:"isBackEditing,omitempty"`  // 是否编辑背面
    Selections     []interface{}          `json:"selections,omitempty"`     // 选择列表
    Locales        map[string]interface{} `json:"locales,omitempty"`        // 语言包
}

// State 完整状态
type State struct {
    Global   GlobalConfig         `json:"Global,omitempty"`
    Config   Config               `json:"Config"`
    CardList []map[string]interface{} `json:"CardList,omitempty"`
}

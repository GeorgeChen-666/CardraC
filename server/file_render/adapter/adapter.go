package adapter

// Transform 变换矩阵
type Transform struct {
    A float64 `json:"a"`
    B float64 `json:"b"`
    C float64 `json:"c"`
    D float64 `json:"d"`
    E float64 `json:"e"`
    F float64 `json:"f"`
}

// TextOptions 文本选项
type TextOptions struct {
    Text string  `json:"text"`
    X    float64 `json:"x"`
    Y    float64 `json:"y"`
    Size float64 `json:"size"`
}

// LineStyle 线条样式
type LineStyle struct {
    Width float64 `json:"width"`
    Color string  `json:"color"`
}

// LineOptions 线条选项
type LineOptions struct {
    X1   float64   `json:"x1"`
    Y1   float64   `json:"y1"`
    X2   float64   `json:"x2"`
    Y2   float64   `json:"y2"`
    Dash []float64 `json:"dash,omitempty"`
}

// RectOptions 矩形选项
type RectOptions struct {
    X      float64  `json:"x"`
    Y      float64  `json:"y"`
    Width  float64  `json:"width"`
    Height float64  `json:"height"`
    Color  RGBColor `json:"color"`
}

// RGBColor RGB 颜色
type RGBColor struct {
    R int `json:"r"`
    G int `json:"g"`
    B int `json:"b"`
}

// ImageData 图片数据
type ImageData struct {
    Base64 string `json:"base64"`
    Ext    string `json:"ext"`
    Path   string `json:"path"`
}

// ImageOptions 图片选项
type ImageOptions struct {
    Data     ImageData `json:"data"`
    X        float64   `json:"x"`
    Y        float64   `json:"y"`
    Width    float64   `json:"width"`
    Height   float64   `json:"height"`
    Rotation float64   `json:"rotation"`
}

// PageSize 页面尺寸
type PageSize struct {
    Width  float64 `json:"width"`
    Height float64 `json:"height"`
}

// IAdapter 适配器接口
type IAdapter interface {
    // AddPage 添加新页面
    AddPage() error

    // SaveState 保存状态
    SaveState() error

    // RestoreState 恢复状态
    RestoreState() error

    // SetTransform 设置变换矩阵
    SetTransform(transform Transform) error

    // DrawText 绘制文本
    DrawText(options TextOptions) error

    // SetLineStyle 设置线条样式
    SetLineStyle(style LineStyle) error

    // DrawLine 绘制线条
    DrawLine(options LineOptions) error

    // FillRect 填充矩形
    FillRect(options RectOptions) error

    // DrawImage 绘制图片
    DrawImage(options ImageOptions) error

    // GetPageSize 获取页面尺寸
    GetPageSize() PageSize

    // Finalize 完成并返回结果
    Finalize() (interface{}, error)
}

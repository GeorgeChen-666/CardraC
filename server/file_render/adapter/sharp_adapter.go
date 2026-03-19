package adapter

import (
    "bytes"
    "encoding/base64"
    "fmt"
    "image"
    "image/color"
    "image/png"
    "strings"
    "sync"

    "github.com/disintegration/imaging"
    "github.com/fogleman/gg"
)

// SharpAdapter 图片渲染适配器
type SharpAdapter struct {
    config           map[string]interface{}
    pages            []SharpPage
    currentPageIndex int
    currentPage      *SharpPage
    renderingTasks   []func() error
    pageWidth        int
    pageHeight       int
    renderWidth      int
    renderHeight     int
    scaleFactor      int
    currentLineWidth float64
    currentLineColor string
}

// SharpPage Sharp 页面
type SharpPage struct {
    Index          int
    Width          int
    Height         int
    Background     image.Image
    DrawCommands   []func() (*DrawCommand, error)
    IsRendering    bool
    RenderPromise  chan error
    Buffer         []byte
}

// DrawCommand 绘制命令结果
type DrawCommand struct {
    Image image.Image
    X     int
    Y     int
}

// QualitySettings 质量设置
type QualitySettings struct {
    ScaleFactor int
    Filter      imaging.ResampleFilter
}

// NewSharpAdapter 创建 Sharp 适配器
func NewSharpAdapter(config map[string]interface{}, quality string) *SharpAdapter {
    landscape, _ := config["landscape"].(bool)
    pageWidth, _ := config["pageWidth"].(float64)
    pageHeight, _ := config["pageHeight"].(float64)

    width := int(pageWidth)
    height := int(pageHeight)

    if landscape {
        width, height = height, width
    }

    // 质量设置
    qualityMap := map[string]QualitySettings{
        "high": {
            ScaleFactor: 9,
            Filter:      imaging.Lanczos,
        },
        "medium": {
            ScaleFactor: 6,
            Filter:      imaging.Lanczos,
        },
        "low": {
            ScaleFactor: 3,
            Filter:      imaging.Box,
        },
    }

    settings, ok := qualityMap[quality]
    if !ok {
        settings = qualityMap["high"]
    }

    adapter := &SharpAdapter{
        config:           config,
        pages:            []SharpPage{},
        currentPageIndex: -1,
        renderingTasks:   []func() error{},
        pageWidth:        width,
        pageHeight:       height,
        renderWidth:      width * settings.ScaleFactor,
        renderHeight:     height * settings.ScaleFactor,
        scaleFactor:      settings.ScaleFactor,
    }

    adapter.createNewPage()
    return adapter
}

// createNewPage 创建新页面
func (s *SharpAdapter) createNewPage() {
    s.currentPageIndex++

    s.currentPage = &SharpPage{
        Index:        s.currentPageIndex,
        Width:        s.renderWidth,
        Height:       s.renderHeight,
        DrawCommands: []func() (*DrawCommand, error){},
        IsRendering:  false,
    }

    s.pages = append(s.pages, *s.currentPage)
    s.initBackground(s.currentPage)
}

// initBackground 初始化背景
func (s *SharpAdapter) initBackground(page *SharpPage) {
    // 创建白色背景
    bg := image.NewRGBA(image.Rect(0, 0, page.Width, page.Height))
    white := color.RGBA{255, 255, 255, 255}
    for y := 0; y < page.Height; y++ {
        for x := 0; x < page.Width; x++ {
            bg.Set(x, y, white)
        }
    }
    page.Background = bg
}

// AddPage 添加新页面
func (s *SharpAdapter) AddPage() error {
    s.startPageRendering(s.currentPage)
    s.createNewPage()
    return nil
}

// scale 缩放值
func (s *SharpAdapter) scale(value float64) int {
    return int(value * float64(s.scaleFactor))
}

// SaveState 保存状态
func (s *SharpAdapter) SaveState() error {
    return nil
}

// RestoreState 恢复状态
func (s *SharpAdapter) RestoreState() error {
    return nil
}

// SetTransform 设置变换
func (s *SharpAdapter) SetTransform(transform Transform) error {
    return nil
}

// DrawText 绘制文本
func (s *SharpAdapter) DrawText(options TextOptions) error {
    s.currentPage.DrawCommands = append(s.currentPage.DrawCommands, func() (*DrawCommand, error) {
        return s.createTextLayer(options.Text, options.X, options.Y, options.Size)
    })
    return nil
}

// SetLineStyle 设置线条样式
func (s *SharpAdapter) SetLineStyle(style LineStyle) error {
    s.currentLineWidth = style.Width
    s.currentLineColor = style.Color
    return nil
}

// DrawLine 绘制线条
func (s *SharpAdapter) DrawLine(options LineOptions) error {
    lineWidth := s.currentLineWidth
    lineColor := s.currentLineColor

    s.currentPage.DrawCommands = append(s.currentPage.DrawCommands, func() (*DrawCommand, error) {
        return s.createLineLayer(options.X1, options.Y1, options.X2, options.Y2, lineWidth, lineColor, options.Dash)
    })
    return nil
}

// FillRect 填充矩形
func (s *SharpAdapter) FillRect(options RectOptions) error {
    s.currentPage.DrawCommands = append(s.currentPage.DrawCommands, func() (*DrawCommand, error) {
        return s.createRectLayer(options.X, options.Y, options.Width, options.Height, options.Color)
    })
    return nil
}

// DrawImage 绘制图片
func (s *SharpAdapter) DrawImage(options ImageOptions) error {
    s.currentPage.DrawCommands = append(s.currentPage.DrawCommands, func() (*DrawCommand, error) {
        return s.createImageLayer(options.Data, options.X, options.Y, options.Width, options.Height, options.Rotation)
    })
    return nil
}

// GetPageSize 获取页面尺寸
func (s *SharpAdapter) GetPageSize() PageSize {
    return PageSize{
        Width:  float64(s.pageWidth),
        Height: float64(s.pageHeight),
    }
}

// createImageLayer 创建图片层
func (s *SharpAdapter) createImageLayer(data ImageData, x, y, width, height, rotation float64) (*DrawCommand, error) {
    var img image.Image

    // 解码图片
    if data.Base64 != "" {
        base64Str := data.Base64
        if strings.Contains(base64Str, "base64,") {
            parts := strings.Split(base64Str, "base64,")
            if len(parts) > 1 {
                base64Str = parts[1]
            }
        }

        imageData, err := base64.StdEncoding.DecodeString(base64Str)
        if err != nil {
            return nil, err
        }

        img, _, err = image.Decode(bytes.NewReader(imageData))
        if err != nil {
            return nil, err
        }
    } else {
        // 如果没有 base64 数据，返回 nil
        return nil, nil
    }

    // 缩放图片
    scaledWidth := s.scale(width)
    scaledHeight := s.scale(height)
    img = imaging.Resize(img, scaledWidth, scaledHeight, imaging.Lanczos)

    // 旋转
    adjustedX := x
    adjustedY := y

    if rotation == 180 {
        adjustedX = x - width
        adjustedY = y + height
        img = imaging.Rotate180(img)
    }

    return &DrawCommand{
        Image: img,
        X:     s.scale(adjustedX),
        Y:     s.scale(adjustedY),
    }, nil
}


// createRectLayer 创建矩形层
func (s *SharpAdapter) createRectLayer(x, y, width, height float64, col RGBColor) (*DrawCommand, error) {
    scaledWidth := s.scale(width)
    scaledHeight := s.scale(height)

    rect := image.NewRGBA(image.Rect(0, 0, scaledWidth, scaledHeight))
    fillColor := color.RGBA{uint8(col.R), uint8(col.G), uint8(col.B), 255}

    for py := 0; py < scaledHeight; py++ {
        for px := 0; px < scaledWidth; px++ {
            rect.Set(px, py, fillColor)
        }
    }

    return &DrawCommand{
        Image: rect,
        X:     s.scale(x),
        Y:     s.scale(y),
    }, nil
}

// createLineLayer 创建线条层
func (s *SharpAdapter) createLineLayer(x1, y1, x2, y2, lineWidth float64, lineColor string, dash []float64) (*DrawCommand, error) {
    sx1 := s.scale(x1)
    sy1 := s.scale(y1)
    sx2 := s.scale(x2)
    sy2 := s.scale(y2)
    sLineWidth := s.scale(lineWidth)

    minX := min(sx1, sx2)
    minY := min(sy1, sy2)
    maxX := max(sx1, sx2)
    maxY := max(sy1, sy2)

    boxWidth := max(maxX-minX, 1)
    boxHeight := max(maxY-minY, 1)

    dc := gg.NewContext(boxWidth, boxHeight)
    dc.SetLineWidth(float64(sLineWidth))

    // 解析颜色
    col := parseColor(lineColor)
    dc.SetRGB(float64(col.R)/255, float64(col.G)/255, float64(col.B)/255)

    // 绘制线条
    dc.DrawLine(float64(sx1-minX), float64(sy1-minY), float64(sx2-minX), float64(sy2-minY))
    dc.Stroke()

    return &DrawCommand{
        Image: dc.Image(),
        X:     minX,
        Y:     minY,
    }, nil
}

// createTextLayer 创建文本层
func (s *SharpAdapter) createTextLayer(text string, x, y, size float64) (*DrawCommand, error) {
    dc := gg.NewContext(s.renderWidth, s.renderHeight)
    dc.SetRGB(0, 0, 0)

    fontSize := float64(s.scale(size)) * 0.3  // ← 改为 float64
    if err := dc.LoadFontFace("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", fontSize); err != nil {
        // 如果加载字体失败，使用默认字体
        dc.SetFontFace(nil)
    }

    dc.DrawString(text, float64(s.scale(x)), float64(s.scale(y)))

    return &DrawCommand{
        Image: dc.Image(),
        X:     0,
        Y:     0,
    }, nil
}


// startPageRendering 开始页面渲染
func (s *SharpAdapter) startPageRendering(page *SharpPage) {
    if page.IsRendering || page.RenderPromise != nil {
        return
    }

    page.IsRendering = true
    page.RenderPromise = make(chan error, 1)

    renderTask := func() error {
        defer func() {
            page.IsRendering = false
            close(page.RenderPromise)
        }()

        // 从背景开始 - 转换为 NRGBA
        result := imaging.Clone(page.Background)  // ← 使用 Clone

        // 按顺序执行绘制命令
        for _, cmd := range page.DrawCommands {
            drawCmd, err := cmd()
            if err != nil {
                return err
            }

            if drawCmd != nil {
                // 合成图层
                result = imaging.Overlay(result, drawCmd.Image, image.Pt(drawCmd.X, drawCmd.Y), 1.0)
            }
        }

        // 编码为 PNG
        var buf bytes.Buffer
        if err := png.Encode(&buf, result); err != nil {
            return err
        }

        page.Buffer = buf.Bytes()
        return nil
    }

    s.renderingTasks = append(s.renderingTasks, renderTask)
    go func() {
        err := renderTask()
        if err != nil {
            page.RenderPromise <- err
        }
    }()
}


// Finalize 完成并返回结果
func (s *SharpAdapter) Finalize() (interface{}, error) {
    // 启动所有未渲染的页面
    for i := range s.pages {
        if !s.pages[i].IsRendering && s.pages[i].RenderPromise == nil {
            s.startPageRendering(&s.pages[i])
        }
    }

    // 等待所有渲染任务完成
    var wg sync.WaitGroup
    for i := range s.pages {
        if s.pages[i].RenderPromise != nil {
            wg.Add(1)
            go func(idx int) {
                defer wg.Done()
                <-s.pages[idx].RenderPromise
            }(i)
        }
    }
    wg.Wait()

    // 收集有效页面
    validPages := [][]byte{}
    for _, page := range s.pages {
        if page.Buffer != nil {
            validPages = append(validPages, page.Buffer)
        }
    }

    if len(validPages) == 0 {
        return nil, fmt.Errorf("no pages to export")
    }

    if len(validPages) == 1 {
        return validPages[0], nil
    }

    return validPages, nil
}

func min(a, b int) int {
    if a < b {
        return a
    }
    return b
}

func max(a, b int) int {
    if a > b {
        return a
    }
    return b
}

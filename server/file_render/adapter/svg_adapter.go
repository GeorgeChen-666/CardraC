package adapter

import (
    "encoding/base64"
    "fmt"
    "strings"
)

const displayScale = 10

// SVGAdapter SVG 适配器
type SVGAdapter struct {
    config           map[string]interface{}
    useAppLinks      bool
    imageQuality     string
    pages            []SVGPage
    currentPageIndex int
    currentPage      *SVGPage
    transformStack   []Transform
    currentTransform Transform
    pageWidth        float64
    pageHeight       float64
    currentLineWidth float64
    currentLineColor string
}

// SVGPage SVG 页面
type SVGPage struct {
    Index    int          `json:"index"`
    Elements []SVGElement `json:"elements"`
}

// SVGElement SVG 元素
type SVGElement struct {
    Type     string                 `json:"type"`
    Data     map[string]interface{} `json:"data"`
    X        float64                `json:"x,omitempty"`
    Y        float64                `json:"y,omitempty"`
    Width    float64                `json:"width,omitempty"`
    Height   float64                `json:"height,omitempty"`
    Rotation float64                `json:"rotation,omitempty"`
}

// NewSVGAdapter 创建 SVG 适配器
func NewSVGAdapter(config map[string]interface{}, quality string, useAppLinks bool) *SVGAdapter {
    landscape, _ := config["landscape"].(bool)
    pageWidth, _ := config["pageWidth"].(float64)
    pageHeight, _ := config["pageHeight"].(float64)

    width := pageWidth
    height := pageHeight

    if landscape {
        width, height = height, width
    }

    adapter := &SVGAdapter{
        config:       config,
        useAppLinks:  useAppLinks,
        imageQuality: quality,
        pages:        []SVGPage{},
        currentPageIndex: -1,
        transformStack: []Transform{},
        currentTransform: Transform{A: 1, B: 0, C: 0, D: 1, E: 0, F: 0},
        pageWidth:    width,
        pageHeight:   height,
    }

    adapter.createNewPage()
    return adapter
}

// createNewPage 创建新页面
func (s *SVGAdapter) createNewPage() {
    s.currentPageIndex++
    s.currentPage = &SVGPage{
        Index:    s.currentPageIndex,
        Elements: []SVGElement{},
    }
    s.pages = append(s.pages, *s.currentPage)
}

// AddPage 添加新页面
func (s *SVGAdapter) AddPage() error {
    s.createNewPage()
    return nil
}

// GetPageSize 获取页面尺寸
func (s *SVGAdapter) GetPageSize() PageSize {
    return PageSize{
        Width:  s.pageWidth,
        Height: s.pageHeight,
    }
}

// SetTransform 设置变换
func (s *SVGAdapter) SetTransform(transform Transform) error {
    s.currentTransform = transform
    return nil
}

// SaveState 保存状态
func (s *SVGAdapter) SaveState() error {
    s.transformStack = append(s.transformStack, s.currentTransform)
    return nil
}

// RestoreState 恢复状态
func (s *SVGAdapter) RestoreState() error {
    if len(s.transformStack) > 0 {
        s.currentTransform = s.transformStack[len(s.transformStack)-1]
        s.transformStack = s.transformStack[:len(s.transformStack)-1]
    }
    return nil
}

// applyTransform 应用变换
func (s *SVGAdapter) applyTransform(x, y float64) (float64, float64) {
    t := s.currentTransform
    newX := t.A*x + t.C*y + t.E
    newY := t.B*x + t.D*y + t.F
    return newX, newY
}

// SetLineStyle 设置线条样式
func (s *SVGAdapter) SetLineStyle(style LineStyle) error {
    s.currentLineWidth = style.Width
    s.currentLineColor = style.Color
    return nil
}

// DrawImage 绘制图片
func (s *SVGAdapter) DrawImage(options ImageOptions) error {
    // 构建图片源
    imagePathKey := strings.ReplaceAll(options.Data.Path, "\\", "")
    var imageSource string

    if s.useAppLinks {
        quality := "low"
        if s.imageQuality == "high" {
            quality = "high"
        }
        imageSource = fmt.Sprintf("cardrac://image/%s?quality=%s", imagePathKey, quality)
    } else {
        // 使用 base64 数据
        imageSource = options.Data.Base64
    }

    adjustedX := options.X
    adjustedY := options.Y

    if options.Rotation == 180 {
        adjustedX = options.X - options.Width
        adjustedY = options.Y + options.Height
    }

    transformedX, transformedY := s.applyTransform(adjustedX, adjustedY)

    s.currentPage.Elements = append(s.currentPage.Elements, SVGElement{
        Type:     "image",
        X:        transformedX,
        Y:        transformedY,
        Width:    options.Width,
        Height:   options.Height,
        Rotation: options.Rotation,
        Data: map[string]interface{}{
            "href": imageSource,
            "path": options.Data.Path,
        },
    })

    return nil
}

// DrawText 绘制文本
func (s *SVGAdapter) DrawText(options TextOptions) error {
    transformedX, transformedY := s.applyTransform(options.X, options.Y)

    s.currentPage.Elements = append(s.currentPage.Elements, SVGElement{
        Type: "text",
        X:    transformedX,
        Y:    transformedY,
        Data: map[string]interface{}{
            "text": options.Text,
            "size": options.Size / 2.5, // 调整字体大小
        },
    })

    return nil
}

// DrawLine 绘制线条
func (s *SVGAdapter) DrawLine(options LineOptions) error {
    x1, y1 := s.applyTransform(options.X1, options.Y1)
    x2, y2 := s.applyTransform(options.X2, options.Y2)

    s.currentPage.Elements = append(s.currentPage.Elements, SVGElement{
        Type: "line",
        Data: map[string]interface{}{
            "x1":    x1,
            "y1":    y1,
            "x2":    x2,
            "y2":    y2,
            "dash":  options.Dash,
            "width": s.currentLineWidth,
            "color": s.currentLineColor,
        },
    })

    return nil
}

// FillRect 填充矩形
func (s *SVGAdapter) FillRect(options RectOptions) error {
    transformedX, transformedY := s.applyTransform(options.X, options.Y)

    s.currentPage.Elements = append(s.currentPage.Elements, SVGElement{
        Type:   "rect",
        X:      transformedX,
        Y:      transformedY,
        Width:  options.Width,
        Height: options.Height,
        Data: map[string]interface{}{
            "color": options.Color,
        },
    })

    return nil
}

// Finalize 完成并生成 SVG
func (s *SVGAdapter) Finalize() (interface{}, error) {
    validPages := []SVGPage{}
    for _, page := range s.pages {
        if len(page.Elements) > 0 {
            validPages = append(validPages, page)
        }
    }

    if len(validPages) == 0 {
        return s.generateEmptySVG(), nil
    }

    if len(validPages) == 1 {
        return s.generatePageSVG(&validPages[0]), nil
    }

    svgs := []string{}
    for i := range validPages {
        svgs = append(svgs, s.generatePageSVG(&validPages[i]))
    }
    return svgs, nil
}

// generatePageSVG 生成页面 SVG
func (s *SVGAdapter) generatePageSVG(page *SVGPage) string {
    width := s.pageWidth * displayScale
    height := s.pageHeight * displayScale

    var elements strings.Builder
    for _, el := range page.Elements {
        elements.WriteString(s.renderElement(el))
        elements.WriteString("\n")
    }

    svg := fmt.Sprintf(`<svg width="%.2f" height="%.2f" viewBox="0 0 %.2f %.2f" xmlns="http://www.w3.org/2000/svg">
<rect width="%.2f" height="%.2f" fill="white"/>
%s
</svg>`, width, height, width, height, width, height, elements.String())

    return svg
}

// generateEmptySVG 生成空 SVG
func (s *SVGAdapter) generateEmptySVG() string {
    width := s.pageWidth * 10
    height := s.pageHeight * 10

    return fmt.Sprintf(`<svg width="%.2f" height="%.2f" viewBox="0 0 %.2f %.2f" xmlns="http://www.w3.org/2000/svg">
<rect width="%.2f" height="%.2f" fill="white"/>
<text x="%.2f" y="%.2f" text-anchor="middle" font-size="48" fill="#999">No content to display</text>
</svg>`, width, height, width, height, width, height, width/2, height/2)
}

// renderElement 渲染元素
// renderElement 渲染元素
func (s *SVGAdapter) renderElement(el SVGElement) string {
    scale := float64(displayScale)  // ← 改为 float64

    switch el.Type {
    case "image":
        href, _ := el.Data["href"].(string)
        if href == "" {
            return ""
        }

        centerX := (el.X + el.Width/2) * scale
        centerY := (el.Y + el.Height/2) * scale

        return fmt.Sprintf(`<image href="%s" x="%.2f" y="%.2f" width="%.2f" height="%.2f" preserveAspectRatio="none" transform="rotate(%.2f, %.2f, %.2f)" />`,
            escapeXML(href),
            el.X*scale,
            el.Y*scale,
            el.Width*scale,
            el.Height*scale,
            el.Rotation,
            centerX,
            centerY)

    case "text":
        text, _ := el.Data["text"].(string)
        size, _ := el.Data["size"].(float64)

        return fmt.Sprintf(`<text x="%.2f" y="%.2f" font-size="%.2f" font-family="Arial">%s</text>`,
            el.X*scale,
            el.Y*scale,
            size*scale,
            escapeXML(text))

    case "line":
        x1, _ := el.Data["x1"].(float64)
        y1, _ := el.Data["y1"].(float64)
        x2, _ := el.Data["x2"].(float64)
        y2, _ := el.Data["y2"].(float64)
        width, _ := el.Data["width"].(float64)
        color, _ := el.Data["color"].(string)
        dash, _ := el.Data["dash"].([]float64)

        dashAttr := ""
        if len(dash) > 0 {
            dashStrs := []string{}
            for _, d := range dash {
                dashStrs = append(dashStrs, fmt.Sprintf("%.2f", d*scale))
            }
            dashAttr = fmt.Sprintf(` stroke-dasharray="%s"`, strings.Join(dashStrs, ","))
        }

        return fmt.Sprintf(`<line x1="%.2f" y1="%.2f" x2="%.2f" y2="%.2f" stroke="%s" stroke-width="%.2f"%s />`,
            x1*scale, y1*scale, x2*scale, y2*scale, color, width*scale, dashAttr)

    case "rect":
        color, _ := el.Data["color"].(RGBColor)

        return fmt.Sprintf(`<rect x="%.2f" y="%.2f" width="%.2f" height="%.2f" fill="rgb(%d,%d,%d)" />`,
            el.X*scale,
            el.Y*scale,
            el.Width*scale,
            el.Height*scale,
            color.R, color.G, color.B)

    default:
        return ""
    }
}


// escapeXML 转义 XML 特殊字符
func escapeXML(s string) string {
    s = strings.ReplaceAll(s, "&", "&amp;")
    s = strings.ReplaceAll(s, "<", "<")
    s = strings.ReplaceAll(s, ">", ">")
    s = strings.ReplaceAll(s, "\"", "&quot;")
    s = strings.ReplaceAll(s, "'", "&apos;")
    return s
}

// ToBase64 将 SVG 转换为 base64
func ToBase64SVG(svg string) string {
    encoded := base64.StdEncoding.EncodeToString([]byte(svg))
    return fmt.Sprintf("data:image/svg+xml;base64,%s", encoded)
}

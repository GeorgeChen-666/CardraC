package adapter

import (
    "time"
)

// Element 绘制元素
type Element struct {
    Type      string                 `json:"type"`
    Timestamp int64                  `json:"timestamp"`
    Data      map[string]interface{} `json:"data,omitempty"`
}

// Page 页面
type Page struct {
    Index        int       `json:"index"`
    Width        int       `json:"width"`
    Height       int       `json:"height"`
    Elements     []Element `json:"elements"`
    ElementCount int       `json:"elementCount"`
}

// ShadowAdapter 影子适配器（用于调试和测试）
type ShadowAdapter struct {
    config           map[string]interface{}
    pages            []Page
    currentPageIndex int
    currentPage      *Page
    pageWidth        int
    pageHeight       int
    currentLineWidth float64
    currentLineColor string
}

// NewShadowAdapter 创建新的影子适配器
func NewShadowAdapter(config map[string]interface{}) *ShadowAdapter {
    landscape, _ := config["landscape"].(bool)
    pageWidth, _ := config["pageWidth"].(float64)
    pageHeight, _ := config["pageHeight"].(float64)

    width := int(pageWidth)
    height := int(pageHeight)

    if landscape {
        width, height = height, width
    }

    adapter := &ShadowAdapter{
        config:           config,
        pages:            []Page{},
        currentPageIndex: -1,
        pageWidth:        width,
        pageHeight:       height,
    }

    adapter.createNewPage()
    return adapter
}

// createNewPage 创建新页面
func (s *ShadowAdapter) createNewPage() {
    s.currentPageIndex++
    s.currentPage = &Page{
        Index:    s.currentPageIndex,
        Width:    s.pageWidth,
        Height:   s.pageHeight,
        Elements: []Element{},
    }
    s.pages = append(s.pages, *s.currentPage)
}

// AddPage 添加新页面
func (s *ShadowAdapter) AddPage() error {
    s.createNewPage()
    return nil
}

// SaveState 保存状态
func (s *ShadowAdapter) SaveState() error {
    s.currentPage.Elements = append(s.currentPage.Elements, Element{
        Type:      "saveState",
        Timestamp: time.Now().UnixMilli(),
    })
    return nil
}

// RestoreState 恢复状态
func (s *ShadowAdapter) RestoreState() error {
    s.currentPage.Elements = append(s.currentPage.Elements, Element{
        Type:      "restoreState",
        Timestamp: time.Now().UnixMilli(),
    })
    return nil
}

// SetTransform 设置变换矩阵
func (s *ShadowAdapter) SetTransform(transform Transform) error {
    s.currentPage.Elements = append(s.currentPage.Elements, Element{
        Type:      "transform",
        Timestamp: time.Now().UnixMilli(),
        Data: map[string]interface{}{
            "matrix": transform,
        },
    })
    return nil
}

// DrawText 绘制文本
func (s *ShadowAdapter) DrawText(options TextOptions) error {
    s.currentPage.Elements = append(s.currentPage.Elements, Element{
        Type:      "text",
        Timestamp: time.Now().UnixMilli(),
        Data: map[string]interface{}{
            "text":     options.Text,
            "x":        options.X,
            "y":        options.Y,
            "fontSize": options.Size,
        },
    })
    return nil
}

// SetLineStyle 设置线条样式
func (s *ShadowAdapter) SetLineStyle(style LineStyle) error {
    s.currentLineWidth = style.Width
    s.currentLineColor = style.Color

    s.currentPage.Elements = append(s.currentPage.Elements, Element{
        Type:      "lineStyle",
        Timestamp: time.Now().UnixMilli(),
        Data: map[string]interface{}{
            "width": style.Width,
            "color": style.Color,
        },
    })
    return nil
}

// DrawLine 绘制线条
func (s *ShadowAdapter) DrawLine(options LineOptions) error {
    s.currentPage.Elements = append(s.currentPage.Elements, Element{
        Type:      "line",
        Timestamp: time.Now().UnixMilli(),
        Data: map[string]interface{}{
            "x1":          options.X1,
            "y1":          options.Y1,
            "x2":          options.X2,
            "y2":          options.Y2,
            "width":       s.currentLineWidth,
            "color":       s.currentLineColor,
            "dashed":      len(options.Dash) > 0,
            "dashPattern": options.Dash,
        },
    })
    return nil
}

// FillRect 填充矩形
func (s *ShadowAdapter) FillRect(options RectOptions) error {
    s.currentPage.Elements = append(s.currentPage.Elements, Element{
        Type:      "rect",
        Timestamp: time.Now().UnixMilli(),
        Data: map[string]interface{}{
            "x":      options.X,
            "y":      options.Y,
            "width":  options.Width,
            "height": options.Height,
            "color":  options.Color,
        },
    })
    return nil
}

// DrawImage 绘制图片
func (s *ShadowAdapter) DrawImage(options ImageOptions) error {
    adjustedX := options.X
    adjustedY := options.Y

    if options.Rotation == 180 {
        adjustedX = options.X - options.Width
        adjustedY = options.Y + options.Height
    }

    dataType := "unknown"
    if options.Data.Base64 != "" {
        dataType = "base64"
    } else if options.Data.Path != "" {
        dataType = "path"
    }

    s.currentPage.Elements = append(s.currentPage.Elements, Element{
        Type:      "image",
        Timestamp: time.Now().UnixMilli(),
        Data: map[string]interface{}{
            "x":        adjustedX,
            "y":        adjustedY,
            "width":    options.Width,
            "height":   options.Height,
            "rotation": options.Rotation,
            "rotated":  options.Rotation != 0,
            "dataType": dataType,
            "dataPath": options.Data.Path,
            "dataSize": len(options.Data.Base64),
        },
    })
    return nil
}

// GetPageSize 获取页面尺寸
func (s *ShadowAdapter) GetPageSize() PageSize {
    return PageSize{
        Width:  float64(s.pageWidth),
        Height: float64(s.pageHeight),
    }
}

// Finalize 完成并返回结果
func (s *ShadowAdapter) Finalize() (interface{}, error) {
    // 更新元素计数
    for i := range s.pages {
        s.pages[i].ElementCount = len(s.pages[i].Elements)
    }

    result := map[string]interface{}{
        "config": map[string]interface{}{
            "pageSize":      s.pageWidth,
            "landscape":     s.config["landscape"],
            "compressLevel": s.config["compressLevel"],
        },
        "totalPages": len(s.pages),
        "pages":      s.pages,
        "summary":    s.generateSummary(),
    }

    return result, nil
}

// generateSummary 生成摘要
func (s *ShadowAdapter) generateSummary() map[string]interface{} {
    summary := map[string]interface{}{
        "totalElements": 0,
        "byType":        make(map[string]int),
        "byPage":        []map[string]interface{}{},
    }

    totalElements := 0

    for _, page := range s.pages {
        pageStats := map[string]interface{}{
            "pageIndex": page.Index,
            "elements":  make(map[string]int),
        }

        for _, element := range page.Elements {
            totalElements++

            // 统计类型
            byType := summary["byType"].(map[string]int)
            byType[element.Type]++

            // 统计每页
            elements := pageStats["elements"].(map[string]int)
            elements[element.Type]++
        }

        summary["byPage"] = append(summary["byPage"].([]map[string]interface{}), pageStats)
    }

    summary["totalElements"] = totalElements

    return summary
}

package adapter

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"strings"

	"github.com/jung-kurt/gofpdf"
)

// PDFAdapter PDF 适配器
type PDFAdapter struct {
	pdf              *gofpdf.Fpdf
	pageWidth        float64
	pageHeight       float64
	currentLineWidth float64
	currentLineColor string
}

// NewPDFAdapter 创建 PDF 适配器
func NewPDFAdapter(config map[string]interface{}) *PDFAdapter {
	landscape, _ := config["landscape"].(bool)
	pageWidth, _ := config["pageWidth"].(float64)
	pageHeight, _ := config["pageHeight"].(float64)

	width := pageWidth
	height := pageHeight

	if landscape {
		width, height = height, width
	}

	orientation := "P"
	if landscape {
		orientation = "L"
	}

	pdf := gofpdf.New(orientation, "mm", "", "")
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	// 设置压缩
	pdf.SetCompression(true)

	return &PDFAdapter{
		pdf:        pdf,
		pageWidth:  width,
		pageHeight: height,
	}
}

// AddPage 添加新页面
func (p *PDFAdapter) AddPage() error {
	p.pdf.AddPage()
	return nil
}

// SaveState 保存图形状态
func (p *PDFAdapter) SaveState() error {
	// gofpdf 不直接支持 SaveGraphicsState，使用 TransformBegin 代替
	p.pdf.TransformBegin()
	return nil
}

// RestoreState 恢复图形状态
func (p *PDFAdapter) RestoreState() error {
	p.pdf.TransformEnd()
	return nil
}

// SetTransform 设置变换矩阵
func (p *PDFAdapter) SetTransform(transform Transform) error {
	// gofpdf 使用 TransformBegin + TransformScale/TransformRotate 等
	// 如果需要完整的矩阵变换，需要手动实现
	// 这里简化处理，只支持平移
	p.pdf.TransformBegin()
	p.pdf.TransformTranslate(transform.E, transform.F)
	return nil
}

// DrawText 绘制文本
func (p *PDFAdapter) DrawText(options TextOptions) error {
	p.pdf.SetFontSize(options.Size)
	p.pdf.Text(options.X, options.Y, options.Text)
	return nil
}

// SetLineStyle 设置线条样式
func (p *PDFAdapter) SetLineStyle(style LineStyle) error {
	p.currentLineWidth = style.Width
	p.currentLineColor = style.Color

	p.pdf.SetLineWidth(style.Width)

	// 解析颜色
	color := parseColor(style.Color)
	p.pdf.SetDrawColor(color.R, color.G, color.B)

	return nil
}

// DrawLine 绘制线条
func (p *PDFAdapter) DrawLine(options LineOptions) error {
	if len(options.Dash) > 0 {
		// 设置虚线样式
		dashStr := ""
		for i, d := range options.Dash {
			if i > 0 {
				dashStr += " "
			}
			dashStr += fmt.Sprintf("%.2f", d)
		}
		p.pdf.SetDashPattern(options.Dash, 0)
	}

	p.pdf.Line(options.X1, options.Y1, options.X2, options.Y2)

	if len(options.Dash) > 0 {
		// 恢复实线
		p.pdf.SetDashPattern([]float64{}, 0)
	}

	return nil
}

// FillRect 填充矩形
func (p *PDFAdapter) FillRect(options RectOptions) error {
	p.pdf.SetFillColor(options.Color.R, options.Color.G, options.Color.B)
	p.pdf.Rect(options.X, options.Y, options.Width, options.Height, "F")
	return nil
}

// DrawImage 绘制图片
func (p *PDFAdapter) DrawImage(options ImageOptions) error {
	adjustedX := options.X
	adjustedY := options.Y

	if options.Rotation == 180 {
		adjustedX = options.X - options.Width
		adjustedY = options.Y + options.Height
	}

	// 解码 base64 图片
	var imageData []byte
	var err error

	if options.Data.Base64 != "" {
		// 移除 data URL 前缀
		base64Str := options.Data.Base64
		if strings.Contains(base64Str, "base64,") {
			parts := strings.Split(base64Str, "base64,")
			if len(parts) > 1 {
				base64Str = parts[1]
			}
		}

		imageData, err = base64.StdEncoding.DecodeString(base64Str)
		if err != nil {
			return fmt.Errorf("failed to decode base64 image: %w", err)
		}
	}

	// 确定图片类型
	imageType := strings.ToUpper(options.Data.Ext)
	if imageType == "" {
		imageType = "PNG"
	}

	// 注册图片
	imageOptions := gofpdf.ImageOptions{
		ImageType: imageType,
		ReadDpi:   false,
	}

	// 使用 RegisterImageReader
	reader := strings.NewReader(string(imageData))
	imageName := fmt.Sprintf("img_%s", options.Data.Path)

	info := p.pdf.RegisterImageOptionsReader(imageName, imageOptions, reader)
	if p.pdf.Error() != nil {
		return fmt.Errorf("failed to register image: %w", p.pdf.Error())
	}

	// 绘制图片
	if options.Rotation != 0 {
		// 需要旋转
		p.pdf.TransformBegin()

		// 计算旋转中心
		centerX := adjustedX + options.Width/2
		centerY := adjustedY + options.Height/2

		// 移动到旋转中心
		p.pdf.TransformTranslate(centerX, centerY)

		// 旋转
		p.pdf.TransformRotate(options.Rotation, 0, 0)

		// 移回原位
		p.pdf.TransformTranslate(-centerX, -centerY)

		p.pdf.ImageOptions(
			imageName,
			adjustedX,
			adjustedY,
			options.Width,
			options.Height,
			false,
			imageOptions,
			0,
			"",
		)

		p.pdf.TransformEnd()
	} else {
		p.pdf.ImageOptions(
			imageName,
			adjustedX,
			adjustedY,
			options.Width,
			options.Height,
			false,
			imageOptions,
			0,
			"",
		)
	}

	_ = info // 避免未使用变量警告

	return nil
}

// GetPageSize 获取页面尺寸
func (p *PDFAdapter) GetPageSize() PageSize {
	return PageSize{
		Width:  p.pageWidth,
		Height: p.pageHeight,
	}
}

// Finalize 完成并返回 PDF 数据
func (p *PDFAdapter) Finalize() (interface{}, error) {
	var buf bytes.Buffer
	err := p.pdf.Output(&buf)
	if err != nil {
		return nil, fmt.Errorf("failed to generate PDF: %w", err)
	}
	return buf.Bytes(), nil
}

// parseColor 解析颜色字符串
func parseColor(colorStr string) RGBColor {
	// 默认黑色
	color := RGBColor{R: 0, G: 0, B: 0}

	if colorStr == "" {
		return color
	}

	// 移除 # 前缀
	colorStr = strings.TrimPrefix(colorStr, "#")

	// 解析十六进制颜色
	if len(colorStr) == 6 {
		fmt.Sscanf(colorStr, "%02x%02x%02x", &color.R, &color.G, &color.B)
	}

	return color
}

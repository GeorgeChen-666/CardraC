package utils

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"os"
	"strings"

	"github.com/disintegration/imaging"
)

// ImageOptions 图片处理选项
type ImageOptions struct {
	MaxWidth  int
	MaxHeight int
	Quality   int
}

// ReadCompressedImage 读取并压缩图片
func ReadCompressedImage(imagePath string, maxWidth int) (string, error) {
	return ReadCompressedImageWithOptions(imagePath, ImageOptions{
		MaxWidth: maxWidth,
		Quality:  85,
	})
}

func ReadCompressedImageWithOptions(imagePath string, options ImageOptions) (string, error) {
	// 打开文件（只读模式）
	file, err := os.Open(imagePath)
	if err != nil {
		return "", fmt.Errorf("failed to open image: %w", err)
	}

	// 解码图片
	img, format, err := image.Decode(file)

	// 立即关闭文件（解码后不再需要）
	closeErr := file.Close()
	if closeErr != nil {
		return "", fmt.Errorf("failed to close file: %w", closeErr)
	}

	if err != nil {
		return "", fmt.Errorf("failed to decode image: %w", err)
	}

	// 获取原始尺寸
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	// 计算缩放尺寸
	newWidth := width
	newHeight := height

	if options.MaxWidth > 0 && width > options.MaxWidth {
		newWidth = options.MaxWidth
		newHeight = int(float64(height) * float64(options.MaxWidth) / float64(width))
	}

	if options.MaxHeight > 0 && newHeight > options.MaxHeight {
		newHeight = options.MaxHeight
		newWidth = int(float64(width) * float64(options.MaxHeight) / float64(height))
	}

	// 如果需要缩放
	if newWidth != width || newHeight != height {
		img = imaging.Resize(img, newWidth, newHeight, imaging.Lanczos)
	}

	// 编码为 base64
	var buf bytes.Buffer

	quality := options.Quality
	if quality <= 0 {
		quality = 85
	}

	// 根据原始格式编码
	switch strings.ToLower(format) {
	case "jpeg", "jpg":
		err = jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality})
	case "png":
		err = png.Encode(&buf, img)
	default:
		err = jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality})
		format = "jpeg"
	}

	if err != nil {
		return "", fmt.Errorf("failed to encode image: %w", err)
	}

	// 转换为 base64
	base64Str := base64.StdEncoding.EncodeToString(buf.Bytes())

	// 返回 data URL
	mimeType := "image/jpeg"
	switch strings.ToLower(format) {
	case "png":
		mimeType = "image/png"
	case "gif":
		mimeType = "image/gif"
	case "webp":
		mimeType = "image/webp"
	}

	return fmt.Sprintf("data:%s;base64,%s", mimeType, base64Str), nil
}

func GetImageSize(imagePath string) (width, height int, err error) {
	file, err := os.Open(imagePath)
	if err != nil {
		return 0, 0, err
	}

	// 读取图片配置
	img, _, err := image.DecodeConfig(file)

	// ✅ 立即关闭文件
	closeErr := file.Close()
	if closeErr != nil {
		return 0, 0, closeErr
	}

	if err != nil {
		return 0, 0, err
	}

	return img.Width, img.Height, nil
}

// IsImageFile 判断是否为图片文件
func IsImageFile(filename string) bool {
	ext := strings.ToLower(filename)
	return strings.HasSuffix(ext, ".jpg") ||
		strings.HasSuffix(ext, ".jpeg") ||
		strings.HasSuffix(ext, ".png") ||
		strings.HasSuffix(ext, ".gif") ||
		strings.HasSuffix(ext, ".bmp") ||
		strings.HasSuffix(ext, ".webp")
}

func GetImageFormat(imagePath string) (string, error) {
	file, err := os.Open(imagePath)
	if err != nil {
		return "", err
	}
	// 读取图片格式
	_, format, err := image.DecodeConfig(file)
	// ✅ 立即关闭文件
	closeErr := file.Close()
	if closeErr != nil {
		return "", closeErr
	}
	if err != nil {
		return "", err
	}
	return format, nil
}

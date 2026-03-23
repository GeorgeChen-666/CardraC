package utils

import (
	"encoding/base64"
	"fmt"
	"os"
	"strings"
	"unsafe"
)

// ImageOptions 图片处理选项
type ImageOptions struct {
	MaxWidth  int
	MaxHeight int
	Quality   int
}

// ReadCompressedImage 读取并压缩图片 (保持你原本的默认参数)
func ReadCompressedImage(imagePath string, maxWidth int) (string, error) {
	return ReadCompressedImageWithOptions(imagePath, ImageOptions{
		MaxWidth: maxWidth,
		Quality:  70,
	})
}

// ReadCompressedImageWithOptions 使用自定义选项读取并压缩图片
func ReadCompressedImageWithOptions(imagePath string, options ImageOptions) (string, error) {
	if _, err := os.Stat(imagePath); err != nil {
		return "", fmt.Errorf("file not found: %w", err)
	}

	var processedImg *VipsImage
	// 核心修复：使用调通的 vips_thumbnail，高度传 1 表示比例自适应
	ret := vips_thumbnail(cString(imagePath), &processedImg, options.MaxWidth, 0)
	if ret != 0 {
		return "", fmt.Errorf("failed to create thumbnail: %s", getVipsError())
	}
	defer g_object_unref(unsafe.Pointer(processedImg))

	var buf *byte
	var size uint64
	quality := options.Quality
	if quality <= 0 {
		quality = 70
	}

	// 构造 vips 保存选项 (保持你原本的 .jpg[Q=x] 语法)
	suffix := fmt.Sprintf(".jpg[Q=%d]", quality)
	ret = vips_image_write_to_buffer(processedImg, cString(suffix), &buf, &size, 0)
	if ret != 0 {
		return "", fmt.Errorf("failed to encode image: %s", getVipsError())
	}
	defer g_free(unsafe.Pointer(buf))

	// 转换为 Base64
	data := unsafe.Slice(buf, size)
	base64Str := base64.StdEncoding.EncodeToString(data)
	return fmt.Sprintf("data:image/jpeg;base64,%s", base64Str), nil
}

// GetImageSize 获取图片真实尺寸
func GetImageSize(imagePath string) (width, height int, err error) {
	if _, err := os.Stat(imagePath); err != nil {
		return 0, 0, err
	}

	var img *VipsImage
	// 仅取尺寸，宽度设为 1 极快
	ret := vips_thumbnail(cString(imagePath), &img, 1, 0)
	if ret != 0 {
		return 0, 0, fmt.Errorf("failed to get size: %s", getVipsError())
	}
	defer g_object_unref(unsafe.Pointer(img))

	var w, h int
	vips_image_get_int(img, cString("width"), &w)
	vips_image_get_int(img, cString("height"), &h)
	return w, h, nil
}

// IsImageFile 判断是否为图片文件 (恢复你原本支持的格式)
func IsImageFile(filename string) bool {
	ext := strings.ToLower(filename)
	return strings.HasSuffix(ext, ".jpg") ||
		strings.HasSuffix(ext, ".jpeg") ||
		strings.HasSuffix(ext, ".png") ||
		strings.HasSuffix(ext, ".gif") ||
		strings.HasSuffix(ext, ".bmp") ||
		strings.HasSuffix(ext, ".webp") ||
		strings.HasSuffix(ext, ".tiff") ||
		strings.HasSuffix(ext, ".tif")
}

// GetImageFormat 获取图片格式 (恢复你原本的逻辑)
func GetImageFormat(imagePath string) (string, error) {
	if _, err := os.Stat(imagePath); err != nil {
		return "", err
	}
	ext := strings.ToLower(imagePath)
	switch {
	case strings.HasSuffix(ext, ".jpg") || strings.HasSuffix(ext, ".jpeg"):
		return "jpeg", nil
	case strings.HasSuffix(ext, ".png"):
		return "png", nil
	case strings.HasSuffix(ext, ".gif"):
		return "gif", nil
	case strings.HasSuffix(ext, ".webp"):
		return "webp", nil
	case strings.HasSuffix(ext, ".tiff") || strings.HasSuffix(ext, ".tif"):
		return "tiff", nil
	default:
		return "unknown", nil
	}
}

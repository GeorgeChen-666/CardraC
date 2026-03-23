//go:build windows

package utils

import (
	"fmt"
	"os"
	"path/filepath"
	"syscall"
	"unsafe"

	"github.com/ebitengine/purego"
)

var (
	libvips    uintptr
	libglib    uintptr
	libgobject uintptr

	vips_init          func(argv0 *byte) int
	vips_error_buffer  func() *byte
	g_free             func(ptr unsafe.Pointer)
	g_object_unref     func(obj unsafe.Pointer)
	vips_image_get_int func(img *VipsImage, name *byte, out *int) int

	vips_thumbnail             func(filename *byte, out **VipsImage, width int, terminator uintptr) int
	vips_image_write_to_buffer func(img *VipsImage, suffix *byte, buf **byte, size *uint64, terminator uintptr) int
)

type VipsImage struct{}

func init() {
	loadVipsLibrary()

	// 自动验证：请确保此路径有图片，否则会跳过验证
	testPath := `C:\Users\Zhong-Zhi Chen\Downloads\image.png`
	go VerifyVipsSetup(testPath)
}

func loadVipsLibrary() {
	binDir := `C:\dev\other\CardraC\libs\windows-amd64\bin`
	os.Setenv("PATH", binDir+";"+os.Getenv("PATH"))

	hVips, _ := syscall.LoadLibrary(filepath.Join(binDir, "libvips-42.dll"))
	libvips = uintptr(hVips)

	hGlib, _ := syscall.LoadLibrary(filepath.Join(binDir, "libglib-2.0-0.dll"))
	libglib = uintptr(hGlib)

	hGobject, _ := syscall.LoadLibrary(filepath.Join(binDir, "libgobject-2.0-0.dll"))
	libgobject = uintptr(hGobject)

	purego.RegisterLibFunc(&vips_init, libvips, "vips_init")
	purego.RegisterLibFunc(&vips_error_buffer, libvips, "vips_error_buffer")
	purego.RegisterLibFunc(&vips_thumbnail, libvips, "vips_thumbnail")
	purego.RegisterLibFunc(&vips_image_write_to_buffer, libvips, "vips_image_write_to_buffer")
	purego.RegisterLibFunc(&vips_image_get_int, libvips, "vips_image_get_int")
	purego.RegisterLibFunc(&g_free, libglib, "g_free")
	purego.RegisterLibFunc(&g_object_unref, libgobject, "g_object_unref")

	appName := []byte("WailsApp\x00")
	if vips_init(&appName[0]) != 0 {
		fmt.Println("Vips init failed")
		return
	}
	fmt.Println("✅ libvips 全部函数注册并初始化成功!")
}

func VerifyVipsSetup(testImagePath string) {
	fmt.Printf("\n--- 开始验证 libvips 绑定 ---\n")
	if _, err := os.Stat(testImagePath); err != nil {
		fmt.Printf("[跳过] 验证图片不存在: %s\n", testImagePath)
		return
	}

	var img *VipsImage
	fmt.Print("测试 vips_thumbnail... ")
	ret := vips_thumbnail(cString(testImagePath), &img, 100, 0)
	if ret != 0 {
		fmt.Printf("失败: %s\n", getVipsError())
		return
	}
	fmt.Println("成功")
	defer g_object_unref(unsafe.Pointer(img))

	var w, h int
	vips_image_get_int(img, cString("width"), &w)
	vips_image_get_int(img, cString("height"), &h)
	fmt.Printf("测试获取尺寸: 成功 (宽: %d, 高: %d)\n", w, h)

	fmt.Print("测试 vips_image_write_to_buffer... ")
	var buf *byte
	var size uint64
	ret = vips_image_write_to_buffer(img, cString(".jpg"), &buf, &size, 0)
	if ret != 0 {
		fmt.Printf("失败: %s\n", getVipsError())
	} else {
		fmt.Printf("成功 (大小: %d 字节)\n", size)
		g_free(unsafe.Pointer(buf))
	}
	fmt.Printf("--- libvips 验证完成 ---\n\n")
}

func cString(s string) *byte {
	b := append([]byte(s), 0)
	return &b[0]
}

func getVipsError() string {
	ptr := vips_error_buffer()
	if ptr == nil {
		return "unknown"
	}
	var n int
	for p := ptr; *p != 0; p = (*byte)(unsafe.Pointer(uintptr(unsafe.Pointer(p)) + 1)) {
		n++
	}
	return string(unsafe.Slice(ptr, n))
}

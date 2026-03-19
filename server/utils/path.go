package utils

import (
    "os"
    "path/filepath"
    "strings"
)

// ExpandPath 展开路径（处理 ~ 等）
func ExpandPath(path string) string {
    if strings.HasPrefix(path, "~") {
        homeDir, _ := os.UserHomeDir()
        return filepath.Join(homeDir, path[1:])
    }
    return path
}

// FixPath 修复路径（统一分隔符）
func FixPath(path string) string {
    // 将所有反斜杠替换为正斜杠
    path = strings.ReplaceAll(path, "\\", "/")

    // 清理路径
    path = filepath.Clean(path)

    return path
}

// NormalizePath 规范化路径
func NormalizePath(path string) string {
    path = ExpandPath(path)
    path = FixPath(path)
    return path
}

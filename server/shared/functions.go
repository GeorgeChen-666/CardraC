package shared

import (
    "encoding/base64"
    "math"
    "net/url"
    "strings"
    "time"
)

// WaitTime 等待指定时间
func WaitTime(timeout time.Duration) {
    time.Sleep(timeout)
}

// WaitCondition 等待条件满足
func WaitCondition(condition func() bool, checkInterval time.Duration, totalWaitingTime time.Duration) bool {
    startTime := time.Now()
    ticker := time.NewTicker(checkInterval)
    defer ticker.Stop()

    for {
        select {
        case <-ticker.C:
            if condition() {
                return true
            }
            if time.Since(startTime) > totalWaitingTime {
                return false
            }
        }
    }
}

// FixFloat 修复浮点数精度（保留2位小数）
func FixFloat(num float64) float64 {
    return math.Round(num*100) / 100
}

// DecodeSvg 解码 SVG 数据
func DecodeSvg(data string) string {
    if data == "" {
        return ""
    }

    // 如果已经是 SVG 标签
    if strings.HasPrefix(data, "<svg") {
        return data
    }

    // data:image/svg+xml;charset=utf-8,
    if strings.HasPrefix(data, "data:image/svg+xml;charset=utf-8,") {
        encoded := strings.TrimPrefix(data, "data:image/svg+xml;charset=utf-8,")
        decoded, err := url.QueryUnescape(encoded)
        if err != nil {
            return ""
        }
        return decoded
    }

    // data:image/svg+xml,
    if strings.HasPrefix(data, "data:image/svg+xml,") {
        encoded := strings.TrimPrefix(data, "data:image/svg+xml,")
        decoded, err := url.QueryUnescape(encoded)
        if err != nil {
            return ""
        }
        return decoded
    }

    // data:image/svg+xml;base64,
    if strings.HasPrefix(data, "data:image/svg+xml;base64,") {
        base64Data := strings.TrimPrefix(data, "data:image/svg+xml;base64,")
        decoded, err := base64.StdEncoding.DecodeString(base64Data)
        if err != nil {
            return ""
        }
        return string(decoded)
    }

    return ""
}

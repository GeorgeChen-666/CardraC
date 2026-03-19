package adapter

import (
    "fmt"
)

// AdapterType 适配器类型
type AdapterType string

const (
    AdapterTypePDF    AdapterType = "pdf"
    AdapterTypeSVG    AdapterType = "svg"
    AdapterTypeSharp  AdapterType = "sharp"
    AdapterTypeShadow AdapterType = "shadow"
)

// CreateAdapter 创建适配器
func CreateAdapter(adapterType AdapterType, config map[string]interface{}, options ...interface{}) (IAdapter, error) {
    switch adapterType {
    case AdapterTypePDF:
        return NewPDFAdapter(config), nil

    case AdapterTypeSVG:
        quality := "high"
        useAppLinks := false

        if len(options) > 0 {
            if q, ok := options[0].(string); ok {
                quality = q
            }
        }
        if len(options) > 1 {
            if u, ok := options[1].(bool); ok {
                useAppLinks = u
            }
        }

        return NewSVGAdapter(config, quality, useAppLinks), nil

    case AdapterTypeSharp:
        quality := "high"
        if len(options) > 0 {
            if q, ok := options[0].(string); ok {
                quality = q
            }
        }

        return NewSharpAdapter(config, quality), nil

    case AdapterTypeShadow:
        return NewShadowAdapter(config), nil

    default:
        return nil, fmt.Errorf("unknown adapter type: %s", adapterType)
    }
}

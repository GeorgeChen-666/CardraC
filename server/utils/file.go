package utils

import (
    "encoding/json"
    "fmt"
    "io"
    "os"
)

// ReadFileToData 读取文件到数据
func ReadFileToData(filePath string, format string) (interface{}, error) {
    file, err := os.Open(filePath)
    if err != nil {
        return nil, fmt.Errorf("failed to open file: %w", err)
    }
    defer file.Close()

    data, err := io.ReadAll(file)
    if err != nil {
        return nil, fmt.Errorf("failed to read file: %w", err)
    }

    if format == "" {
        return string(data), nil
    }

    return string(data), nil
}

// SaveDataToFile 保存数据到文件
func SaveDataToFile(data interface{}, filePath string) error {
    var buffer []byte
    var err error

    switch v := data.(type) {
    case []byte:
        buffer = v
    case string:
        buffer = []byte(v)
    case map[string]interface{}, []interface{}:
        buffer, err = json.Marshal(v)
        if err != nil {
            return fmt.Errorf("failed to marshal JSON: %w", err)
        }
    default:
        return fmt.Errorf("unsupported data type: %T", data)
    }

    return os.WriteFile(filePath, buffer, 0644)
}

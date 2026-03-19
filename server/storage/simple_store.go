package storage

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
)

type SimpleStore struct {
	name      string
	configDir string
	filePath  string
	mu        sync.RWMutex
}

// NewSimpleStore 创建新的配置存储
func NewSimpleStore(name string, cwd ...string) *SimpleStore {
	appName := os.Getenv("APP_NAME")
	if appName == "" {
		appName = "cardrac"
	}

	var configDir string
	if len(cwd) > 0 && cwd[0] != "" {
		configDir = cwd[0]
	} else {
		configDir = getConfigDir(appName)
	}

	filePath := filepath.Join(configDir, name+".json")

	store := &SimpleStore{
		name:      name,
		configDir: configDir,
		filePath:  filePath,
	}

	// 确保目录存在
	if err := os.MkdirAll(configDir, 0755); err != nil {
		log.Printf("⚠️ Failed to create config directory: %v\n", err)
	}

	// 初始化配置文件
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		if err := os.WriteFile(filePath, []byte("{}"), 0644); err != nil {
			log.Printf("⚠️ Failed to create config file: %v\n", err)
		}
	}

	return store
}

// getConfigDir 获取配置目录
func getConfigDir(appName string) string {
	homeDir, _ := os.UserHomeDir()

	switch {
	case os.Getenv("APPDATA") != "": // Windows
		return filepath.Join(os.Getenv("APPDATA"), appName)
	case fileExists(filepath.Join(homeDir, "Library")): // macOS
		return filepath.Join(homeDir, "Library", "Application Support", appName)
	default: // Linux
		return filepath.Join(homeDir, ".config", appName)
	}
}

// Get 获取配置
func (s *SimpleStore) Get() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, err := os.ReadFile(s.filePath)
	if err != nil {
		log.Printf("⚠️ Failed to read config %s: %v\n", s.name, err)
		return map[string]interface{}{}
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		log.Printf("⚠️ Failed to parse config %s: %v\n", s.name, err)
		return map[string]interface{}{}
	}

	return result
}

// Set 设置配置（合并模式，类似 Node.js 版本）
func (s *SimpleStore) Set(value map[string]interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 读取当前配置
	current := s.getUnsafe()

	// 合并配置
	updated := mergeMaps(current, value)

	// 序列化
	data, err := json.MarshalIndent(updated, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	// 确保目录存在
	dir := filepath.Dir(s.filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// 写入文件
	if err := os.WriteFile(s.filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}

	return nil
}

// getUnsafe 获取配置（不加锁，内部使用）
func (s *SimpleStore) getUnsafe() map[string]interface{} {
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return map[string]interface{}{}
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return map[string]interface{}{}
	}

	return result
}

// Clear 清空配置
func (s *SimpleStore) Clear() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return os.WriteFile(s.filePath, []byte("{}"), 0644)
}

// Delete 删除配置文件
func (s *SimpleStore) Delete() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, err := os.Stat(s.filePath); err == nil {
		return os.Remove(s.filePath)
	}
	return nil
}

// mergeMaps 合并两个 map（深度合并）
func mergeMaps(base, override map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})

	// 复制 base
	for k, v := range base {
		result[k] = v
	}

	// 覆盖/合并 override
	for k, v := range override {
		if vMap, ok := v.(map[string]interface{}); ok {
			if baseMap, ok := result[k].(map[string]interface{}); ok {
				result[k] = mergeMaps(baseMap, vMap)
			} else {
				result[k] = v
			}
		} else {
			result[k] = v
		}
	}

	return result
}

// fileExists 检查文件是否存在
func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

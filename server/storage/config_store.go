package storage

import (
	"log"
	"sync"
)

var (
	configStore     *SimpleStore
	configStoreOnce sync.Once
)

// InitConfigStore 初始化配置存储
func InitConfigStore() error {
	var err error
	configStoreOnce.Do(func() {
		configStore = NewSimpleStore("config")
		log.Println("✅ Config store initialized")
	})
	return err
}

// GetConfigStore 获取配置存储
func GetConfigStore() map[string]interface{} {
	if configStore == nil {
		InitConfigStore()
	}
	return configStore.Get()
}

// UpdateConfigStore 更新配置存储
func UpdateConfigStore(value map[string]interface{}) error {
	if configStore == nil {
		InitConfigStore()
	}
	return configStore.Set(value)
}

// GetConfig 获取配置（别名）
func GetConfig() map[string]interface{} {
	return GetConfigStore()
}

// SetConfig 设置配置（别名）
func SetConfig(config map[string]interface{}) error {
	return UpdateConfigStore(config)
}

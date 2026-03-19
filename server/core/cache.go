package core

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/dgraph-io/badger/v4"
)

// CacheConfig 缓存配置
type CacheConfig struct {
	// 数据目录路径，为空则使用默认路径
	DataDir string

	// 数据库文件名，为空则使用进程名
	DBName string

	// 默认过期时间，0 表示永不过期
	DefaultTTL time.Duration

	// 最大磁盘占用（字节），0 表示不限制
	MaxDiskSize int64

	// 是否启用自动 GC
	EnableAutoGC bool

	// GC 间隔时间
	GCInterval time.Duration

	// 是否启用日志
	EnableLogger bool
}

// BadgerCache Badger 缓存封装
type BadgerCache struct {
	db     *badger.DB
	config *CacheConfig
	stopGC chan struct{}
}

// NewBadgerCache 创建新的缓存实例
func NewBadgerCache(config *CacheConfig) (*BadgerCache, error) {
	// 设置默认配置
	if config == nil {
		config = &CacheConfig{}
	}

	// 设置默认数据目录
	if config.DataDir == "" {
		appDataPath, err := GetAppDataPath()
		if err != nil {
			return nil, fmt.Errorf("failed to get app data path: %w", err)
		}
		config.DataDir = filepath.Join(appDataPath, "cache")
	}

	// 设置默认数据库名称
	if config.DBName == "" {
		// 使用进程名作为数据库名
		execPath, _ := os.Executable()
		config.DBName = filepath.Base(execPath)
		// 移除扩展名
		if ext := filepath.Ext(config.DBName); ext != "" {
			config.DBName = config.DBName[:len(config.DBName)-len(ext)]
		}
	}

	// 设置默认 GC 间隔
	if config.GCInterval == 0 {
		config.GCInterval = 5 * time.Minute
	}

	// 创建数据目录
	dbPath := filepath.Join(config.DataDir, config.DBName)
	if err := os.MkdirAll(dbPath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	// 配置 Badger 选项
	opts := badger.DefaultOptions(dbPath)

	// 禁用日志（除非明确启用）
	if !config.EnableLogger {
		opts.Logger = nil
	}

	// 打开数据库
	db, err := badger.Open(opts)
	if err != nil {
		return nil, fmt.Errorf("failed to open badger db: %w", err)
	}

	cache := &BadgerCache{
		db:     db,
		config: config,
		stopGC: make(chan struct{}),
	}

	// 启动自动 GC
	if config.EnableAutoGC {
		go cache.runAutoGC()
	}

	// 启动磁盘空间监控
	if config.MaxDiskSize > 0 {
		go cache.monitorDiskSize()
	}

	return cache, nil
}

// Set 设置缓存值
func (bc *BadgerCache) Set(key string, value interface{}) error {
	return bc.SetWithTTL(key, value, bc.config.DefaultTTL)
}

// SetWithTTL 设置缓存值并指定过期时间
func (bc *BadgerCache) SetWithTTL(key string, value interface{}, ttl time.Duration) error {
	// 序列化值
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal value: %w", err)
	}

	return bc.db.Update(func(txn *badger.Txn) error {
		entry := badger.NewEntry([]byte(key), data)

		// 设置 TTL
		if ttl > 0 {
			entry = entry.WithTTL(ttl)
		}

		return txn.SetEntry(entry)
	})
}

// Get 获取缓存值
func (bc *BadgerCache) Get(key string, dest interface{}) error {
	return bc.db.View(func(txn *badger.Txn) error {
		item, err := txn.Get([]byte(key))
		if err != nil {
			return err
		}

		return item.Value(func(val []byte) error {
			return json.Unmarshal(val, dest)
		})
	})
}

// GetString 获取字符串值
func (bc *BadgerCache) GetString(key string) (string, error) {
	var value string
	err := bc.Get(key, &value)
	return value, err
}

// Exists 检查键是否存在
func (bc *BadgerCache) Exists(key string) bool {
	err := bc.db.View(func(txn *badger.Txn) error {
		_, err := txn.Get([]byte(key))
		return err
	})
	return err == nil
}

// Delete 删除缓存值
func (bc *BadgerCache) Delete(key string) error {
	return bc.db.Update(func(txn *badger.Txn) error {
		return txn.Delete([]byte(key))
	})
}

// GetAllKeys 获取所有键列表
func (bc *BadgerCache) GetAllKeys() ([]string, error) {
	var keys []string

	err := bc.db.View(func(txn *badger.Txn) error {
		opts := badger.DefaultIteratorOptions
		opts.PrefetchValues = false // 只获取键，不获取值

		it := txn.NewIterator(opts)
		defer it.Close()

		for it.Rewind(); it.Valid(); it.Next() {
			item := it.Item()
			key := string(item.Key())
			keys = append(keys, key)
		}

		return nil
	})

	return keys, err
}

// GetKeysByPrefix 根据前缀获取键列表
func (bc *BadgerCache) GetKeysByPrefix(prefix string) ([]string, error) {
	var keys []string

	err := bc.db.View(func(txn *badger.Txn) error {
		opts := badger.DefaultIteratorOptions
		opts.PrefetchValues = false

		it := txn.NewIterator(opts)
		defer it.Close()

		prefixBytes := []byte(prefix)
		for it.Seek(prefixBytes); it.ValidForPrefix(prefixBytes); it.Next() {
			item := it.Item()
			key := string(item.Key())
			keys = append(keys, key)
		}

		return nil
	})

	return keys, err
}

// Clear 清空整个数据库
func (bc *BadgerCache) Clear() error {
	return bc.db.DropAll()
}

// Count 获取键的数量
func (bc *BadgerCache) Count() (int, error) {
	count := 0

	err := bc.db.View(func(txn *badger.Txn) error {
		opts := badger.DefaultIteratorOptions
		opts.PrefetchValues = false

		it := txn.NewIterator(opts)
		defer it.Close()

		for it.Rewind(); it.Valid(); it.Next() {
			count++
		}

		return nil
	})

	return count, err
}

// GetDiskSize 获取当前磁盘占用大小（字节）
func (bc *BadgerCache) GetDiskSize() (int64, error) {
	dbPath := filepath.Join(bc.config.DataDir, bc.config.DBName)

	var totalSize int64
	err := filepath.Walk(dbPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			totalSize += info.Size()
		}
		return nil
	})

	return totalSize, err
}

// runAutoGC 自动垃圾回收
func (bc *BadgerCache) runAutoGC() {
	ticker := time.NewTicker(bc.config.GCInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// 运行垃圾回收，回收 50% 的垃圾
		again:
			err := bc.db.RunValueLogGC(0.5)
			if err == nil {
				// 继续回收直到没有垃圾
				goto again
			}

		case <-bc.stopGC:
			return
		}
	}
}

// monitorDiskSize 监控磁盘空间
func (bc *BadgerCache) monitorDiskSize() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			size, err := bc.GetDiskSize()
			if err != nil {
				continue
			}

			// 如果超过最大限制，删除最旧的数据
			if size > bc.config.MaxDiskSize {
				bc.evictOldestData()
			}

		case <-bc.stopGC:
			return
		}
	}
}

// evictOldestData 驱逐最旧的数据
func (bc *BadgerCache) evictOldestData() error {
	// 简单策略：删除前 10% 的键
	keys, err := bc.GetAllKeys()
	if err != nil {
		return err
	}

	deleteCount := len(keys) / 10
	if deleteCount == 0 {
		deleteCount = 1
	}

	for i := 0; i < deleteCount && i < len(keys); i++ {
		bc.Delete(keys[i])
	}

	return nil
}

// Close 关闭数据库
func (bc *BadgerCache) Close() error {
	// 停止 GC
	close(bc.stopGC)

	// 关闭数据库
	return bc.db.Close()
}

// Backup 备份数据库到指定文件
func (bc *BadgerCache) Backup(backupPath string) error {
	file, err := os.Create(backupPath)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = bc.db.Backup(file, 0)
	return err
}

// Restore 从备份文件恢复数据库
func (bc *BadgerCache) Restore(backupPath string) error {
	file, err := os.Open(backupPath)
	if err != nil {
		return err
	}
	defer file.Close()

	return bc.db.Load(file, 256)
}

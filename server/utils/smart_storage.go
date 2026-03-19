package utils

import (
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type SmartStorage struct {
	name                string
	allKeys             map[string]bool
	maxMemorySize       int
	useDiskCache        bool
	diskCache           *DiskCache
	targetMemorySize    int
	compactionThreshold int
	isCompacting        bool
	protectedKeys       map[string]bool
	keysOnDisk          map[string]bool
	memoryCache         *LRUCache
	mu                  sync.RWMutex
}

func NewSmartStorage(name string, options map[string]interface{}) *SmartStorage {
	maxMemorySize := 1000
	useDiskCache := true

	if size, ok := options["maxMemorySize"].(int); ok {
		maxMemorySize = size
	}

	targetMemorySize := maxMemorySize
	compactionThreshold := int(float64(maxMemorySize) * 1.5)

	return &SmartStorage{
		name:                name,
		allKeys:             make(map[string]bool),
		maxMemorySize:       maxMemorySize,
		useDiskCache:        useDiskCache,
		targetMemorySize:    targetMemorySize,
		compactionThreshold: compactionThreshold,
		isCompacting:        false,
		protectedKeys:       make(map[string]bool),
		keysOnDisk:          make(map[string]bool),
		memoryCache:         NewLRUCache(maxMemorySize),
	}
}

func (s *SmartStorage) getDiskCache() *DiskCache {
	if s.diskCache == nil {
		appDataPath := getAppDataPath()
		cachePath := filepath.Join(appDataPath, "cardrac", "cache", s.name)

		log.Printf("🔍 Creating DiskCache for '%s' at: %s", s.name, cachePath)

		s.diskCache = NewDiskCache(cachePath)
	}
	return s.diskCache
}

func getAppDataPath() string {
	home, _ := os.UserHomeDir()

	switch {
	case os.Getenv("APPDATA") != "":
		return os.Getenv("APPDATA")
	case fileExists(filepath.Join(home, "Library")):
		return filepath.Join(home, "Library", "Application Support")
	default:
		if xdg := os.Getenv("XDG_CONFIG_HOME"); xdg != "" {
			return xdg
		}
		return filepath.Join(home, ".config")
	}
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func (s *SmartStorage) Get(key string) interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.memoryCache.Has(key) {
		return s.memoryCache.Get(key)
	}

	if s.useDiskCache {
		value := s.getDiskCache().Get(key)
		if value != "" {
			s.memoryCache.Set(key, value)
			s.keysOnDisk[key] = true
			go s.checkAndStartCompaction()
			return value
		}
	}

	return nil
}

func (s *SmartStorage) Set(key string, value interface{}) {
	s.mu.Lock()
	s.allKeys[key] = true
	s.memoryCache.Set(key, value)
	delete(s.keysOnDisk, key)
	s.mu.Unlock()

	go s.checkAndStartCompaction()
}

func (s *SmartStorage) Delete(key string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.allKeys, key)
	s.memoryCache.Delete(key)
	delete(s.protectedKeys, key)
	delete(s.keysOnDisk, key)

	if s.useDiskCache {
		s.getDiskCache().Delete(key)
	}
}

func (s *SmartStorage) checkAndStartCompaction() {
	s.mu.RLock()
	if s.isCompacting {
		s.mu.RUnlock()
		return
	}

	if s.memoryCache.Size() > s.compactionThreshold {
		s.mu.RUnlock()
		log.Printf("📊 Memory: %d > %d, starting compaction...", s.memoryCache.Size(), s.compactionThreshold)
		go s.startBackgroundCompaction()
	} else {
		s.mu.RUnlock()
	}
}

func (s *SmartStorage) startBackgroundCompaction() {
	s.mu.Lock()
	if s.isCompacting {
		s.mu.Unlock()
		return
	}
	s.isCompacting = true
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.isCompacting = false
		s.mu.Unlock()
	}()

	log.Printf("🔄 Compaction started (current: %d, target: %d)", s.memoryCache.Size(), s.targetMemorySize)

	evictedCount := 0
	skippedCount := 0

	for s.memoryCache.Size() > s.targetMemorySize {
		lruKeys := s.memoryCache.GetLRUKeys(10)
		if len(lruKeys) == 0 {
			break
		}

		keysToEvict := []string{}

		for _, key := range lruKeys {
			s.mu.RLock()
			isProtected := s.protectedKeys[key]
			isOnDisk := s.keysOnDisk[key]
			s.mu.RUnlock()

			if isProtected {
				continue
			}

			if isOnDisk {
				s.memoryCache.Delete(key)
				skippedCount++
				continue
			}

			keysToEvict = append(keysToEvict, key)
		}

		if len(keysToEvict) == 0 && skippedCount == 0 {
			time.Sleep(100 * time.Millisecond)
			continue
		}

		for _, key := range keysToEvict {
			value := s.memoryCache.Get(key)
			if value == nil {
				continue
			}

			s.mu.Lock()
			s.protectedKeys[key] = true
			s.mu.Unlock()

			if valueStr, ok := value.(string); ok {
				err := s.getDiskCache().Set(key, valueStr)
				if err == nil {
					s.mu.Lock()
					s.keysOnDisk[key] = true
					s.mu.Unlock()

					s.memoryCache.Delete(key)
					evictedCount++
				}
			}

			s.mu.Lock()
			delete(s.protectedKeys, key)
			s.mu.Unlock()
		}

		time.Sleep(time.Millisecond)
	}

	log.Printf("✅ Compaction done. Evicted %d items, Skipped %d items. Current: %d",
		evictedCount, skippedCount, s.memoryCache.Size())
}

func (s *SmartStorage) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.allKeys = make(map[string]bool)
	s.memoryCache.Clear()
	s.protectedKeys = make(map[string]bool)
	s.keysOnDisk = make(map[string]bool)

	if s.useDiskCache {
		s.getDiskCache().Clear()
	}
}

func (s *SmartStorage) Has(key string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.allKeys[key]
}

func (s *SmartStorage) Keys() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	keys := make([]string, 0, len(s.allKeys))
	for k := range s.allKeys {
		keys = append(keys, k)
	}
	return keys
}

func (s *SmartStorage) Size() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.allKeys)
}

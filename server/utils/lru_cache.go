package utils

import "sync"

type LRUCache struct {
    maxSize     int
    cache       map[string]interface{}
    accessOrder []string
    mu          sync.RWMutex
}

func NewLRUCache(maxSize int) *LRUCache {
    return &LRUCache{
        maxSize:     maxSize,
        cache:       make(map[string]interface{}),
        accessOrder: []string{},
    }
}

func (l *LRUCache) Get(key string) interface{} {
    l.mu.Lock()
    defer l.mu.Unlock()

    if _, exists := l.cache[key]; !exists {
        return nil
    }

    // 更新访问顺序
    l.removeFromOrder(key)
    l.accessOrder = append(l.accessOrder, key)

    return l.cache[key]
}

func (l *LRUCache) Set(key string, value interface{}) {
    l.mu.Lock()
    defer l.mu.Unlock()

    if _, exists := l.cache[key]; exists {
        l.removeFromOrder(key)
    }

    l.cache[key] = value
    l.accessOrder = append(l.accessOrder, key)
}

func (l *LRUCache) GetLRUKeys(count int) []string {
    l.mu.RLock()
    defer l.mu.RUnlock()

    if count > len(l.accessOrder) {
        count = len(l.accessOrder)
    }

    result := make([]string, count)
    copy(result, l.accessOrder[:count])
    return result
}

func (l *LRUCache) Has(key string) bool {
    l.mu.RLock()
    defer l.mu.RUnlock()
    _, exists := l.cache[key]
    return exists
}

func (l *LRUCache) Delete(key string) bool {
    l.mu.Lock()
    defer l.mu.Unlock()

    if _, exists := l.cache[key]; !exists {
        return false
    }

    delete(l.cache, key)
    l.removeFromOrder(key)
    return true
}

func (l *LRUCache) Clear() {
    l.mu.Lock()
    defer l.mu.Unlock()

    l.cache = make(map[string]interface{})
    l.accessOrder = []string{}
}

func (l *LRUCache) Keys() []string {
    l.mu.RLock()
    defer l.mu.RUnlock()

    keys := make([]string, 0, len(l.cache))
    for k := range l.cache {
        keys = append(keys, k)
    }
    return keys
}

func (l *LRUCache) Size() int {
    l.mu.RLock()
    defer l.mu.RUnlock()
    return len(l.cache)
}

func (l *LRUCache) removeFromOrder(key string) {
    newOrder := make([]string, 0, len(l.accessOrder))
    for _, k := range l.accessOrder {
        if k != key {
            newOrder = append(newOrder, k)
        }
    }
    l.accessOrder = newOrder
}

package utils

import (
	"database/sql"
	"encoding/base64"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

var dbCreationMutex sync.Mutex

type DiskCache struct {
	baseCacheDir string
	dbPath       string
	db           *sql.DB
	insertStmt   *sql.Stmt
	selectStmt   *sql.Stmt
	deleteStmt   *sql.Stmt
	clearStmt    *sql.Stmt
	keysStmt     *sql.Stmt
	writeQueue   []writeTask
	isWriting    bool
	maxBatchSize int
	mu           sync.Mutex
}

type writeTask struct {
	key   string
	value string
	done  chan error
}

func NewDiskCache(cacheDir string) *DiskCache {
	// ✅ 使用全局锁
	dbCreationMutex.Lock()
	defer dbCreationMutex.Unlock()

	processID := os.Getpid()

	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		log.Printf("Failed to create cache directory: %v", err)
	}

	dbPath := filepath.Join(cacheDir, fmt.Sprintf("pid-%d.db", processID))

	log.Printf("🔧 Creating database at: %s", dbPath)

	// ✅ 添加 SQLite 配置
	dbConnStr := dbPath + "?_busy_timeout=10000&_journal_mode=WAL&_synchronous=NORMAL"

	db, err := sql.Open("sqlite", dbConnStr)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}

	// ✅ 设置连接池
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(0)

	// ✅ 启用 WAL 模式
	_, err = db.Exec("PRAGMA journal_mode=WAL")
	if err != nil {
		log.Printf("Warning: Failed to enable WAL mode: %v", err)
	}

	// ✅ 设置 busy_timeout
	_, err = db.Exec("PRAGMA busy_timeout=10000")
	if err != nil {
		log.Printf("Warning: Failed to set busy_timeout: %v", err)
	}

	// 创建表
	_, err = db.Exec(`
        CREATE TABLE IF NOT EXISTS cache (
            key TEXT PRIMARY KEY,
            value BLOB NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
    `)
	if err != nil {
		log.Fatalf("Failed to create table: %v", err)
	}

	// 预编译语句
	insertStmt, _ := db.Prepare("INSERT OR REPLACE INTO cache (key, value) VALUES (?, ?)")
	selectStmt, _ := db.Prepare("SELECT value FROM cache WHERE key = ?")
	deleteStmt, _ := db.Prepare("DELETE FROM cache WHERE key = ?")
	clearStmt, _ := db.Prepare("DELETE FROM cache")
	keysStmt, _ := db.Prepare("SELECT key FROM cache")

	dc := &DiskCache{
		baseCacheDir: cacheDir,
		dbPath:       dbPath,
		db:           db,
		insertStmt:   insertStmt,
		selectStmt:   selectStmt,
		deleteStmt:   deleteStmt,
		clearStmt:    clearStmt,
		keysStmt:     keysStmt,
		writeQueue:   []writeTask{},
		isWriting:    false,
		maxBatchSize: 20,
	}

	log.Printf("📁 DiskCache (SQLite) initialized at: %s", dbPath)

	dc.cleanupOldCaches()
	dc.registerCleanupOnExit()

	return dc
}

func (dc *DiskCache) Get(key string) string {
	var value []byte
	err := dc.selectStmt.QueryRow(key).Scan(&value)
	if err != nil {
		if err != sql.ErrNoRows {
			log.Printf("Failed to read cache for %s: %v", key, err)
		}
		return ""
	}

	// 检查图片类型
	if len(value) >= 2 {
		if value[0] == 0xFF && value[1] == 0xD8 {
			return "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(value)
		} else if value[0] == 0x89 && value[1] == 0x50 {
			return "data:image/png;base64," + base64.StdEncoding.EncodeToString(value)
		} else if value[0] == 0x52 && value[1] == 0x49 {
			return "data:image/webp;base64," + base64.StdEncoding.EncodeToString(value)
		}
	}

	return string(value)
}

func (dc *DiskCache) Set(key, value string) error {
	done := make(chan error, 1)

	dc.mu.Lock()
	dc.writeQueue = append(dc.writeQueue, writeTask{
		key:   key,
		value: value,
		done:  done,
	})
	dc.mu.Unlock()

	go dc.processWriteQueue()

	return <-done
}

func (dc *DiskCache) processWriteQueue() {
	dc.mu.Lock()
	if dc.isWriting || len(dc.writeQueue) == 0 {
		dc.mu.Unlock()
		return
	}
	dc.isWriting = true
	dc.mu.Unlock()

	defer func() {
		dc.mu.Lock()
		dc.isWriting = false
		dc.mu.Unlock()

		if len(dc.writeQueue) > 0 {
			go dc.processWriteQueue()
		}
	}()

	for {
		dc.mu.Lock()
		if len(dc.writeQueue) == 0 {
			dc.mu.Unlock()
			break
		}

		batchSize := dc.maxBatchSize
		if batchSize > len(dc.writeQueue) {
			batchSize = len(dc.writeQueue)
		}

		batch := dc.writeQueue[:batchSize]
		dc.writeQueue = dc.writeQueue[batchSize:]
		dc.mu.Unlock()

		// 使用事务批量写入
		tx, err := dc.db.Begin()
		if err != nil {
			for _, task := range batch {
				task.done <- err
			}
			continue
		}

		stmt := tx.Stmt(dc.insertStmt)

		for _, task := range batch {
			var buffer []byte

			if strings.HasPrefix(task.value, "data:image/") {
				parts := strings.SplitN(task.value, ",", 2)
				if len(parts) == 2 {
					decoded, err := base64.StdEncoding.DecodeString(parts[1])
					if err != nil {
						task.done <- err
						continue
					}
					buffer = decoded
				} else {
					buffer = []byte(task.value)
				}
			} else {
				buffer = []byte(task.value)
			}

			_, err := stmt.Exec(task.key, buffer)
			task.done <- err
		}

		tx.Commit()
		time.Sleep(time.Millisecond)
	}
}

func (dc *DiskCache) Delete(key string) {
	_, err := dc.deleteStmt.Exec(key)
	if err != nil {
		log.Printf("Failed to delete cache for %s: %v", key, err)
	}
}

func (dc *DiskCache) Clear() {
	_, err := dc.clearStmt.Exec()
	if err != nil {
		log.Printf("Failed to clear cache: %v", err)
	}
}

func (dc *DiskCache) cleanupOldCaches() {
	files, err := os.ReadDir(dc.baseCacheDir)
	if err != nil {
		return
	}

	currentPID := os.Getpid()

	for _, file := range files {
		if !strings.HasPrefix(file.Name(), "pid-") || !strings.HasSuffix(file.Name(), ".db") {
			continue
		}

		pidStr := strings.TrimPrefix(file.Name(), "pid-")
		pidStr = strings.TrimSuffix(pidStr, ".db")
		pid, err := strconv.Atoi(pidStr)
		if err != nil || pid == currentPID {
			continue
		}

		if !isProcessRunning(pid) {
			oldDbPath := filepath.Join(dc.baseCacheDir, file.Name())
			log.Printf("🗑️ Cleaning up old cache from PID %d", pid)

			os.Remove(oldDbPath)
			os.Remove(oldDbPath + "-wal")
			os.Remove(oldDbPath + "-shm")
		}
	}
}

func isProcessRunning(pid int) bool {
	process, err := os.FindProcess(pid)
	if err != nil {
		return false
	}

	err = process.Signal(os.Signal(nil))
	return err == nil
}

func (dc *DiskCache) registerCleanupOnExit() {
	// 注册清理函数
	// Go 中没有直接的 process.on('exit')，需要使用 signal
}

func (dc *DiskCache) GetCacheSize() int64 {
	info, err := os.Stat(dc.dbPath)
	if err != nil {
		return 0
	}
	return info.Size()
}

func (dc *DiskCache) Close() {
	if dc.db != nil {
		dc.db.Close()
	}

	os.Remove(dc.dbPath)
	os.Remove(dc.dbPath + "-wal")
	os.Remove(dc.dbPath + "-shm")
}

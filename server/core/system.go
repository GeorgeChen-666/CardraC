package core

import (
	"fmt"
	"net"
	"os"
	"os/user"
	"runtime"
	"strconv"
	"strings"
	"syscall"

	psnet "github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"
)

// UserInfo contains username and domain information
type UserInfo struct {
	Username string // 用户名
	Domain   string // 域名 (Windows) 或为空 (Linux/macOS)
}

// GetCurrentUsername returns the current system username (deprecated, use GetCurrentUserInfo)
func GetCurrentUsername() (string, error) {
	userInfo, err := GetCurrentUserInfo()
	if err != nil {
		return "", err
	}
	return userInfo.Username, nil
}

// GetCurrentUserInfo returns detailed user information including username and domain
func GetCurrentUserInfo() (*UserInfo, error) {
	currentUser, err := user.Current()
	if err != nil {
		return nil, fmt.Errorf("failed to get current user: %w", err)
	}

	userInfo := &UserInfo{}

	switch runtime.GOOS {
	case "windows":
		// Windows: username format is "DOMAIN\Username"
		username := currentUser.Username
		if idx := strings.Index(username, "\\"); idx != -1 {
			userInfo.Domain = username[:idx]
			userInfo.Username = username[idx+1:]
		} else {
			// No domain, just username
			userInfo.Username = username
			userInfo.Domain = ""
		}

	case "linux", "darwin": // darwin is macOS
		// Linux/macOS: no domain concept, just username
		userInfo.Username = currentUser.Username
		userInfo.Domain = ""

	default:
		// Other OS: treat as no domain
		userInfo.Username = currentUser.Username
		userInfo.Domain = ""
	}

	return userInfo, nil
}

// GetDomainUsername returns username in "DOMAIN\Username" format (Windows) or just username (Linux/macOS)
func GetDomainUsername() (string, error) {
	userInfo, err := GetCurrentUserInfo()
	if err != nil {
		return "", err
	}

	if userInfo.Domain != "" {
		return fmt.Sprintf("%s\\%s", userInfo.Domain, userInfo.Username), nil
	}
	return userInfo.Username, nil
}

// GetCurrentPID returns the current process ID
func GetCurrentPID() int {
	return os.Getpid()
}

// IsPortInUse checks if a port is currently in use
func IsPortInUse(port int, host string) bool {
	if host == "" {
		host = "localhost"
	}

	address := fmt.Sprintf("%s:%d", host, port)
	listener, err := net.Listen("tcp", address)
	if err != nil {
		// Port is in use
		return true
	}

	// Port is available, close the listener
	listener.Close()
	return false
}

// FindAvailablePort finds the nearest available port starting from the preferred port
func FindAvailablePort(preferredPort int, maxAttempts int, host string) (int, error) {
	if host == "" {
		host = "localhost"
	}

	if maxAttempts <= 0 {
		maxAttempts = 100
	}

	// First check if preferred port is available
	if !IsPortInUse(preferredPort, host) {
		return preferredPort, nil
	}

	// Try ports incrementally
	for offset := 1; offset < maxAttempts; offset++ {
		port := preferredPort + offset
		if port > 65535 { // Max port number
			break
		}

		if !IsPortInUse(port, host) {
			return port, nil
		}
	}

	return 0, fmt.Errorf("no available port found near %d after %d attempts", preferredPort, maxAttempts)
}

// ProcessInfo contains detailed information about a process
type ProcessInfo struct {
	PID        int32
	Name       string
	Status     string
	Username   string
	CreateTime int64
	MemoryInfo *process.MemoryInfoStat
	CPUPercent float64
	NumThreads int32
}

// GetProcessInfo returns detailed information about a process
func GetProcessInfo(pid int32) (*ProcessInfo, error) {
	if pid == 0 {
		pid = int32(os.Getpid())
	}

	proc, err := process.NewProcess(pid)
	if err != nil {
		return nil, fmt.Errorf("failed to get process: %w", err)
	}

	name, _ := proc.Name()
	status, _ := proc.Status()
	username, _ := proc.Username()
	createTime, _ := proc.CreateTime()
	memInfo, _ := proc.MemoryInfo()
	cpuPercent, _ := proc.CPUPercent()
	numThreads, _ := proc.NumThreads()

	info := &ProcessInfo{
		PID:        pid,
		Name:       name,
		Status:     status[0],
		Username:   username,
		CreateTime: createTime,
		MemoryInfo: memInfo,
		CPUPercent: cpuPercent,
		NumThreads: numThreads,
	}

	return info, nil
}

// KillProcessOnPort kills the process occupying a specific port
func KillProcessOnPort(port int, host string) error {
	if host == "" {
		host = "localhost"
	}

	connections, err := psnet.Connections("tcp")
	if err != nil {
		return fmt.Errorf("failed to get connections: %w", err)
	}

	for _, conn := range connections {
		if conn.Laddr.Port == uint32(port) {
			proc, err := process.NewProcess(int32(conn.Pid))
			if err != nil {
				continue
			}

			name, _ := proc.Name()
			fmt.Printf("Killing process %s (PID: %d) on port %d\n", name, conn.Pid, port)

			if runtime.GOOS == "windows" {
				err = proc.Kill()
			} else {
				err = proc.SendSignal(syscall.SIGTERM)
			}

			if err != nil {
				return fmt.Errorf("failed to kill process: %w", err)
			}

			return nil
		}
	}

	return fmt.Errorf("no process found on port %d", port)
}

// GetSystemInfo returns general system information
func GetSystemInfo() map[string]string {
	info := make(map[string]string)

	info["os"] = runtime.GOOS
	info["arch"] = runtime.GOARCH
	info["num_cpu"] = strconv.Itoa(runtime.NumCPU())
	info["go_version"] = runtime.Version()

	hostname, _ := os.Hostname()
	info["hostname"] = hostname

	return info
}

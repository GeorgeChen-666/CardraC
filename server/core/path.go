package core

import (
	"fmt"
	"os"
	"os/user"
	"path/filepath"
	"runtime"
)

// GetCurrentProgramPath returns the absolute path of the current running program
func GetCurrentProgramPath() (string, error) {
	execPath, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("failed to get executable path: %w", err)
	}

	dir := filepath.Dir(execPath)
	return dir, nil
}

// GetProjectRoot returns the project root directory
// Assumes the executable is in a subdirectory of the project
func GetProjectRoot() (string, error) {
	execPath, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("failed to get executable path: %w", err)
	}

	// Go up one level from executable directory
	root := filepath.Dir(filepath.Dir(execPath))
	return root, nil
}

// GetHomePath returns the current user's home directory path
func GetHomePath() (string, error) {
	currentUser, err := user.Current()
	if err != nil {
		return "", fmt.Errorf("failed to get current user: %w", err)
	}

	return currentUser.HomeDir, nil
}

// GetAppDataPath returns the application data directory path for the given app name
// If appName is empty, defaults to "cardrac"
// Windows: C:\Users\{username}\AppData\Roaming\{appName}
// macOS: ~/Library/Application Support/{appName}
// Linux: ~/.config/{appName}
func GetAppDataPath() (string, error) {
	var appName = "cardrac"

	var appDataPath string

	switch runtime.GOOS {
	case "windows":
		// Windows: %APPDATA%\{appName}
		appData := os.Getenv("APPDATA")
		if appData == "" {
			// Fallback: construct manually
			homeDir, err := GetHomePath()
			if err != nil {
				return "", fmt.Errorf("failed to get home path: %w", err)
			}
			appData = filepath.Join(homeDir, "AppData", "Roaming")
		}
		appDataPath = filepath.Join(appData, appName)

	case "darwin": // macOS
		// macOS: ~/Library/Application Support/{appName}
		homeDir, err := GetHomePath()
		if err != nil {
			return "", fmt.Errorf("failed to get home path: %w", err)
		}
		appDataPath = filepath.Join(homeDir, "Library", "Application Support", appName)

	case "linux":
		// Linux: ~/.config/{appName}
		configDir := os.Getenv("XDG_CONFIG_HOME")
		if configDir == "" {
			homeDir, err := GetHomePath()
			if err != nil {
				return "", fmt.Errorf("failed to get home path: %w", err)
			}
			configDir = filepath.Join(homeDir, ".config")
		}
		appDataPath = filepath.Join(configDir, appName)

	default:
		// Other OS: fallback to ~/.{appName}
		homeDir, err := GetHomePath()
		if err != nil {
			return "", fmt.Errorf("failed to get home path: %w", err)
		}
		appDataPath = filepath.Join(homeDir, "."+appName)
	}

	return appDataPath, nil
}

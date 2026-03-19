package plugins

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"main/server/shared"
	"main/server/storage"
	"main/server/websocket"
	"os"
	"path/filepath"
	"strings"
)

var appVersion string

var printStore *storage.SimpleStore

func init() {
	printStore = storage.NewSimpleStore("print_config")

	// 读取 wails.json
	data, err := os.ReadFile("wails.json")
	if err != nil {
		log.Printf("Failed to read wails.json: %v", err)
		appVersion = "unknown"
		return
	}

	var config struct {
		Info struct {
			ProductVersion string `json:"productVersion"`
		} `json:"info"`
	}

	if err := json.Unmarshal(data, &config); err != nil {
		log.Printf("Failed to parse wails.json: %v", err)
		appVersion = "unknown"
		return
	}
	appVersion = config.Info.ProductVersion
}

// getLangFilePath 获取语言文件路径
func getLangFilePath() string {
	cwd, _ := os.Getwd()
	return filepath.Join(cwd, "locales")
}

// initLanguageJson 初始化语言 JSON
func initLanguageJson(lang string) error {
	cwd, _ := os.Getwd()
	langFilePath := filepath.Join(cwd, "locales")
	langStore := storage.NewSimpleStore(lang, langFilePath)

	defaultLangPath := filepath.Join(cwd, "server", "locales", lang+".json")

	if _, err := os.Stat(defaultLangPath); os.IsNotExist(err) {
		return fmt.Errorf("file not found: %s", defaultLangPath)
	}

	defaultData, err := ioutil.ReadFile(defaultLangPath)
	if err != nil {
		return err
	}

	var defaultLangStore map[string]interface{}
	if err := json.Unmarshal(defaultData, &defaultLangStore); err != nil {
		return err
	}

	currentStore := langStore.Get()
	merged := mergeMaps(defaultLangStore, currentStore)

	if err := langStore.Set(merged); err != nil {
		return err
	}

	return nil
}

// getAvailableLanguages 获取所有可用语言
func getAvailableLanguages() []string {
	langFilePath := getLangFilePath()

	if _, err := os.Stat(langFilePath); os.IsNotExist(err) {
		return []string{}
	}

	files, err := ioutil.ReadDir(langFilePath)
	if err != nil {
		return []string{}
	}

	var langs []string
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".json") {
			lang := strings.TrimSuffix(file.Name(), ".json")
			if lang != "" {
				langs = append(langs, lang)
			}
		}
	}

	return langs
}

// getLocale 获取语言包
func getLocale(lang string) map[string]interface{} {
	langFilePath := getLangFilePath()
	langStore := storage.NewSimpleStore(lang, langFilePath)
	return langStore.Get()
}

// mergeMaps 合并两个 map
func mergeMaps(base, override map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})

	for k, v := range base {
		result[k] = v
	}

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

// pickKeys 从 map 中选择指定的 keys
func pickKeys(data map[string]interface{}, keys []string) map[string]interface{} {
	result := make(map[string]interface{})
	for _, key := range keys {
		if val, ok := data[key]; ok {
			result[key] = val
		}
	}
	return result
}

// RegisterConfigHandler 注册配置处理器
func RegisterConfigHandler(wsManager *websocket.Manager) {
	// saveConfig
	wsManager.On(shared.SaveConfig, func(event *websocket.Event, data map[string]interface{}) {
		log.Println("💾 SaveConfig called")

		state, _ := data["state"].(map[string]interface{})
		if state == nil {
			log.Println("⚠️ No state provided")
			return
		}

		Global, _ := state["Global"].(map[string]interface{})
		Config, _ := state["Config"].(map[string]interface{})

		if Global != nil && Config != nil {
			// 删除 globalBackground
			delete(Config, "globalBackground")

			// 只保存特定字段
			pickedGlobal := pickKeys(Global, []string{"currentLang", "isShowOverView"})

			// 保存配置
			err := storage.UpdateConfigStore(map[string]interface{}{
				"Config": Config,
				"Global": pickedGlobal,
			})

			if err != nil {
				log.Printf("❌ Failed to save config: %v\n", err)
			} else {
				log.Println("✅ Config saved")
			}
		}
	})

	// loadConfig
	wsManager.On(shared.LoadConfig, func(event *websocket.Event, data map[string]interface{}) {
		log.Println("📂 LoadConfig called")

		returnChannel, _ := data["returnChannel"].(string)
		log.Printf("   Return channel: %s\n", returnChannel)

		// 初始化语言文件
		if err := initLanguageJson("en"); err != nil {
			log.Printf("⚠️ Failed to init en: %v\n", err)
		}

		if err := initLanguageJson("zh"); err != nil {
			log.Printf("⚠️ Failed to init zh: %v\n", err)
		}

		// 获取配置
		config := storage.GetConfigStore()

		// 确保 Global 存在
		Global, ok := config["Global"].(map[string]interface{})
		if !ok {
			Global = make(map[string]interface{})
			config["Global"] = Global
		}

		// 获取可用语言列表
		Global["availableLangs"] = getAvailableLanguages()

		// 加载所有语言包
		locales := make(map[string]interface{})
		availableLangs, _ := Global["availableLangs"].([]string)
		for _, lang := range availableLangs {
			locales[lang] = getLocale(lang)
		}
		Global["locales"] = locales

		// 发送响应
		log.Printf("📤 Sending config to: %s\n", returnChannel)
		event.Sender.Send(returnChannel, config)
		log.Println("✅ Config sent")
	})

	// savePrintConfig
	wsManager.On(shared.SavePrintConfig, func(event *websocket.Event, data map[string]interface{}) {
		log.Println("🖨️ SavePrintConfig called")

		printConfig, _ := data["printConfig"].(map[string]interface{})
		if printConfig == nil {
			log.Println("⚠️ No printConfig provided")
			return
		}

		err := printStore.Set(map[string]interface{}{
			"printConfig": printConfig,
		})

		if err != nil {
			log.Printf("❌ Failed to save print config: %v\n", err)
		} else {
			log.Println("✅ Print config saved")
		}
	})

	// loadPrintConfig
	wsManager.On(shared.LoadPrintConfig, func(event *websocket.Event, data map[string]interface{}) {
		log.Println("🖨️ LoadPrintConfig called")

		returnChannel, _ := data["returnChannel"].(string)
		log.Printf("   Return channel: %s\n", returnChannel)

		// 获取打印配置
		storeData := printStore.Get()
		printConfig, ok := storeData["printConfig"].(map[string]interface{})

		// 如果不存在，使用默认值
		if !ok {
			printConfig = map[string]interface{}{
				"scaleX":  100,
				"scaleY":  100,
				"offsetX": 0,
				"offsetY": 0,
			}
			log.Println("   Using default print config")
		}

		// 发送响应
		log.Printf("📤 Sending print config to: %s\n", returnChannel)
		event.Sender.Send(returnChannel, printConfig)
		log.Println("✅ Print config sent")
	})

	log.Println("✅ Config handlers registered (3 handlers)")
}

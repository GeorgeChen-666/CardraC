package plugins

import (
	"log"
	"main/server/shared"
	"main/server/storage"
	"main/server/websocket"
	"time"
)

var templateStore *storage.SimpleStore

func init() {
	templateStore = storage.NewSimpleStore("templates")
}

// RegisterTemplateHandler 注册模板处理器
func RegisterTemplateHandler(wsManager *websocket.Manager) {
	// setTemplate
	wsManager.On(shared.SetTemplate, func(event *websocket.Event, data map[string]interface{}) {
		TemplateName, _ := data["templateName"].(string)
		returnChannel, _ := data["returnChannel"].(string)

		// 获取配置
		Config := storage.GetConfig()
		delete(Config, "globalBackground")

		// 获取现有模板
		lastStore := templateStore.Get()
		lastTemplates, _ := lastStore["templates"].([]interface{})
		if lastTemplates == nil {
			lastTemplates = []interface{}{}
		}

		// 过滤掉同名模板
		var filteredTemplates []interface{}
		for _, t := range lastTemplates {
			tMap, ok := t.(map[string]interface{})
			if !ok {
				continue
			}
			if tMap["TemplateName"] != TemplateName {
				filteredTemplates = append(filteredTemplates, t)
			}
		}

		// 添加新模板
		newTemplate := map[string]interface{}{
			"id":           time.Now().UnixMilli(),
			"TemplateName": TemplateName,
			"Config":       Config,
		}
		filteredTemplates = append(filteredTemplates, newTemplate)

		// 保存
		newStore := map[string]interface{}{
			"templates": filteredTemplates,
		}
		templateStore.Set(newStore)

		// 发送响应
		event.Sender.Send(returnChannel, nil)
	})

	// editTemplate
	wsManager.On(shared.EditTemplate, func(event *websocket.Event, data map[string]interface{}) {
		idFloat, _ := data["id"].(float64)
		id := int64(idFloat)
		TemplateName, _ := data["templateName"].(string)
		returnChannel, _ := data["returnChannel"].(string)

		// 获取现有模板
		lastStore := templateStore.Get()
		templates, _ := lastStore["templates"].([]interface{})

		// 查找并更新
		for i, t := range templates {
			tMap, ok := t.(map[string]interface{})
			if !ok {
				continue
			}

			tIdFloat, _ := tMap["id"].(float64)
			if int64(tIdFloat) == id {
				tMap["TemplateName"] = TemplateName
				templates[i] = tMap
				break
			}
		}

		// 保存
		templateStore.Set(lastStore)

		// 发送响应
		event.Sender.Send(returnChannel, nil)
	})

	// deleteTemplate
	wsManager.On(shared.DeleteTemplate, func(event *websocket.Event, data map[string]interface{}) {
		idFloat, _ := data["id"].(float64)
		id := int64(idFloat)
		returnChannel, _ := data["returnChannel"].(string)

		// 获取现有模板
		lastStore := templateStore.Get()
		templates, _ := lastStore["templates"].([]interface{})

		// 过滤掉要删除的模板
		var newTemplates []interface{}
		for _, t := range templates {
			tMap, ok := t.(map[string]interface{})
			if !ok {
				continue
			}

			tIdFloat, _ := tMap["id"].(float64)
			if int64(tIdFloat) != id {
				newTemplates = append(newTemplates, t)
			}
		}

		// 保存
		newStore := map[string]interface{}{
			"templates": newTemplates,
		}
		templateStore.Set(newStore)

		// 发送响应
		event.Sender.Send(returnChannel, nil)
	})

	// getTemplate
	wsManager.On(shared.GetTemplate, func(event *websocket.Event, data map[string]interface{}) {
		returnChannel, _ := data["returnChannel"].(string)

		// 获取模板列表
		lastStore := templateStore.Get()
		templates, ok := lastStore["templates"].([]interface{})
		if !ok {
			templates = []interface{}{}
		}

		// 发送响应
		event.Sender.Send(returnChannel, templates)
	})

	log.Println("✅ Template handlers registered")
}

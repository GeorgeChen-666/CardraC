package file_render

import (
	"main/server/file_render/adapter"
)

// ExportFile 导出文件
func ExportFile(doc adapter.IAdapter, state map[string]interface{}, pagesToRender []int) (interface{}, error) {
	config, _ := state["Config"].(map[string]interface{})
	cardList, _ := state["CardList"].([]interface{})

	// 获取分页图片列表
	pagedImageList := GetPagedImageListByCardList(state, config)

	// 渲染每一页
	for index, pageData := range pagedImageList {
		// 如果指定了要渲染的页面，检查是否在列表中
		if len(pagesToRender) > 0 {
			found := false
			for _, p := range pagesToRender {
				if p == index {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		// 渲染页面内容
		err := renderPage(doc, pageData, config)
		if err != nil {
			return nil, err
		}

		// 判断是否最后一页
		isLastPage := false
		if len(pagesToRender) > 0 {
			// 有过滤条件：检查后续是否还有要渲染的页
			hasMorePages := false
			for i := index + 1; i < len(pagedImageList); i++ {
				for _, p := range pagesToRender {
					if p == i {
						hasMorePages = true
						break
					}
				}
				if hasMorePages {
					break
				}
			}
			isLastPage = !hasMorePages
		} else {
			// 无过滤条件：检查是否是最后一个索引
			isLastPage = (index == len(pagedImageList)-1)
		}

		// 不是最后一页才 addPage
		if !isLastPage {
			doc.AddPage()
		}
	}

	_ = cardList // 避免未使用警告

	return doc.Finalize()
}

// renderPage 渲染单个页面
func renderPage(doc adapter.IAdapter, pageData PageData, config map[string]interface{}) error {
	// 直接使用结构体字段
	pageType := pageData.Type
	imageList := pageData.ImageList
	configList := pageData.Config

	doc.DrawText(adapter.TextOptions{
		Text: "Page Type: " + pageType,
		X:    10,
		Y:    20,
		Size: 12,
	})

	// TODO: 根据 imageList 和 configList 绘制实际内容
	_ = imageList
	_ = configList

	return nil
}

package file_render

import (
	"main/server/shared"
	"main/server/utils"
	"math"
	"sync"
)

var (
	// ImageStorage 图片存储（内存中最多保留 50 张高质量图片）
	ImageStorage *utils.SmartStorage

	// OverviewStorage 概览存储
	OverviewStorage *utils.SmartStorage

	ColorCache = &sync.Map{}
)

func init() {
	// 初始化 ImageStorage
	ImageStorage = utils.NewSmartStorage("ImageStorage", map[string]interface{}{
		"maxMemorySize": 50,
	})

	// 初始化 OverviewStorage
	OverviewStorage = utils.NewSmartStorage("OverviewStorage", map[string]interface{}{})

	// 初始化默认图片
	emptyImgData := shared.GetEmptyImgData()
	emptyImgPath := emptyImgData["path"].(string)

	ImageStorage.Set("_emptyImg", emptyImgPath)
	OverviewStorage.Set("_emptyImg", emptyImgPath)
}

// Rectangle 矩形
type Rectangle struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

// PageData 页面数据
type PageData struct {
	ImageList []interface{}            `json:"imageList"`
	Config    []map[string]interface{} `json:"config"`
	Type      string                   `json:"type"` // "face" or "back"
}

// fixFloat 修复浮点数精度
func fixFloat(num float64) float64 {
	return math.Round(num*100) / 100
}

// GetCutRectangleList 获取裁切矩形列表
func GetCutRectangleList(config map[string]interface{}, maxWidth, maxHeight float64, ignoreBleed, isBack bool) []Rectangle {
	sides, _ := config["sides"].(string)
	cardWidth, _ := config["cardWidth"].(float64)
	cardHeight, _ := config["cardHeight"].(float64)
	marginX, _ := config["marginX"].(float64)
	marginY, _ := config["marginY"].(float64)
	foldInHalfMargin, _ := config["foldInHalfMargin"].(float64)
	columns, _ := config["columns"].(float64)
	rows, _ := config["rows"].(float64)
	bleedX, _ := config["bleedX"].(float64)
	bleedY, _ := config["bleedY"].(float64)
	foldLineType, _ := config["foldLineType"].(string)
	offsetX, _ := config["offsetX"].(float64)
	offsetY, _ := config["offsetY"].(float64)
	avoidDislocation, _ := config["avoidDislocation"].(bool)

	// 计算缩放后的尺寸
	scaledWidth := fixFloat(cardWidth)
	scaledHeight := fixFloat(cardHeight)
	scaledMarginX := fixFloat(marginX)
	scaledMarginY := fixFloat(marginY)
	scaledBleedX := fixFloat(bleedX)
	scaledBleedY := fixFloat(bleedY)
	scaledFoldMargin := fixFloat(foldInHalfMargin)
	halfMarginX := scaledMarginX / 2
	halfMarginY := scaledMarginY / 2
	isFoldInHalf := sides == shared.FoldInHalf

	effectiveBleedX := scaledBleedX
	effectiveBleedY := scaledBleedY
	if isBack && avoidDislocation && sides != shared.Brochure {
		effectiveBleedX = halfMarginX
		effectiveBleedY = halfMarginY
	}

	// 创建矩形
	createRect := func(i, j int, isSupplementary bool) Rectangle {
		locX := float64(i)*(scaledWidth+scaledMarginX) + halfMarginX
		locY := float64(j)*(scaledHeight+scaledMarginY) + halfMarginY

		if !ignoreBleed {
			locX -= effectiveBleedX
			locY -= effectiveBleedY
		}

		width := scaledWidth
		height := scaledHeight

		if !ignoreBleed {
			width += effectiveBleedX * 2
			height += effectiveBleedY * 2
		}

		// 折叠偏移
		if isFoldInHalf {
			if foldLineType == "0" {
				// 横向折叠：Y方向偏移
				if isBack {
					if isSupplementary {
						locY -= scaledFoldMargin / 2
					} else {
						locY += scaledFoldMargin / 2
					}
				} else {
					if isSupplementary {
						locY += scaledFoldMargin / 2
					} else {
						locY -= scaledFoldMargin / 2
					}
				}
			} else {
				// 纵向折叠：X方向偏移
				if isBack {
					if isSupplementary {
						locX -= scaledFoldMargin / 2
					} else {
						locX += scaledFoldMargin / 2
					}
				} else {
					if isSupplementary {
						locX += scaledFoldMargin / 2
					} else {
						locX -= scaledFoldMargin / 2
					}
				}
			}
		}

		return Rectangle{
			X:      locX,
			Y:      locY,
			Width:  width,
			Height: height,
		}
	}

	list := []Rectangle{}

	if isFoldInHalf {
		effectiveRows := int(rows)
		effectiveColumns := int(columns)

		if foldLineType == "0" {
			effectiveRows = int(rows) / 2
		} else {
			effectiveColumns = int(columns) / 2
		}

		if isBack {
			// 背面
			if foldLineType == "0" {
				for j := int(rows) / 2; j < int(rows); j++ {
					for i := 0; i < effectiveColumns; i++ {
						list = append(list, createRect(i, j, false))
					}
				}
				for j := 0; j < effectiveRows; j++ {
					for i := 0; i < effectiveColumns; i++ {
						list = append(list, createRect(i, j, true))
					}
				}
			} else {
				for j := 0; j < effectiveRows; j++ {
					for i := int(columns) / 2; i < int(columns); i++ {
						list = append(list, createRect(i, j, false))
					}
				}
				for j := 0; j < effectiveRows; j++ {
					for i := 0; i < effectiveColumns; i++ {
						list = append(list, createRect(i, j, true))
					}
				}
			}
		} else {
			// 正面
			for j := 0; j < effectiveRows; j++ {
				for i := 0; i < effectiveColumns; i++ {
					list = append(list, createRect(i, j, false))
				}
			}

			if foldLineType == "0" {
				for j := int(rows) / 2; j < int(rows); j++ {
					for i := 0; i < effectiveColumns; i++ {
						list = append(list, createRect(i, j, true))
					}
				}
			} else {
				for j := 0; j < effectiveRows; j++ {
					for i := int(columns) / 2; i < int(columns); i++ {
						list = append(list, createRect(i, j, true))
					}
				}
			}
		}
	} else if sides == shared.Brochure {
		brochurePageWidth := maxWidth / columns
		brochurePageHeight := maxHeight / rows
		brochureBleedX := 0.0
		brochureBleedY := 0.0

		if !ignoreBleed {
			brochureBleedX = scaledBleedX
			brochureBleedY = scaledBleedY
		}

		for j := 0; j < int(rows); j++ {
			for i := 0; i < int(columns); i++ {
				rects := []Rectangle{
					{
						X:      -brochureBleedX,
						Y:      0,
						Width:  scaledWidth + brochureBleedX,
						Height: scaledHeight + brochureBleedY*2,
					},
					{
						X:      scaledWidth,
						Y:      0,
						Width:  scaledWidth + brochureBleedX,
						Height: scaledHeight + brochureBleedY*2,
					},
				}

				centered := centerRects(rects, brochurePageWidth, brochurePageHeight,
					float64(i)*brochurePageWidth, float64(j)*brochurePageHeight)
				list = append(list, centered...)
			}
		}
	} else {
		// 普通模式
		for j := 0; j < int(rows); j++ {
			for i := 0; i < int(columns); i++ {
				list = append(list, createRect(i, j, false))
			}
		}
	}

	return centerRects(list, maxWidth, maxHeight, offsetX, offsetY)
}

// centerRects 居中矩形
func centerRects(rects []Rectangle, pageWidth, pageHeight, offsetX, offsetY float64) []Rectangle {
	if len(rects) == 0 {
		return rects
	}

	minX := rects[0].X
	minY := rects[0].Y
	maxX := rects[0].X + rects[0].Width
	maxY := rects[0].Y + rects[0].Height

	for _, r := range rects {
		if r.X < minX {
			minX = r.X
		}
		if r.Y < minY {
			minY = r.Y
		}
		if r.X+r.Width > maxX {
			maxX = r.X + r.Width
		}
		if r.Y+r.Height > maxY {
			maxY = r.Y + r.Height
		}
	}

	totalWidth := maxX - minX
	totalHeight := maxY - minY

	centerOffsetX := (pageWidth-totalWidth)/2 - minX
	centerOffsetY := (pageHeight-totalHeight)/2 - minY

	result := make([]Rectangle, len(rects))
	for i, rect := range rects {
		result[i] = Rectangle{
			X:      fixFloat(rect.X + centerOffsetX + offsetX),
			Y:      fixFloat(rect.Y + centerOffsetY + offsetY),
			Width:  fixFloat(rect.Width),
			Height: fixFloat(rect.Height),
		}
	}

	return result
}

// GetPagedImageListByCardList 根据卡片列表获取分页图片列表
func GetPagedImageListByCardList(state map[string]interface{}, config map[string]interface{}) []PageData {
	cardList, _ := state["CardList"].([]interface{})

	if cardList == nil || len(cardList) == 0 {
		sides, _ := config["sides"].(string)
		rows, _ := config["rows"].(float64)
		columns, _ := config["columns"].(float64)

		isFoldInHalf := sides == shared.FoldInHalf
		isBrochure := sides == shared.Brochure

		pagedImageList := []PageData{}
		emptyImgData := shared.GetEmptyImgData()

		if isBrochure {
			slotCount := int(rows * columns * 2)
			imageList := make([]interface{}, slotCount)
			configList := make([]map[string]interface{}, slotCount)

			for i := 0; i < slotCount; i++ {
				imageList[i] = emptyImgData
			}

			pagedImageList = append(pagedImageList, PageData{
				ImageList: imageList,
				Config:    configList,
				Type:      "face",
			})

			imageList2 := make([]interface{}, slotCount)
			configList2 := make([]map[string]interface{}, slotCount)
			for i := 0; i < slotCount; i++ {
				imageList2[i] = emptyImgData
			}

			pagedImageList = append(pagedImageList, PageData{
				ImageList: imageList2,
				Config:    configList2,
				Type:      "back",
			})
		} else {
			divisor := 1.0
			if isFoldInHalf {
				divisor = 2.0
			}
			slotCount := int(rows * columns / divisor)

			imageList := make([]interface{}, slotCount)
			configList := make([]map[string]interface{}, slotCount)

			for i := 0; i < slotCount; i++ {
				imageList[i] = emptyImgData
			}

			pagedImageList = append(pagedImageList, PageData{
				ImageList: imageList,
				Config:    configList,
				Type:      "face",
			})

			if sides == shared.DoubleSides || sides == shared.FoldInHalf {
				imageList2 := make([]interface{}, slotCount)
				configList2 := make([]map[string]interface{}, slotCount)
				for i := 0; i < slotCount; i++ {
					imageList2[i] = emptyImgData
				}

				pagedImageList = append(pagedImageList, PageData{
					ImageList: imageList2,
					Config:    configList2,
					Type:      "back",
				})
			}
		}

		return pagedImageList
	}

	sides, _ := config["sides"].(string)

	if sides == shared.OneSide || sides == shared.DoubleSides || sides == shared.FoldInHalf {
		return getNormalPagedImageListByCardList(state, config)
	} else if sides == shared.Brochure {
		return getBrochurePagedImageListByCardList(state, config)
	}

	return []PageData{}
}

// getNormalPagedImageListByCardList 获取普通分页图片列表
func getNormalPagedImageListByCardList(state map[string]interface{}, config map[string]interface{}) []PageData {
	cardList, _ := state["CardList"].([]interface{})
	globalBackground, _ := state["globalBackground"]

	sides, _ := config["sides"].(string)
	rows, _ := config["rows"].(float64)
	columns, _ := config["columns"].(float64)

	isFoldInHalf := sides == shared.FoldInHalf

	// 展开重复的卡片
	repeatCardList := []interface{}{}
	for _, cv := range cardList {
		card, _ := cv.(map[string]interface{})
		repeat, _ := card["repeat"].(float64)
		if repeat == 0 {
			repeat = 1
		}

		for i := 0; i < int(repeat); i++ {
			repeatCardList = append(repeatCardList, card)
		}
	}

	pagedImageList := []PageData{}

	divisor := 1.0
	if isFoldInHalf {
		divisor = 2.0
	}
	size := int(rows * columns / divisor)

	for i := 0; i < len(repeatCardList); i += size {
		end := i + size
		if end > len(repeatCardList) {
			end = len(repeatCardList)
		}

		result := repeatCardList[i:end]

		// 正面
		faceImageList := make([]interface{}, len(result))
		faceConfigList := make([]map[string]interface{}, len(result))

		for j, c := range result {
			card, _ := c.(map[string]interface{})
			faceImageList[j] = card["face"]
			if cfg, ok := card["config"].(map[string]interface{}); ok {
				faceConfigList[j] = cfg
			}
		}

		pagedImageList = append(pagedImageList, PageData{
			ImageList: faceImageList,
			Config:    faceConfigList,
			Type:      "face",
		})

		// 背面
		if sides == shared.DoubleSides || sides == shared.FoldInHalf {
			backImageList := make([]interface{}, len(result))
			backConfigList := make([]map[string]interface{}, len(result))

			for j, c := range result {
				card, _ := c.(map[string]interface{})
				back, _ := card["back"].(map[string]interface{})

				if back != nil {
					if mtime, ok := back["mtime"]; ok && mtime != nil {
						backImageList[j] = back
					} else {
						backImageList[j] = globalBackground
					}
				} else {
					backImageList[j] = globalBackground
				}

				if cfg, ok := card["config"].(map[string]interface{}); ok {
					backConfigList[j] = cfg
				}
			}

			pagedImageList = append(pagedImageList, PageData{
				ImageList: backImageList,
				Config:    backConfigList,
				Type:      "back",
			})
		}
	}

	return pagedImageList
}

// getBrochurePagedImageListByCardList 获取小册子分页图片列表
func getBrochurePagedImageListByCardList(state map[string]interface{}, config map[string]interface{}) []PageData {
	cardList, _ := state["CardList"].([]interface{})
	brochureRepeatPerPage, _ := config["brochureRepeatPerPage"].(bool)
	rows, _ := config["rows"].(float64)
	columns, _ := config["columns"].(float64)

	repeatCardList := cardList
	pagedImageList := []PageData{}
	size := int(rows * columns * 2)

	emptyImgData := shared.GetEmptyImgData()
	emptyCard := map[string]interface{}{
		"face":   emptyImgData,
		"config": nil,
	}

	// 填充到4的倍数
	repeatEmpty := (4 - len(repeatCardList)%4) % 4
	for i := 0; i < repeatEmpty; i++ {
		repeatCardList = append(repeatCardList, emptyCard)
	}

	// 创建配对列表
	tempPairList := [][]interface{}{}
	for i := 0; i < len(repeatCardList)/2; i++ {
		tempPairList = append(tempPairList, []interface{}{
			repeatCardList[i*2],
			repeatCardList[i*2+1],
		})
	}

	// 重新排列
	tempPairList2 := [][]interface{}{}
	for i := 0; i < len(tempPairList)/2; i++ {
		// 反转并添加
		pair := tempPairList[len(tempPairList)-i-1]
		reversed := []interface{}{pair[1], pair[0]}
		tempPairList2 = append(tempPairList2, reversed)
		tempPairList2 = append(tempPairList2, tempPairList[i])
	}

	if brochureRepeatPerPage {
		for i := 0; i < len(tempPairList2); i += 2 {
			end := i + 2
			if end > len(tempPairList2) {
				end = len(tempPairList2)
			}

			result := tempPairList2[i:end]

			// 重复填充
			repeatResult := [][]interface{}{}
			for j := 0; j < size/2; j++ {
				repeatResult = append(repeatResult, result...)
			}

			// 正面
			faceImageList := make([]interface{}, len(repeatResult))
			faceConfigList := make([]map[string]interface{}, len(repeatResult))

			for j, pair := range repeatResult {
				if len(pair) > 0 {
					if card, ok := pair[0].(map[string]interface{}); ok {
						faceImageList[j] = card["face"]
						if cfg, ok := card["config"].(map[string]interface{}); ok {
							faceConfigList[j] = cfg
						}
					}
				}
			}

			pagedImageList = append(pagedImageList, PageData{
				ImageList: faceImageList,
				Config:    faceConfigList,
				Type:      "face",
			})

			// 背面
			backImageList := make([]interface{}, len(repeatResult))
			backConfigList := make([]map[string]interface{}, len(repeatResult))

			for j, pair := range repeatResult {
				if len(pair) > 1 {
					if card, ok := pair[1].(map[string]interface{}); ok {
						backImageList[j] = card["face"]
						if cfg, ok := card["config"].(map[string]interface{}); ok {
							backConfigList[j] = cfg
						}
					}
				}
			}

			pagedImageList = append(pagedImageList, PageData{
				ImageList: backImageList,
				Config:    backConfigList,
				Type:      "back",
			})
		}
	} else {
		for i := 0; i < len(tempPairList2); i += size {
			end := i + size
			if end > len(tempPairList2) {
				end = len(tempPairList2)
			}

			result := tempPairList2[i:end]

			// 正面
			faceImageList := make([]interface{}, len(result))
			faceConfigList := make([]map[string]interface{}, len(result))

			for j, pair := range result {
				if len(pair) > 0 {
					if card, ok := pair[0].(map[string]interface{}); ok {
						faceImageList[j] = card["face"]
						if cfg, ok := card["config"].(map[string]interface{}); ok {
							faceConfigList[j] = cfg
						}
					}
				}
			}

			pagedImageList = append(pagedImageList, PageData{
				ImageList: faceImageList,
				Config:    faceConfigList,
				Type:      "face",
			})

			// 背面
			backImageList := make([]interface{}, len(result))
			backConfigList := make([]map[string]interface{}, len(result))

			for j, pair := range result {
				if len(pair) > 1 {
					if card, ok := pair[1].(map[string]interface{}); ok {
						backImageList[j] = card["face"]
						if cfg, ok := card["config"].(map[string]interface{}); ok {
							backConfigList[j] = cfg
						}
					}
				}
			}

			pagedImageList = append(pagedImageList, PageData{
				ImageList: backImageList,
				Config:    backConfigList,
				Type:      "back",
			})
		}
	}

	return pagedImageList
}

// AdjustBackPageImageOrder 调整背面页面图片顺序
func AdjustBackPageImageOrder(pageData PageData, config map[string]interface{}) PageData {
	flip, _ := config["flip"].(string)
	landscape, _ := config["landscape"].(bool)
	rows, _ := config["rows"].(float64)
	columns, _ := config["columns"].(float64)
	sides, _ := config["sides"].(string)
	foldLineType, _ := config["foldLineType"].(string)

	flipWay := 0
	switch flip {
	case shared.FlipNone:
		flipWay = 0
	case shared.LongEdgeBinding:
		flipWay = 1
	case shared.ShortEdgeBinding:
		flipWay = 2
	}

	isFoldInHalf := sides == shared.FoldInHalf
	isBrochure := sides == shared.Brochure

	if pageData.Type != "back" {
		return pageData
	}

	imageList := pageData.ImageList
	configList := pageData.Config

	// 计算实际需要的格子数量
	totalSlots := 0
	if isBrochure {
		totalSlots = len(imageList)
	} else if isFoldInHalf {
		effectiveRows := int(rows)
		effectiveColumns := int(columns)

		if foldLineType == "0" {
			effectiveRows = int(math.Floor(rows / 2))
		} else {
			effectiveColumns = int(math.Floor(columns / 2))
		}

		totalSlots = effectiveRows * effectiveColumns
	} else {
		totalSlots = int(rows * columns)
	}

	// 填充到格子数
	paddedImageList := make([]interface{}, totalSlots)
	paddedConfig := make([]map[string]interface{}, totalSlots)

	for i := 0; i < len(imageList) && i < totalSlots; i++ {
		paddedImageList[i] = imageList[i]
		if i < len(configList) {
			paddedConfig[i] = configList[i]
		}
	}

	// 初始化新数组
	newImageList := make([]interface{}, totalSlots)
	newConfigList := make([]map[string]interface{}, totalSlots)

	// 通用翻转函数
	applyFlip := func(effectiveRows, effectiveColumns int, flipType string) {
		for y := 0; y < effectiveRows; y++ {
			for x := 0; x < effectiveColumns; x++ {
				originalIndex := y*effectiveColumns + x
				newX := x
				newY := y

				switch flipType {
				case "verticalInColumn": // 每列内上下翻转
					newY = (effectiveRows - 1) - y
				case "horizontalInRow": // 每行内左右翻转
					newX = (effectiveColumns - 1) - x
				case "verticalOverall": // 整体上下翻转
					newY = int(rows) - y - 1
				case "horizontalOverall": // 整体左右翻转
					newX = effectiveColumns - x - 1
				}

				var newIndex int
				if isFoldInHalf {
					newIndex = newY*effectiveColumns + newX
				} else {
					newIndex = newY*int(columns) + newX
				}

				if newIndex < totalSlots && originalIndex < len(paddedImageList) {
					newImageList[newIndex] = paddedImageList[originalIndex]
					newConfigList[newIndex] = paddedConfig[originalIndex]
				}
			}
		}
	}

	// 小册子专用翻转函数
	applyBrochureFlip := func(flipType string) {
		pairSize := 2
		pairsPerRow := int(columns)
		totalRows := int(rows)

		// 清空数组
		for i := 0; i < len(imageList); i++ {
			newImageList[i] = nil
			newConfigList[i] = nil
		}

		if flipType == "reversePairsAndColumns" {
			// 长边装订：行序不变，列序颠倒，每列内的对也颠倒
			for row := 0; row < totalRows; row++ {
				for col := 0; col < pairsPerRow; col++ {
					oldCol := col
					newCol := pairsPerRow - 1 - col // 列序颠倒

					oldPairStart := (row*pairsPerRow + oldCol) * pairSize
					newPairStart := (row*pairsPerRow + newCol) * pairSize

					// 对内也颠倒
					if oldPairStart+1 < len(imageList) && newPairStart+1 < len(newImageList) {
						newImageList[newPairStart] = imageList[oldPairStart+1]
						newImageList[newPairStart+1] = imageList[oldPairStart]

						if oldPairStart+1 < len(configList) {
							newConfigList[newPairStart] = configList[oldPairStart+1]
							newConfigList[newPairStart+1] = configList[oldPairStart]
						}
					}
				}
			}
		} else if flipType == "reverseRows" {
			// 短边装订：行序颠倒，列序不变，对内不变
			for row := 0; row < totalRows; row++ {
				newRow := totalRows - 1 - row // 行序颠倒

				for col := 0; col < pairsPerRow; col++ {
					oldPairStart := (row*pairsPerRow + col) * pairSize
					newPairStart := (newRow*pairsPerRow + col) * pairSize

					// 对内不变
					if oldPairStart+1 < len(imageList) && newPairStart+1 < len(newImageList) {
						newImageList[newPairStart] = imageList[oldPairStart]
						newImageList[newPairStart+1] = imageList[oldPairStart+1]

						if oldPairStart+1 < len(configList) {
							newConfigList[newPairStart] = configList[oldPairStart]
							newConfigList[newPairStart+1] = configList[oldPairStart+1]
						}
					}
				}
			}
		}
	}

	// 执行翻转逻辑
	if isFoldInHalf {
		// 折叠模式：根据折叠方向调整行列数
		effectiveRows := int(rows)
		effectiveColumns := int(columns)

		if foldLineType == "0" {
			effectiveRows = int(math.Floor(rows / 2))
		} else {
			effectiveColumns = int(math.Floor(columns / 2))
		}

		if !landscape && foldLineType == "0" {
			applyFlip(effectiveRows, effectiveColumns, "verticalInColumn")
		} else if !landscape && foldLineType == "1" {
			applyFlip(effectiveRows, effectiveColumns, "horizontalInRow")
		} else if landscape && foldLineType == "0" {
			applyFlip(effectiveRows, effectiveColumns, "verticalInColumn")
		} else if landscape && foldLineType == "1" {
			applyFlip(effectiveRows, effectiveColumns, "horizontalInRow")
		}
	} else if isBrochure {
		if flipWay != 0 {
			if (!landscape && flipWay == 1) || (landscape && flipWay == 2) {
				applyBrochureFlip("reversePairsAndColumns")
			} else if (!landscape && flipWay == 2) || (landscape && flipWay == 1) {
				applyBrochureFlip("reverseRows")
			}
		} else {
			// 无翻转
			for i := 0; i < totalSlots; i++ {
				if i < len(paddedImageList) {
					newImageList[i] = paddedImageList[i]
					newConfigList[i] = paddedConfig[i]
				}
			}
		}
	} else if flipWay != 0 {
		// 普通双面打印的翻转逻辑
		effectiveColumns := int(columns)

		if !landscape {
			if flipWay == 1 {
				applyFlip(int(rows), effectiveColumns, "horizontalOverall")
			} else if flipWay == 2 {
				applyFlip(int(rows), effectiveColumns, "verticalOverall")
			}
		} else {
			if flipWay == 1 {
				applyFlip(int(rows), effectiveColumns, "verticalOverall")
			} else if flipWay == 2 {
				applyFlip(int(rows), effectiveColumns, "horizontalOverall")
			}
		}
	} else {
		// 无翻转
		for i := 0; i < totalSlots; i++ {
			if i < len(paddedImageList) {
				newImageList[i] = paddedImageList[i]
				newConfigList[i] = paddedConfig[i]
			}
		}
	}

	return PageData{
		ImageList: newImageList,
		Config:    newConfigList,
		Type:      pageData.Type,
	}
}

// IsNeedRotation 判断是否需要旋转
func IsNeedRotation(config map[string]interface{}, isBack bool) bool {
	if !isBack {
		return false
	}

	sides, _ := config["sides"].(string)
	foldLineType, _ := config["foldLineType"].(string)
	flip, _ := config["flip"].(string)
	landscape, _ := config["landscape"].(bool)

	isFoldInHalf := sides == shared.FoldInHalf

	flipWay := 0
	switch flip {
	case shared.FlipNone:
		flipWay = 0
	case shared.LongEdgeBinding:
		flipWay = 1
	case shared.ShortEdgeBinding:
		flipWay = 2
	}

	// 对于折叠模式
	if isFoldInHalf {
		return foldLineType == "0" // 只有垂直折叠时背面需要旋转180度
	}

	// 对于普通双面和小册子模式
	return (landscape && flipWay == 1) || (!landscape && flipWay == 2)
}

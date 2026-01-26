import { layoutSides } from '../../../../shared/constants';

export const defaultImageStorage = {
  '_emptyImg': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEV/f3+QyhsjAAAACklEQVQI\n' +
    '12NgAAAAAgAB4iG8MwAAAABJRU5ErkJggg==',
};
export const ImageStorage = { ...defaultImageStorage };
export const OverviewStorage = { ...defaultImageStorage };

export const fixFloat = num => parseFloat(num.toFixed(2));

export const getCutRectangleList = (Config, { maxWidth, maxHeight }, ignoreBleed = true, isBack = false) => {
  const {
    sides,
    scale,
    cardWidth,
    cardHeight,
    marginX,
    marginY,
    foldInHalfMargin,
    columns,
    rows,
    bleedX,
    bleedY,
    foldLineType,
    offsetX,
    offsetY,
    avoidDislocation,
  } = Config;

  // 计算缩放后的尺寸
  const scaledWidth = fixFloat(cardWidth * scale / 100);
  const scaledHeight = fixFloat(cardHeight * scale / 100);
  const scaledMarginX = fixFloat(marginX * scale / 100);
  const scaledMarginY = fixFloat(marginY * scale / 100);
  const scaledBleedX = fixFloat(bleedX * scale / 100);
  const scaledBleedY = fixFloat(bleedY * scale / 100);
  const scaledFoldMargin = fixFloat(foldInHalfMargin * scale / 100);
  const halfMarginX = scaledMarginX / 2;
  const halfMarginY = scaledMarginY / 2;
  const isFoldInHalf = Config.sides === layoutSides.foldInHalf;

  let effectiveBleedX = scaledBleedX;
  let effectiveBleedY = scaledBleedY;
  if (isBack && avoidDislocation && sides !== layoutSides.brochure) {
    effectiveBleedX = halfMarginX;
    effectiveBleedY = halfMarginY;
  }

  const createRect = (i, j, isSupplementary = false) => {
    let locX = i * (scaledWidth + scaledMarginX) + halfMarginX - (ignoreBleed ? 0 : effectiveBleedX);
    let locY = j * (scaledHeight + scaledMarginY) + halfMarginY - (ignoreBleed ? 0 : effectiveBleedY);
    const width = scaledWidth + (ignoreBleed ? 0 : (effectiveBleedX * 2));
    const height = scaledHeight + (ignoreBleed ? 0 : (effectiveBleedY * 2));
    // 修复 scaledFoldMargin 逻辑
    if (isFoldInHalf) {
      if (foldLineType === '0') {
        // 横向折叠：Y方向偏移
        // 背面时偏移方向相反
        if (isBack) {
          locY = isSupplementary ? locY - scaledFoldMargin / 2 : locY + scaledFoldMargin / 2;
        } else {
          locY = isSupplementary ? locY + scaledFoldMargin / 2 : locY - scaledFoldMargin / 2;
        }
      } else {
        // 纵向折叠：X方向偏移
        // 背面时偏移方向相反
        if (isBack) {
          locX = isSupplementary ? locX - scaledFoldMargin / 2 : locX + scaledFoldMargin / 2;
        } else {
          locX = isSupplementary ? locX + scaledFoldMargin / 2 : locX - scaledFoldMargin / 2;
        }
      }
    }

    return { x: locX, y: locY, width, height };
  };

  const list = [];

  if (isFoldInHalf) {
    let effectiveRows = rows;
    let effectiveColumns = columns;

    if (foldLineType === '0') {
      effectiveRows = Math.floor(rows / 2);
    } else {
      effectiveColumns = Math.floor(columns / 2);
    }

    if (isBack) {
      // 背面：主要元素使用另一半坐标
      if (foldLineType === '0') {
        for (let j = Math.floor(rows / 2); j < rows; j++) {
          for (let i = 0; i < effectiveColumns; i++) {
            list.push(createRect(i, j, false)); // 主要元素
          }
        }
        for (let j = 0; j < effectiveRows; j++) {
          for (let i = 0; i < effectiveColumns; i++) {
            list.push(createRect(i, j, true)); // 追加元素
          }
        }
      } else {
        for (let j = 0; j < effectiveRows; j++) {
          for (let i = Math.floor(columns / 2); i < columns; i++) {
            list.push(createRect(i, j, false)); // 主要元素
          }
        }
        for (let j = 0; j < effectiveRows; j++) {
          for (let i = 0; i < effectiveColumns; i++) {
            list.push(createRect(i, j, true)); // 追加元素
          }
        }
      }
    } else {
      // 正面：主要元素使用前一半坐标
      for (let j = 0; j < effectiveRows; j++) {
        for (let i = 0; i < effectiveColumns; i++) {
          list.push(createRect(i, j, false)); // 主要元素
        }
      }

      if (foldLineType === '0') {
        for (let j = Math.floor(rows / 2); j < rows; j++) {
          for (let i = 0; i < effectiveColumns; i++) {
            list.push(createRect(i, j, true)); // 追加元素
          }
        }
      } else {
        for (let j = 0; j < effectiveRows; j++) {
          for (let i = Math.floor(columns / 2); i < columns; i++) {
            list.push(createRect(i, j, true)); // 追加元素
          }
        }
      }
    }
  } else if (sides === layoutSides.brochure) {
    const brochurePageWidth = maxWidth / columns;
    const brochurePageHeight = maxHeight / rows;
    const brochureBleedX = ignoreBleed ? 0 : scaledBleedX;
    const brochureBleedY = ignoreBleed ? 0 : scaledBleedY;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < columns; i++) {
        list.push(...centerRects([
          { x: 0, y: 0, width: scaledWidth + brochureBleedX, height: scaledHeight + brochureBleedY * 2 },
          {
            x: scaledWidth + brochureBleedX,
            y: 0,
            width: scaledWidth + brochureBleedX,
            height: scaledHeight + brochureBleedY * 2,
          },
        ], brochurePageWidth, brochurePageHeight, i * brochurePageWidth, j * brochurePageHeight));
      }
    }
  } else {
    // 普通模式
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < columns; i++) {
        list.push(createRect(i, j));
      }
    }
  }

  return centerRects(list, maxWidth, maxHeight, offsetX, offsetY);
};


function centerRects(rects, pageWidth, pageHeight, offsetX = 0, offsetY = 0) {
  let minX = Math.min(...rects.map(r => r.x));
  let minY = Math.min(...rects.map(r => r.y));
  let maxX = Math.max(...rects.map(r => r.x + r.width));
  let maxY = Math.max(...rects.map(r => r.y + r.height));

  let totalWidth = maxX - minX;
  let totalHeight = maxY - minY;

  let centerOffsetX = (pageWidth - totalWidth) / 2 - minX;
  let centerOffsetY = (pageHeight - totalHeight) / 2 - minY;
  return rects.map(rect => ({
    x: fixFloat(rect.x + centerOffsetX + offsetX),
    y: fixFloat(rect.y + centerOffsetY + offsetY),
    width: fixFloat(rect.width),
    height: fixFloat(rect.height),
  }));
}


export const getPagedImageListByCardList = (state, Config) => {
  if ([layoutSides.oneSide, layoutSides.doubleSides, layoutSides.foldInHalf].includes(Config.sides)) {
    return getNormalPagedImageListByCardList(state, Config);
  } else if (Config.sides === layoutSides.brochure) {
    return getBrochurePagedImageListByCardList(state, Config);
  }
};

const getNormalPagedImageListByCardList = ({ CardList, globalBackground }, Config) => {
  const isFoldInHalf = Config.sides === layoutSides.foldInHalf;
  let repeatCardList = CardList.reduce((arr, cv) => arr.concat(new Array(cv.repeat).fill(cv)), []);

  const pagedImageList = [];
  const sides = Config.sides;
  const size = Config.rows * Config.columns / (isFoldInHalf ? 2 : 1);

  for (let i = 0; i < repeatCardList.length; i += size) {
    const result = repeatCardList.slice(i, i + size);
    pagedImageList.push({
      imageList: result.map(c => c.face),
      config: result.map(c => c?.config),
      type: 'face',
    });
    if ([layoutSides.doubleSides, layoutSides.foldInHalf].includes(sides)) {
      pagedImageList.push({
        imageList: result.map(c => c.back?.mtime ? c.back : globalBackground),
        config: result.map(c => c?.config),
        type: 'back',
      });
    }
  }

  return pagedImageList;
};

const getBrochurePagedImageListByCardList = (state, Config) => {
  const { CardList } = state;
  const { brochureRepeatPerPage } = Config;
  let repeatCardList = CardList;

  const pagedImageList = [];
  const size = Config.rows * Config.columns * 2;

  const repeatEmpty = (4 - repeatCardList.length % 4) % 4;
  repeatCardList = repeatCardList.concat(new Array(repeatEmpty));
  const tempPairList = [];
  for (let i = 0; i < repeatCardList.length / 2; i++) {
    tempPairList.push([repeatCardList[i * 2], repeatCardList[i * 2 + 1]]);
  }
  const tempPairList2 = [];
  for (let i = 0; i < tempPairList.length / 2; i++) {
    tempPairList2.push(tempPairList[tempPairList.length - i - 1].reverse());
    tempPairList2.push(tempPairList[i]);
  }

  if (brochureRepeatPerPage) {
    for (let i = 0; i < tempPairList2.length; i += 2) {
      const result = tempPairList2.slice(i, i + 2);
      const repeatResult = Array(size / 2).fill(result).flat(1);
      pagedImageList.push({
        imageList: repeatResult.map(c => c[0]?.face),
        config: repeatResult.map(c => c?.config),
        type: 'face',
      });
      pagedImageList.push({
        imageList: repeatResult.map(c => c[1]?.face),
        config: repeatResult.map(c => c?.config),
        type: 'back',
      });
    }
  } else {
    for (let i = 0; i < tempPairList2.length; i += size) {
      const result = tempPairList2.slice(i, i + size);
      pagedImageList.push({
        imageList: result.map(c => c[0]?.face),
        config: result.map(c => c?.config),
        type: 'face',
      });
      pagedImageList.push({
        imageList: result.map(c => c[1]?.face),
        config: result.map(c => c?.config),
        type: 'back',
      });
    }
  }
  return pagedImageList;
};

export const adjustBackPageImageOrder = (pageData, Config) => {
  const { flip, landscape, rows, columns, sides, foldLineType } = Config;
  const flipWay = ['none', 'long-edge binding', 'short-edge binding'].indexOf(flip);
  const isFoldInHalf = sides === layoutSides.foldInHalf;

  if (pageData.type !== 'back') {
    return {
      ...pageData,
      config: pageData.config || [],
      imageList: pageData.imageList || [],
    };
  }

  const { imageList, config = [] } = pageData;
  //计算实际需要的格子数量
  const totalSlots = isFoldInHalf
    ? (foldLineType === '0' ? Math.floor(rows / 2) : rows) * (foldLineType === '1' ? Math.floor(columns / 2) : columns)
    : rows * columns;
  //填充到格子数
  const paddedImageList = [...imageList];
  const paddedConfig = [...config];
  while (paddedImageList.length < totalSlots) {
    paddedImageList.push(undefined);
    paddedConfig.push(undefined);
  }
  //用填充后的初始化
  const newImageList = new Array(totalSlots).fill(undefined);
  const newConfigList = new Array(totalSlots).fill(undefined);

  // 通用翻转函数
  const applyFlip = (effectiveRows, effectiveColumns, flipType) => {
    for (let y = 0; y < effectiveRows; y++) {
      for (let x = 0; x < effectiveColumns; x++) {
        const originalIndex = y * effectiveColumns + x;
        let newX = x;
        let newY = y;

        switch (flipType) {
          case 'verticalInColumn': // 每列内上下翻转
            newY = (effectiveRows - 1) - y;
            break;
          case 'horizontalInRow': // 每行内左右翻转
            newX = (effectiveColumns - 1) - x;
            break;
          case 'verticalOverall': // 整体上下翻转
            newY = rows - y - 1;
            break;
          case 'horizontalOverall': // 整体左右翻转
            newX = effectiveColumns - x - 1;
            break;
        }

        const newIndex = newY * (isFoldInHalf ? effectiveColumns : columns) + newX;
        if (newIndex < totalSlots) {
          newImageList[newIndex] = paddedImageList[originalIndex];
          newConfigList[newIndex] = paddedConfig[originalIndex];
        }
      }
    }
  };

  // 小册子专用翻转函数
  const applyBrochureFlip = (flipType) => {
    const pairSize = 2; // 每列2个元素
    const totalPairs = imageList.length / pairSize; // 总对数
    const pairsPerRow = columns; // 每行的列数（对数）
    const totalRows = rows;

    // 清空数组
    for (let i = 0; i < imageList.length; i++) {
      newImageList[i] = undefined;
      newConfigList[i] = undefined;
    }

    if (flipType === 'reversePairsAndColumns') {
      // 长边装订：行序不变，列序颠倒，每列内的对也颠倒
      for (let row = 0; row < totalRows; row++) {
        for (let col = 0; col < pairsPerRow; col++) {
          const oldCol = col;
          const newCol = pairsPerRow - 1 - col; // 列序颠倒

          const oldPairStart = (row * pairsPerRow + oldCol) * pairSize;
          const newPairStart = (row * pairsPerRow + newCol) * pairSize;

          // 对内也颠倒
          newImageList[newPairStart] = imageList[oldPairStart + 1];
          newImageList[newPairStart + 1] = imageList[oldPairStart];
          newConfigList[newPairStart] = config[oldPairStart + 1];
          newConfigList[newPairStart + 1] = config[oldPairStart];
        }
      }
    } else if (flipType === 'reverseRows') {
      // 短边装订：行序颠倒，列序不变，对内不变
      for (let row = 0; row < totalRows; row++) {
        const newRow = totalRows - 1 - row; // 行序颠倒

        for (let col = 0; col < pairsPerRow; col++) {
          const oldPairStart = (row * pairsPerRow + col) * pairSize;
          const newPairStart = (newRow * pairsPerRow + col) * pairSize;

          // 对内不变
          newImageList[newPairStart] = imageList[oldPairStart];
          newImageList[newPairStart + 1] = imageList[oldPairStart + 1];
          newConfigList[newPairStart] = config[oldPairStart];
          newConfigList[newPairStart + 1] = config[oldPairStart + 1];
        }
      }
    }
  };

  if (isFoldInHalf) {
    // 折叠模式：根据折叠方向调整行列数
    let effectiveRows = rows;
    let effectiveColumns = columns;

    if (foldLineType === '0') {
      effectiveRows = Math.floor(rows / 2);
    } else {
      effectiveColumns = Math.floor(columns / 2);
    }

    if (!landscape && foldLineType === '0') {
      applyFlip(effectiveRows, effectiveColumns, 'verticalInColumn');
    } else if (!landscape && foldLineType === '1') {
      applyFlip(effectiveRows, effectiveColumns, 'horizontalInRow');
    } else if (landscape && foldLineType === '0') {
      applyFlip(effectiveRows, effectiveColumns, 'verticalInColumn');
    } else if (landscape && foldLineType === '1') {
      applyFlip(effectiveRows, effectiveColumns, 'horizontalInRow');
    }
  } else if (sides === layoutSides.brochure) {
    if (flipWay !== 0) {
      if (!landscape && flipWay === 1 || landscape && flipWay === 2) {
        applyBrochureFlip('reversePairsAndColumns');
      } else if (!landscape && flipWay === 2 || landscape && flipWay === 1) {
        applyBrochureFlip('reverseRows');
      }
    } else {
      // 无翻转
      for (let i = 0; i < totalSlots; i++) {
        newImageList[i] = paddedImageList[i];
        newConfigList[i] = paddedConfig[i];
      }
    }
  } else if (flipWay !== 0) {
    // 普通双面打印的翻转逻辑
    const effectiveColumns = columns;
    if (!landscape) {
      if (flipWay === 1) {
        applyFlip(rows, effectiveColumns, 'horizontalOverall');
      } else if (flipWay === 2) {
        applyFlip(rows, effectiveColumns, 'verticalOverall');
      }
    } else {
      if (flipWay === 1) {
        applyFlip(rows, effectiveColumns, 'verticalOverall');
      } else if (flipWay === 2) {
        applyFlip(rows, effectiveColumns, 'horizontalOverall');
      }
    }
  } else {
    for (let i = 0; i < totalSlots; i++) {
      newImageList[i] = paddedImageList[i];
      newConfigList[i] = paddedConfig[i];
    }
  }

  return {
    ...pageData,
    config: newConfigList,
    imageList: newImageList,
  };
};

export const isNeedRotation = (Config, isBack) => {
  if (!isBack) {
    return false;
  }
  const { sides, foldLineType, flip, landscape } = Config;
  const isFoldInHalf = sides === layoutSides.foldInHalf;
  const flipWay = ['none', 'long-edge binding', 'short-edge binding'].indexOf(flip);
  // 对于折叠模式
  if (isFoldInHalf) {
    return foldLineType === '0'; // 只有垂直折叠时背面需要旋转180度
  }
  // 对于普通双面和小册子模式
  return landscape && flipWay === 1 || !landscape && flipWay === 2;
};
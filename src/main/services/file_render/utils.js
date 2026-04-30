import { emptyImg, layoutSides } from '../../../shared/constants';
import { fixFloat } from '../../../shared/functions';

export const getCutRectangleList = (Config, { maxWidth, maxHeight }, ignoreBleed = true, isBack = false) => {
  const {
    sides,
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
  const scaledWidth = fixFloat(cardWidth);
  const scaledHeight = fixFloat(cardHeight);
  const scaledMarginX = fixFloat(marginX);
  const scaledMarginY = fixFloat(marginY);
  const scaledBleedX = fixFloat(bleedX);
  const scaledBleedY = fixFloat(bleedY);
  const scaledFoldMargin = fixFloat(foldInHalfMargin);
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
          {
            x: -brochureBleedX,                        // 向左偏移，左侧出血
            y: 0,
            width: scaledWidth + brochureBleedX,       // 宽度包含左侧出血
            height: scaledHeight + brochureBleedY * 2  // 上下出血
          },
          {
            x: scaledWidth,                            // 紧贴左卡（无间隙）
            y: 0,
            width: scaledWidth + brochureBleedX,       // 宽度包含右侧出血
            height: scaledHeight + brochureBleedY * 2  // 上下出血
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
  const { sides, rows, columns } = Config;
  const isFoldInHalf = sides === layoutSides.foldInHalf;
  const isBrochure = sides === layoutSides.brochure;

  let pagedImageList = [];

  if ([layoutSides.oneSide, layoutSides.doubleSides, layoutSides.foldInHalf].includes(sides)) {
    pagedImageList = getNormalPagedImageListByCardList(state, Config);
  } else if (sides === layoutSides.brochure) {
    pagedImageList = getBrochurePagedImageListByCardList(state, Config);
  }

  const slotCount = isBrochure
    ? rows * columns * 2
    : rows * columns / (isFoldInHalf ? 2 : 1);

  const startEmptyIndex = state.CardList?.length || 0;

  pagedImageList.push({
    imageList: new Array(slotCount).fill(emptyImg),
    pathList: new Array(slotCount).fill(null).map((_, index) => `${startEmptyIndex + index}.face`),
    config: new Array(slotCount).fill(undefined),
    type: 'face',
  });

  if ([layoutSides.doubleSides, layoutSides.foldInHalf, layoutSides.brochure].includes(sides)) {
    pagedImageList.push({
      imageList: new Array(slotCount).fill(emptyImg),
      pathList: new Array(slotCount).fill(null).map((_, index) => `${startEmptyIndex + index}.back`),
      config: new Array(slotCount).fill(undefined),
      type: 'back',
    });
  }

  return pagedImageList;
};


const getNormalPagedImageListByCardList = ({ CardList, globalBackground }, Config) => {
  const isFoldInHalf = Config.sides === layoutSides.foldInHalf;

  // 展开重复的卡片
  let repeatCardList = [];
  CardList.forEach((card, originalIndex) => {
    for (let i = 0; i < card.repeat; i++) {
      repeatCardList.push({
        ...card,
        _originalIndex: originalIndex,
      });
    }
  });

  const pagedImageList = [];
  const sides = Config.sides;
  const size = Config.rows * Config.columns / (isFoldInHalf ? 2 : 1);

  // ✅ 计算总位置数并填充空白位
  const totalSlots = Math.ceil(repeatCardList.length / size) * size;
  while (repeatCardList.length < totalSlots) {
    repeatCardList.push({
      face: null,
      back: null,
      config: undefined,
      _originalIndex: repeatCardList.length,  // ✅ 使用当前长度作为索引
    });
  }

  // 分页
  for (let i = 0; i < repeatCardList.length; i += size) {
    const result = repeatCardList.slice(i, i + size);

    pagedImageList.push({
      imageList: result.map(c => c.face?.mtime ? {...c.face, id: `${c.id}.face`} : null),
      pathList: result.map(c => `${c._originalIndex}.face`),
      config: result.map(c => c?.config),
      type: 'face',
    });

    if ([layoutSides.doubleSides, layoutSides.foldInHalf].includes(sides)) {
      pagedImageList.push({
        imageList: result.map(c => c.back?.mtime ? {...c.back, id: `${c.id}.back`} : globalBackground),
        pathList: result.map(c => `${c._originalIndex}.back`),
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

  let repeatCardList = CardList.map((card, originalIndex) => ({
    ...card,
    _originalIndex: originalIndex,
  }));

  const pagedImageList = [];
  const size = Config.rows * Config.columns * 2;

  const repeatEmpty = (4 - repeatCardList.length % 4) % 4;
  const startEmptyIndex = repeatCardList.length;

  for (let i = 0; i < repeatEmpty; i++) {
    repeatCardList.push({
      face: emptyImg,
      config: undefined,
      _originalIndex: startEmptyIndex + i,
    });
  }

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
        imageList: repeatResult.map(c => c[0]?.face?.mtime ? {...c[0].face, id: `${c[0].id}.face`} : null),
        pathList: repeatResult.map(c => `${c[0]._originalIndex}.face`),
        config: repeatResult.map(c => c?.config),
        type: 'face',
      });

      pagedImageList.push({
        imageList: repeatResult.map(c => c[1]?.face?.mtime ? {...c[1].face, id: `${c[1].id}.face`} : null),
        pathList: repeatResult.map(c => `${c[1]._originalIndex}.back`),
        config: repeatResult.map(c => c?.config),
        type: 'back',
      });
    }
  } else {
    for (let i = 0; i < tempPairList2.length; i += size) {
      const result = tempPairList2.slice(i, i + size);

      pagedImageList.push({
        imageList: result.map(c => c[0]?.face?.mtime ? {...c[0].face, id: `${c[0].id}.face`} : null),
        pathList: result.map(c => `${c[0]._originalIndex}.face`),
        config: result.map(c => c?.config),
        type: 'face',
      });

      pagedImageList.push({
        imageList: result.map(c => c[1]?.face?.mtime ? {...c[1].face, id: `${c[1].id}.face`} : null),
        pathList: result.map(c => `${c[1]._originalIndex}.back`),
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
  const isBrochure = sides === layoutSides.brochure;

  if (pageData.type !== 'back') {
    return {
      ...pageData,
      config: pageData.config || [],
      imageList: pageData.imageList || [],
      pathList: pageData.pathList || [],  // ✅ 添加 pathList
    };
  }

  const { imageList, config = [], pathList = [] } = pageData;  // ✅ 解构 pathList

  // 计算实际需要的格子数量
  const totalSlots = isBrochure
    ? imageList.length
    : isFoldInHalf
      ? (foldLineType === '0' ? Math.floor(rows / 2) : rows) * (foldLineType === '1' ? Math.floor(columns / 2) : columns)
      : rows * columns;

  // 填充到格子数
  const paddedImageList = [...imageList];
  const paddedConfig = [...config];
  const paddedPathList = [...pathList];  // ✅ 填充 pathList

  while (paddedImageList.length < totalSlots) {
    paddedImageList.push(undefined);
    paddedConfig.push(undefined);
    paddedPathList.push(undefined);  // ✅ 同步填充
  }

  // 用填充后的初始化
  const newImageList = new Array(totalSlots).fill(undefined);
  const newConfigList = new Array(totalSlots).fill(undefined);
  const newPathList = new Array(totalSlots).fill(undefined);  // ✅ 初始化 pathList

  // 通用翻转函数
  const applyFlip = (effectiveRows, effectiveColumns, flipType) => {
    for (let y = 0; y < effectiveRows; y++) {
      for (let x = 0; x < effectiveColumns; x++) {
        const originalIndex = y * effectiveColumns + x;
        let newX = x;
        let newY = y;

        switch (flipType) {
          case 'verticalInColumn':
            newY = (effectiveRows - 1) - y;
            break;
          case 'horizontalInRow':
            newX = (effectiveColumns - 1) - x;
            break;
          case 'verticalOverall':
            newY = rows - y - 1;
            break;
          case 'horizontalOverall':
            newX = effectiveColumns - x - 1;
            break;
        }

        const newIndex = newY * (isFoldInHalf ? effectiveColumns : columns) + newX;
        if (newIndex < totalSlots) {
          newImageList[newIndex] = paddedImageList[originalIndex];
          newConfigList[newIndex] = paddedConfig[originalIndex];
          newPathList[newIndex] = paddedPathList[originalIndex];  // ✅ 同步调整
        }
      }
    }
  };

  // 小册子专用翻转函数
  const applyBrochureFlip = (flipType) => {
    const pairSize = 2;
    const totalPairs = imageList.length / pairSize;
    const pairsPerRow = columns;
    const totalRows = rows;

    // 清空数组
    for (let i = 0; i < imageList.length; i++) {
      newImageList[i] = undefined;
      newConfigList[i] = undefined;
      newPathList[i] = undefined;  // ✅ 清空 pathList
    }

    if (flipType === 'reversePairsAndColumns') {
      for (let row = 0; row < totalRows; row++) {
        for (let col = 0; col < pairsPerRow; col++) {
          const oldCol = col;
          const newCol = pairsPerRow - 1 - col;

          const oldPairStart = (row * pairsPerRow + oldCol) * pairSize;
          const newPairStart = (row * pairsPerRow + newCol) * pairSize;

          // 对内也颠倒
          newImageList[newPairStart] = imageList[oldPairStart + 1];
          newImageList[newPairStart + 1] = imageList[oldPairStart];
          newConfigList[newPairStart] = config[oldPairStart + 1];
          newConfigList[newPairStart + 1] = config[oldPairStart];
          newPathList[newPairStart] = pathList[oldPairStart + 1];      // ✅ 同步调整
          newPathList[newPairStart + 1] = pathList[oldPairStart];      // ✅ 同步调整
        }
      }
    } else if (flipType === 'reverseRows') {
      for (let row = 0; row < totalRows; row++) {
        const newRow = totalRows - 1 - row;

        for (let col = 0; col < pairsPerRow; col++) {
          const oldPairStart = (row * pairsPerRow + col) * pairSize;
          const newPairStart = (newRow * pairsPerRow + col) * pairSize;

          // 对内不变
          newImageList[newPairStart] = imageList[oldPairStart];
          newImageList[newPairStart + 1] = imageList[oldPairStart + 1];
          newConfigList[newPairStart] = config[oldPairStart];
          newConfigList[newPairStart + 1] = config[oldPairStart + 1];
          newPathList[newPairStart] = pathList[oldPairStart];          // ✅ 同步调整
          newPathList[newPairStart + 1] = pathList[oldPairStart + 1];  // ✅ 同步调整
        }
      }
    }
  };

  if (isFoldInHalf) {
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
        newPathList[i] = paddedPathList[i];  // ✅ 同步复制
      }
    }
  } else if (flipWay !== 0) {
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
      newPathList[i] = paddedPathList[i];  // ✅ 同步复制
    }
  }

  return {
    ...pageData,
    config: newConfigList,
    imageList: newImageList,
    pathList: newPathList,  // ✅ 返回调整后的 pathList
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


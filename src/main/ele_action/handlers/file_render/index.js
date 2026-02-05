import { fixFloat, waitCondition } from '../../../../shared/functions';
import { getPendingList } from '../ImageActions';
import { getBorderAverageColors, getConfigStore } from '../../functions';
import { adjustBackPageImageOrder, getCutRectangleList, getPagedImageListByCardList, isNeedRotation } from './utils';
import { layoutSides } from '../../../../shared/constants';
import { ImageStorage } from './utils';

export const colorCache = new Map();
const imageAverageColorSet = new Map();

const loadImageAverageColor = async () => {
  imageAverageColorSet.clear();
  const jobs = Object.keys(ImageStorage).map(key => {
    return (async () => {
      if(!imageAverageColorSet.has(key)) {
        try {
          if (colorCache.has(key)) {
            imageAverageColorSet.set(key, colorCache.get(key));
          } else {
            const averageColor = await getBorderAverageColors(ImageStorage[key]);
            imageAverageColorSet.set(key, averageColor);
            colorCache.set(key, averageColor);
          }
        }
        catch (e) {
          console.log(e)
        }
      }
    })()
  });
  await Promise.all(jobs);
}



export const exportFile = async (doc, state, pagesToRender = null) => {
  await waitCondition(() => getPendingList?.()?.size === 0);
  const { Config } = getConfigStore();

  const {avoidDislocation, scale, sides, lineWeight, cutlineColor, foldLineType, offsetX, offsetY, marginX, marginY, bleedX, bleedY, pageNumber, columns, rows, printOffsetX = 0, printOffsetY = 0} = Config;
  const maxWidth = fixFloat(doc.getPageSize().width);
  const maxHeight = fixFloat(doc.getPageSize().height);
  const isFoldInHalf = sides === layoutSides.foldInHalf;
  const scaledMarginX = fixFloat(marginX * scale / 100);
  const scaledMarginY = fixFloat(marginY * scale / 100);

  if(Config.marginFilling) {
    await loadImageAverageColor();
  }

  if (isFoldInHalf && pagesToRender && pagesToRender.length > 0) {
    const expandedPages = new Set();
    pagesToRender.forEach(index => {
      expandedPages.add(index * 2);           // 添加原始 index（正面）
      expandedPages.add(index * 2 + 1);       // 添加配对的背面
    });
    pagesToRender = Array.from(expandedPages).sort((a, b) => a - b);
  }

  const pagedImageList = getPagedImageListByCardList(state, Config);

  const totalPageCount = pagedImageList.filter(p => p.type === 'face').length;
  for (const pageData of pagedImageList) {
    const index = pagedImageList.indexOf(pageData)

    if (pagesToRender && pagesToRender.length > 0) {
      if (!pagesToRender.includes(index)) {
        continue;
      }
    }

    const cutline = pageData.type === 'back'? (sides === layoutSides.brochure ? null : Config.bCutLine): Config.fCutLine;

    doc.saveState();
    if(pageData.type === 'back' && [layoutSides.doubleSides, layoutSides.brochure].includes(sides)) {
      doc.setTransform({a:1, b:0, c:0, d:1, e:printOffsetX, f:printOffsetY * -1});
    }
    // page number
    if(pageData.type === 'face' && pageNumber) {
      const currentPage = pagedImageList
        .slice(0, index + 1)
        .filter(p => p.type === 'face')
        .length;
      doc.drawText({
        text:`${currentPage}/${totalPageCount}`, x:5, y:7, size: 8
      })
    }

    // 对折线
    if(isFoldInHalf && pageData.type !== 'back') {
      const dashMarks = new Set();
      foldLineType === '0' && dashMarks.add(`${0},${maxHeight / 2}-${maxWidth},${maxHeight / 2}`);
      foldLineType === '1' && dashMarks.add(`${maxWidth / 2},${0}-${maxWidth / 2},${maxHeight}`);
      dashMarks.forEach(nm => {
        const [loc1, loc2] = nm.split('-');
        const [x2, y2] = loc2.split(',');
        const [x1, y1] = loc1.split(',');
        try {
          doc.setLineStyle({width: lineWeight * 0.3527, color: cutlineColor});
          doc.drawLine({
            x1: parseFloat(x1) + offsetX,
            y1: parseFloat(y1) + offsetY,
            x2: parseFloat(x2) + offsetX,
            y2: parseFloat(y2) + offsetY,
            dash: [0.5]
          });
        } catch (e) {
        }
      });
    }
    const isFoldInHalfBack = isFoldInHalf && pageData.type === 'back'
    if ((cutline === '1' || cutline === '3') && !isFoldInHalfBack) {
      //cutline normal
      doc.setLineStyle({width:lineWeight * 0.3527, color:cutlineColor})
      const markRectList = getCutRectangleList(Config, { maxWidth, maxHeight }, true);
      const xList = [...new Set(markRectList.map(r => r.x))];
      const yList = [...new Set(markRectList.map(r => r.y))];
      const minX = Math.min(...xList);
      const maxX = Math.max(...xList);
      const minY = Math.min(...yList);
      const maxY = Math.max(...yList);
      const width = markRectList[0].width;
      const height = markRectList[0].height;
      xList.forEach((v, vIndex) => {
        const t = vIndex % 2;
        // 对贴模式 - 垂直对折时跳过右半部分的垂直线
        if (sides === layoutSides.foldInHalf && foldLineType === '1' && v >= maxWidth / 2) {
          return;
        }
        if (t === 0 || sides !== layoutSides.brochure) {
          // 水平对折时，跳过下半部分的线段
          if (!(sides === layoutSides.foldInHalf && foldLineType === '0' && minY >= maxHeight / 2)) {
            doc.drawLine({x1: v, y1: 0, x2: v, y2: minY});
          }
          if (!(sides === layoutSides.foldInHalf && foldLineType === '0' && maxHeight >= maxHeight / 2)) {
            doc.drawLine({x1: v, y1: maxHeight, x2: v, y2: maxY + height});
          }
        }
        if (t === 1 || sides !== layoutSides.brochure) {
          // 水平对折时，跳过下半部分的线段
          if (!(sides === layoutSides.foldInHalf && foldLineType === '0' && minY >= maxHeight / 2)) {
            doc.drawLine({x1: v + width, y1: 0, x2: v + width, y2: minY});
          }
          if (!(sides === layoutSides.foldInHalf && foldLineType === '0' && maxHeight >= maxHeight / 2)) {
            doc.drawLine({x1: v + width, y1: maxHeight, x2: v + width, y2: maxY + height});
          }
        }
      });

      yList.forEach(v => {
        // 对贴模式 - 水平对折时跳过下半部分的水平线
        if (sides === layoutSides.foldInHalf && foldLineType === '0' && v >= maxHeight / 2) {
          return;
        }
        // 垂直对折时，跳过右半部分的线段
        if (!(sides === layoutSides.foldInHalf && foldLineType === '1' && minX >= maxWidth / 2)) {
          doc.drawLine({x1: 0, y1: v, x2: minX, y2: v});
        }
        if (!(sides === layoutSides.foldInHalf && foldLineType === '1' && minX >= maxWidth / 2)) {
          doc.drawLine({x1: 0, y1: v + height, x2: minX, y2: v + height});
        }
        if (!(sides === layoutSides.foldInHalf && foldLineType === '1' && maxWidth >= maxWidth / 2)) {
          doc.drawLine({x1: maxWidth, y1: v, x2: maxX + width, y2: v});
        }
        if (!(sides === layoutSides.foldInHalf && foldLineType === '1' && maxWidth >= maxWidth / 2)) {
          doc.drawLine({x1: maxWidth, y1: v + height, x2: maxX + width, y2: v + height});
        }
      });


      if (sides === layoutSides.brochure && pageData.type !== 'back') {
        xList.forEach((v, vIndex) => {
          for (let j = 1; j < rows; j++) {
            const t = vIndex % 2;
            const y1 = yList[j - 1] + height;
            const y2 = yList[j];
            if(t === 0) {
              doc.drawLine({x1:v, y1, x2:v, y2});
            }
            if(t === 1) {
              doc.drawLine({x1:v + width, y1, x2:v + width, y2});
            }
          }
        })
        yList.forEach(v => {
          for (let i = 1; i < columns; i++) {
            const x1 = xList[i * 2 - 1] + width;
            const x2 = xList[i * 2];
            doc.drawLine({x1, y1:v, x2, y2:v});
            doc.drawLine({x1, y1:v + height, x2, y2:v + height});
          }
        })
      }
    }

    //image
    const { imageList, type, config: cardConfigList } = adjustBackPageImageOrder(pageData, Config);
    const imageRectList = getCutRectangleList(Config, {maxWidth, maxHeight}, false, pageData.type === 'back');
    const cutRectList = getCutRectangleList(Config, {maxWidth, maxHeight}, true, pageData.type === 'back');
    for(let i = 0; i < imageList.length; i++) {
      const image = imageList[i];
      const cardConfig = cardConfigList[i];
      const rect = {...imageRectList[i]};
      const rectCut = {...cutRectList[i]};
      if (image) {
        let rotation = 0;
        if(sides !== layoutSides.brochure && (cardConfig || type === 'back' && avoidDislocation)) {
          let cardBleedX = Math.min(fixFloat(cardConfig?.bleed?.[`${type}BleedX`] * scale / 100), scaledMarginX / 2);
          let cardBleedY = Math.min(fixFloat(cardConfig?.bleed?.[`${type}BleedY`] * scale / 100), scaledMarginY / 2);

          if(cardBleedX) {
            rect.x = rectCut.x - cardBleedX;
            rect.width = rectCut.width + cardBleedX * 2;
          }
          if(cardBleedY) {
            rect.y = rectCut.y - cardBleedY;
            rect.height = rectCut.height + cardBleedY * 2;
          }
        }
        if(isNeedRotation(Config, type === 'back')) {
          rotation = 180;
          rect.x = rect.x + rect.width;
          rect.y = rect.y - rect.height;
        }

        if(Config.marginFilling) {
          try {
            doc.setLineStyle({width:0, color: 0});
            const averageColor = imageAverageColorSet.get(image.path?.replaceAll('\\', ''));
            const xOffset = fixFloat(scaledMarginX / 2);
            const yOffset = fixFloat(scaledMarginY / 2);
            const rectFill = {
              x: rectCut.x - xOffset,
              y: rectCut.y - yOffset,
              width: rectCut.width + xOffset * 2,
              height: rectCut.height + yOffset * 2,
            }
            const checkX = rectFill.x < rect.x || rectFill.x + rectFill.width > rect.x + rect.width;
            const checkY = rectFill.y < rect.y || rectFill.y + rectFill.height > rect.y + rect.height;
            if(averageColor && (checkX || checkY)) {
              doc.fillRect({
                ...rectFill,
                color: averageColor
              })
            }
          } catch (e) {
            console.log('addImageBG error', e);
          }
        }

        try {
          const base64String = ImageStorage[image.path?.replaceAll('\\', '')];
          doc.drawImage({
            data: { base64: base64String, ext: image.ext, path: image.path },
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            rotation
          })
        } catch (e) {
          console.log('addImage error', e);
        }
      }
    }


    if ((cutline === '2' || cutline === '3')) {
      //cutline cross
      doc.setLineStyle({width: lineWeight * 0.3527, color: cutlineColor});
      const markRectList = getCutRectangleList(Config, {maxWidth, maxHeight}, true);
      const crossLength = fixFloat(2 * scale / 100);

      const { imageList } = adjustBackPageImageOrder(pageData, Config);

      markRectList.forEach((r, index) => {
        if (!imageList[index]) return;
        // 左上角
        doc.drawLine({x1: r.x - crossLength, y1: r.y, x2: r.x + crossLength, y2: r.y});
        doc.drawLine({x1: r.x, y1: r.y - crossLength, x2: r.x, y2: r.y + crossLength});

        // 右上角
        doc.drawLine({x1: r.x - crossLength + r.width, y1: r.y, x2: r.x + crossLength + r.width, y2: r.y});
        doc.drawLine({x1: r.x + r.width, y1: r.y - crossLength, x2: r.x + r.width, y2: r.y + crossLength});

        // 左下角
        doc.drawLine({x1: r.x - crossLength, y1: r.y + r.height, x2: r.x + crossLength, y2: r.y + r.height});
        doc.drawLine({x1: r.x, y1: r.y - crossLength + r.height, x2: r.x, y2: r.y + crossLength + r.height});

        // 右下角
        doc.drawLine({x1: r.x - crossLength + r.width, y1: r.y + r.height, x2: r.x + crossLength + r.width, y2: r.y + r.height});
        doc.drawLine({x1: r.x + r.width, y1: r.y - crossLength + r.height, x2: r.x + r.width, y2: r.y + crossLength + r.height});
      });
    }

    // 小册子模式：绘制页面拆分线
    if (sides === layoutSides.brochure && pageData.type !== 'back') {
      doc.setLineStyle({width: lineWeight * 0.3527, color: cutlineColor});

      const pageWidth = maxWidth / columns;
      const pageHeight = maxHeight / rows;

      // 绘制垂直分割线（实线）
      for (let i = 1; i < columns; i++) {
        const x = i * pageWidth + offsetX;
        doc.drawLine({x1: x, y1: 0, x2: x, y2: maxHeight});
      }

      // 绘制水平分割线（实线）
      for (let j = 1; j < rows; j++) {
        const y = j * pageHeight + offsetY;
        doc.drawLine({x1: 0, y1: y, x2: maxWidth, y2: y});
      }

      // 绘制折叠线（虚线）
      const markRectList = getCutRectangleList(Config, {maxWidth, maxHeight}, true);
      const xList = [...new Set(markRectList.map(r => r.x))];
      const yList = [...new Set(markRectList.map(r => r.y))];
      const width = markRectList[0].width;
      const height = markRectList[0].height;

      xList.forEach((v, vIndex) => {
        const isEvenColumn = vIndex % 2 === 0;

        if (isEvenColumn) {
          for (let j = 0; j <= rows; j++) {
            const y1 = j === 0 ? 0 : yList[j - 1] + height;
            const y2 = j === rows ? maxHeight : yList[j];

            doc.drawLine({
              x1: v + width,
              y1,
              x2: v + width,
              y2,
              dash: [1, 1]
            });
          }
        }
      });
    }
    doc.restoreState();

    if(isFoldInHalf && pageData.type === 'face') {
      continue
    }
    // 判断是否最后一页
    let isLastPage = false;
    if (pagesToRender && pagesToRender.length > 0) {
      // 有过滤条件：检查后续是否还有要渲染的页
      let hasMorePages = false;
      for (let i = index + 1; i < pagedImageList.length; i++) {
        if (pagesToRender.includes(i)) {
          hasMorePages = true;
          break;
        }
      }
      isLastPage = !hasMorePages;
    } else {
      // 无过滤条件：检查是否是最后一个索引
      isLastPage = (index === pagedImageList.length - 1);
    }
    // 不是最后一页才 addPage
    if (!isLastPage) {
      doc.addPage();
    }
  }


  return doc.finalize();
}

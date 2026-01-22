import { waitCondition } from '../../../../shared/functions';
import { getPendingList } from '../ImageActions';
import { getBorderAverageColors, getConfigStore } from '../../functions';
import { adjustBackPageImageOrder, getCutRectangleList, getPagedImageListByCardList, isNeedRotation } from './Utils';
import { layoutSides } from '../../../../shared/constants';
import { fixFloat, ImageStorage } from './Utils';

const imageAverageColorSet = new Map();

const loadImageAverageColor = async () => {
  imageAverageColorSet.clear();
  const jobs = Object.keys(ImageStorage).map(key => {
    return (async () => {
      if(!imageAverageColorSet.has(key)) {
        try {
          const averageColor = await getBorderAverageColors(ImageStorage[key]);
          imageAverageColorSet.set(key, averageColor);
        }
        catch (e) {
          console.log(e)
        }
      }
    })()
  });
  await Promise.all(jobs);
}



export const exportFile = async (doc, state) => {
  await waitCondition(() => getPendingList().size() === 0);
  const { Config } = getConfigStore();

  const {avoidDislocation, scale, sides, lineWeight, cutlineColor, foldLineType, offsetX, offsetY, marginX, marginY, bleedX, bleedY, showPageNumber, columns, rows, printOffsetX, printOffsetY} = Config;
  const maxWidth = fixFloat(doc.getPageSize().width);
  const maxHeight = fixFloat(doc.getPageSize().height);
  const isFoldInHalf = sides === layoutSides.foldInHalf;
  const scaledMarginX = fixFloat(marginX * scale / 100);
  const scaledMarginY = fixFloat(marginY * scale / 100);

  if(Config.marginFilling) {
    await loadImageAverageColor();
  }

  const pagedImageList = getPagedImageListByCardList(state, Config);
  let currentPage = 0;
  const totalPageCount = pagedImageList.filter(p => p.type === 'face').length;
  for (const index in pagedImageList) {
    const pageData = pagedImageList[index];
    const cutline = pageData.type === 'back'? (sides === layoutSides.brochure ? null : Config.bCutLine): Config.fCutLine;
    if(!(isFoldInHalf && pageData.type === 'back')) {
      index > 0 && doc.addPage();
    }
    doc.saveState();
    if(pageData.type === 'back' && [layoutSides.doubleSides, layoutSides.brochure].includes(sides)) {
      doc.setTransform({a:1, b:0, c:0, d:1, e:printOffsetX, f:printOffsetY * -1});
    }
    // page number
    if(pageData.type === 'face' && showPageNumber) {
      currentPage++;
      doc.drawText({
        text:`${currentPage}/${totalPageCount}`, x:3, y:5, size: 8
      })
    }


    if ((cutline === '1' || cutline === '3')) {
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
        if(t === 0 || sides !== layoutSides.brochure) {
          doc.drawLine({x1:v, y1:0, x2:v, y2:minY});
          doc.drawLine({x1:v, y1:maxHeight, x2:v, y2:maxY + height});
        }
        if(t === 1 || sides !== layoutSides.brochure) {
          doc.drawLine({x1:v + width, y1:0, x2:v + width, y2:minY});
          doc.drawLine({x1:v + width, y1:maxHeight, x2:v + width, y2:maxY + height});
        }
      })
      yList.forEach(v => {
        doc.drawLine({x1:0, y1:v, x2:minX, y2:v});
        doc.drawLine({x1:0, y1:v + height, x2:minX, y2:v + height});

        doc.drawLine({x1:maxWidth, y1:v, x2:maxX + width, y2:v});
        doc.drawLine({x1:maxWidth, y1:v + height, x2:maxX + width, y2:v + height});
      })

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
    for(let i = 0; i < imageList.length; i++) {
      const image = imageList[i];
      const cardConfig = cardConfigList[i];
      const rect = {...imageRectList[i]};
      if (image) {
        let rotation = 0;
        if(sides !== layoutSides.brochure && (cardConfig || type === 'back' && avoidDislocation)) {
          let cardBleedX = Math.min(fixFloat(cardConfig?.bleed?.[`${type}BleedX`] * scale / 100), scaledMarginX / 2);
          let cardBleedY = Math.min(fixFloat(cardConfig?.bleed?.[`${type}BleedY`] * scale / 100), scaledMarginY / 2);
          if(type === 'back' && avoidDislocation) {
            cardBleedX = scaledMarginX / 2;
            cardBleedY = scaledMarginY / 2;
          }
          if(cardBleedX) {
            rect.x = rect.x - cardBleedX;
            rect.width = rect.width + cardBleedX * 2;
          }
          if(cardBleedY) {
            rect.y = rect.y - cardBleedY;
            rect.height = rect.height + cardBleedY * 2;
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
            if(averageColor && !(marginX / 2 - bleedX === 0 && marginY / 2 - bleedY === 0)) {
              const xOffset = fixFloat(marginX / 2 - bleedX);
              const yOffset = fixFloat(marginY / 2 - bleedY);
              const rect = {...imageRectList[i]};
              doc.fillRect({
                x: rect.x - xOffset,
                y: rect.y - yOffset,
                width: rect.width + xOffset * 2,
                height: rect.height + yOffset * 2,
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

      markRectList.forEach(r => {
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
  }


  return doc.finalize();
}
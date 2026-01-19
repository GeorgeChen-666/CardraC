import { waitCondition } from '../../../../public/functions';
import { getPendingList } from '../ImageActions';
import { getBorderAverageColors, getConfigStore } from '../../functions';
import { adjustBackPageImageOrder, getCutRectangleList, getPagedImageListByCardList, isNeedRotation } from './Utils';
import { layoutSides } from '../../../../public/constants';
import { fixFloat, ImageStorage } from './Utils';

const { jsPDF } = require('jspdf');

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



export const exportPdf = async (state, onProgress) => {
  await waitCondition(() => getPendingList().size() === 0);
  const { Config } = getConfigStore();
  const format = (Config.pageSize.split(':')[0]).toLowerCase();
  const orientation = Config.landscape ? 'landscape' : 'portrait';
  const doc = new jsPDF({ format, orientation, compress: true });

  const {avoidDislocation, scale, sides, lineWeight, cutlineColor, foldLineType, offsetX, offsetY, marginX, marginY, bleedX, bleedY, showPageNumber, columns, rows, printOffsetX, printOffsetY} = Config;
  const maxWidth = fixFloat(doc.getPageWidth(0));
  const maxHeight = fixFloat(doc.getPageHeight(0));
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
    doc.saveGraphicsState();
    if(pageData.type === 'back' && [layoutSides.doubleSides, layoutSides.brochure].includes(sides)) {
      doc.setCurrentTransformationMatrix(new doc.Matrix(1, 0, 0, 1, printOffsetX, printOffsetY * -1));
    }
    // page number
    if(pageData.type === 'face' && showPageNumber) {
      currentPage++;
      doc.setFontSize(8);
      doc.text(`${currentPage}/${totalPageCount}`, 3, 5);
    }


    if ((cutline === '1' || cutline === '3')) {
      //cutline normal
      doc.setLineWidth(lineWeight * 0.3527);
      doc.setDrawColor(cutlineColor);
      const markRectList = getCutRectangleList(Config, doc, true);
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
          doc.line(v, 0, v, minY);
          doc.line(v, maxHeight, v, maxY + height);
        }
        if(t === 1 || sides !== layoutSides.brochure) {
          doc.line(v + width, 0, v + width, minY);
          doc.line(v + width, maxHeight, v + width, maxY + height);
        }
      })
      yList.forEach(v => {
        doc.line(0, v, minX, v);
        doc.line(0,v + height, minX, v + height);

        doc.line(maxWidth, v, maxX + width, v);
        doc.line(maxWidth, v + height, maxX + width, v + height);
      })

      if (sides === layoutSides.brochure && pageData.type !== 'back') {
        xList.forEach((v, vIndex) => {
          for (let j = 1; j < rows; j++) {
            const t = vIndex % 2;
            const y1 = yList[j - 1] + height;
            const y2 = yList[j];
            if(t === 0) {
              doc.line(v, y1, v, y2);
            }
            if(t === 1) {
              doc.line(v + width, y1, v + width, y2);
            }
          }
        })
        yList.forEach(v => {
          for (let i = 1; i < columns; i++) {
            const x1 = xList[i * 2 - 1] + width;
            const x2 = xList[i * 2];
            doc.line(x1, v, x2, v);
            doc.line(x1, v + height, x2, v + height);
          }
        })
      }
    }

    //image
    const { imageList, type, config: cardConfigList } = adjustBackPageImageOrder(pageData, Config);
    const imageRectList = getCutRectangleList(Config, doc, false, pageData.type === 'back');
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
            doc.setDrawColor(0);
            const averageColor = imageAverageColorSet.get(image.path?.replaceAll('\\', ''));
            if(averageColor && !(marginX / 2 - bleedX === 0 && marginY / 2 - bleedY === 0)) {
              doc.setFillColor(averageColor.r, averageColor.g, averageColor.b);
              const xOffset = fixFloat(marginX / 2 - bleedX);
              const yOffset = fixFloat(marginY / 2 - bleedY);
              const rect = {...imageRectList[i]};
              doc.rect(rect.x - xOffset, rect.y - yOffset, rect.width + xOffset * 2, rect.height + yOffset * 2, 'F');
            }
          } catch (e) {
            console.log('addImageBG error', e);
          }
        }

        try {
          const base64String = ImageStorage[image.path?.replaceAll('\\', '')];
          doc.addImage(base64String, image.ext, rect.x, rect.y, rect.width, rect.height, image.path, 'FAST', rotation);
        } catch (e) {
          console.log('addImage error', e);
        }
      }
    }


    if ((cutline === '2' || cutline === '3')) {
      //cutline cross
      doc.setLineWidth(lineWeight * 0.3527);
      doc.setDrawColor(cutlineColor);
      const markRectList = getCutRectangleList(Config, doc, true);
      const crossLength = fixFloat(2 * scale / 100)
      markRectList.forEach(r => {
        doc.line(r.x - crossLength, r.y, r.x + crossLength, r.y);
        doc.line(r.x,r.y - crossLength, r.x, r.y + crossLength);

        doc.line(r.x - crossLength + r.width, r.y, r.x + crossLength + r.width, r.y);
        doc.line(r.x + r.width,r.y - crossLength, r.x + r.width, r.y + crossLength);

        doc.line(r.x - crossLength, r.y + r.height, r.x + crossLength, r.y + r.height);
        doc.line(r.x,r.y - crossLength + r.height, r.x, r.y + crossLength + r.height);

        doc.line(r.x - crossLength + r.width, r.y + r.height, r.x + crossLength + r.width, r.y + r.height);
        doc.line(r.x + r.width,r.y - crossLength + r.height, r.x + r.width, r.y + crossLength + r.height);
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
          doc.setLineDash([0.5]);
          doc.line(parseFloat(x1) + offsetX, parseFloat(y1) + offsetY, parseFloat(x2) + offsetX, parseFloat(y2) + offsetY);
          doc.setLineDash([]);
        } catch (e) {
        }
      });
    }

    // 小册子模式：绘制页面拆分线
    if (sides === layoutSides.brochure && pageData.type !== 'back') {
      doc.setLineWidth(lineWeight * 0.3527);
      doc.setDrawColor(cutlineColor);

      const pageWidth = maxWidth / columns;
      const pageHeight = maxHeight / rows;
      // 绘制垂直分割线
      for (let i = 1; i < columns; i++) {
        const x = i * pageWidth + offsetX;
        doc.line(x, 0, x, maxHeight);
      }
      // 绘制水平分割线
      for (let j = 1; j < rows; j++) {
        const y = j * pageHeight + offsetY;
        doc.line(0, y, maxWidth, y);
      }
      // 在每个小区域中间绘制竖直虚线作为折叠线
      doc.setLineDash([1, 1]); // 设置虚线样式
      const markRectList = getCutRectangleList(Config, doc, true);
      const xList = [...new Set(markRectList.map(r => r.x))];
      const yList = [...new Set(markRectList.map(r => r.y))];
      const width = markRectList[0].width;
      const height = markRectList[0].height;
      xList.forEach((v, vIndex) => {
        for (let j = 0; j <= rows; j++) {
          const t = vIndex % 2;
          const y1 = j === 0 ? 0 : yList[j - 1] + height;
          const y2 = j === rows? maxHeight : yList[j];
          if(t === 0) {
            doc.line(v + width, y1, v + width, y2);
          }
        }
      })
      doc.setLineDash([]); // 恢复实线
    }
    doc.restoreGraphicsState();
  }


  return doc.output('blob');
}
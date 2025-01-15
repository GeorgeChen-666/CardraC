import { getImageBorderAverageColor } from './functions';

const { jsPDF } = require('jspdf');

export const ImageStorage = {
  '_emptyImg': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEV/f3+QyhsjAAAACklEQVQI\n' +
    '12NgAAAAAgAB4iG8MwAAAABJRU5ErkJggg=='
};
const imageAverageColorSet = new Map();
const loadImageAverageColor = async () => {
  const jobs = Object.keys(ImageStorage).map(key => {
    return (async () => {
      if(!imageAverageColorSet.has(key)) {
        try {
          const averageColor = await getImageBorderAverageColor(ImageStorage[key]);
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
const fixFloat = num => parseFloat(num.toFixed(2));
const getLocateByCenterBase = (x, y, doc, pageIndex = 1) => {
  const pageHeight = doc.getPageHeight(pageIndex);
  const pageWidth = doc.getPageWidth(pageIndex);
  const centerX = pageWidth / 2;
  const centerY = pageHeight / 2;
  return [fixFloat(x + centerX), fixFloat(y + centerY)];
};
const getPagedImageListByCardList = (state) => {
  const { CardList, Config } = state;
  let repeatCardList = CardList.reduce((arr, cv) => arr.concat(new Array(cv.repeat).fill(cv)), []);

  const pagedImageList = [];
  const sides = Config.sides;
  const size = Config.rows * Config.columns;
  if (sides === 'brochure') {
    const repeat = (4 - repeatCardList.length % 4) % 4;
    repeatCardList = repeatCardList.concat(new Array(repeat));
    const tempPairList = [];
    for (let i = 0; i < repeatCardList.length / 2; i++) {
      tempPairList.push([repeatCardList[i * 2], repeatCardList[i * 2 + 1]]);
    }
    const tempPairList2 = [];
    for (let i = 0; i < tempPairList.length / 2; i++) {
      tempPairList2.push(tempPairList[tempPairList.length - i - 1].reverse());
      tempPairList2.push(tempPairList[i]);
    }
    for (let i = 0; i < tempPairList2.length; i += size) {
      const result = tempPairList2.slice(i, i + size);
      pagedImageList.push({
        imageList: result.map(c => c[0]?.face),
        type: 'face',
      });
      pagedImageList.push({
        imageList: result.map(c => c[1]?.face),
        type: 'back',
      });
    }
  } else {
    for (let i = 0; i < repeatCardList.length; i += size) {
      const result = repeatCardList.slice(i, i + size);
      pagedImageList.push({
        imageList: result.map(c => c.face),
        type: 'face',
      });
      if (sides === 'double sides') {
        pagedImageList.push({
          imageList: result.map(c => c.back || Config.globalBackground),
          type: 'back',
        });
      }
    }
  }

  return pagedImageList;
};
const drawPageElements = async (doc, pageData, state) => {
  const { Config } = state;
  const hc = Config.columns;
  const vc = Config.rows;
  const scale = fixFloat(Config.scale / 100);
  let cardW = fixFloat(Config.cardWidth * scale);
  let cardH = fixFloat(Config.cardHeight * scale);
  let marginX = fixFloat(Config.marginX * scale);
  let marginY = fixFloat(Config.marginY * scale);
  const bleed = fixFloat(Config.bleed * scale);
  let bleedX = bleed;
  let bleedY = bleed;
  let offsetX = fixFloat(scale * Config.offsetX);
  let offsetY = fixFloat(scale * Config.offsetY);

  const maxWidth = fixFloat(doc.getPageWidth(0));
  const maxHeight = fixFloat(doc.getPageHeight(0));
  const lineWeight = Config.lineWeight;
  const cutlineColor = Config.cutlineColor;
  const avoidDislocation = Config.avoidDislocation;

  const landscape = Config.landscape;
  let flipWay = ['none', 'long-edge binding', 'short-edge binding'].indexOf(Config.flip);
  if (Config.sides === 'brochure') {
    flipWay = landscape ? 2 : 1;
  }
  const { imageList, type } = pageData;
  if (type === 'back') {
    if (landscape && flipWay === 1 || !landscape && flipWay === 2) {
      offsetY = offsetY * -1;
    }
    if (landscape && flipWay === 2 || !landscape && flipWay === 1) {
      offsetX = offsetX * -1;
    }
    if (avoidDislocation) {
      cardW = cardW + marginX;
      cardH = cardH + marginY;
      bleedX = marginX / 2;
      bleedY = marginY / 2;
      marginX = 0;
      marginY = 0;
    }
  }

  const [imageW, imageH] = [cardW + bleedX * 2, cardH + bleedY * 2];
  for (let xx = 0; xx < hc; xx++) {
    for (let yy = 0; yy < vc; yy++) {
      let cardRotation = 0;
      let cx = xx;
      let cy = yy;
      if (type === 'back') {
        if (flipWay === 1 && landscape || flipWay === 2 && !landscape) {//横长边 竖短边
          cardRotation = 180;
          cy = vc - cy - 1;
        } else if (flipWay === 1 && !landscape || flipWay === 2 && landscape) {//竖长边 横短边
          cx = hc - cx - 1;
        }
      }

      const cardIndex = yy * hc + xx;
      const image = imageList?.[cardIndex] || (type === 'back' ? Config.globalBackground : null);
      const imageX = (cx - hc / 2) * imageW + (cx - (hc - 1) / 2) * (marginX - bleedX * 2);
      const imageY = (cy - vc / 2) * imageH + (cy - (vc - 1) / 2) * (marginY - bleedY * 2);

      let [imageXc, imageYc] = getLocateByCenterBase(imageX, imageY, doc);
      if (cardRotation === 180) {
        imageXc = imageXc + imageW + offsetX;
        imageYc = imageYc - imageH + offsetY;
      } else {
        imageXc = imageXc + offsetX;
        imageYc = imageYc + offsetY;
      }

      if (image && Config.marginFilling) {
        try {
          const [imageXc, imageYc] = getLocateByCenterBase(imageX, imageY, doc);
          doc.setDrawColor(0);
          const averageColor = imageAverageColorSet.get(image.path?.replaceAll('\\', ''));
          if(averageColor) {
            doc.setFillColor(averageColor.r, averageColor.g, averageColor.b);
            doc.rect(imageXc - (marginX / 2 - bleedX), imageYc - (marginY / 2 - bleedY), cardW + marginX, cardH + marginY, 'F');
          }
        } catch (e) {
          console.log('addImageBG error', e);
        }
      }

      doc.setLineWidth(lineWeight * 0.3527);
      doc.setDrawColor(cutlineColor);
      if (Config.fCutLine === '2' || Config.fCutLine === '3') {
        const [imageXc, imageYc] = getLocateByCenterBase(imageX, imageY, doc); //avoid card rotation
        //add cross mark loc
        const crossMarks = new Set();
        crossMarks.add(`${imageXc + bleedX + offsetX},${imageYc + bleedY + offsetY}`);
        crossMarks.add(`${imageXc + imageW - bleedX + offsetX},${imageYc + imageH - bleedY + offsetY}`);
        crossMarks.add(`${imageXc + bleedX + offsetX},${imageYc + imageH - bleedY + offsetY}`);
        crossMarks.add(`${imageXc + imageW - bleedX + offsetX},${imageYc + bleedY + offsetY}`);
        crossMarks.forEach(cm => {
          const [x, y] = cm.split(',');
          try {
            doc.line(parseFloat(x) - fixFloat(2 * scale), parseFloat(y), parseFloat(x) + fixFloat(2 * scale), parseFloat(y));
            doc.line(parseFloat(x), parseFloat(y) - fixFloat(2 * scale), parseFloat(x), parseFloat(y) + fixFloat(2 * scale));
          } catch (e) {
          }
        });
      }

      if (Config.fCutLine === '1' || Config.fCutLine === '3') {
        const [imageXc, imageYc] = getLocateByCenterBase(imageX, imageY, doc); //avoid card rotation
        const normalMarks = new Set();
        //add normal mark loc
        if (cx === 0) {
          normalMarks.add(`0,${imageYc + bleedY + offsetY}-${imageXc + bleedX + offsetX},${imageYc + bleedY + offsetY}`);
          normalMarks.add(`0,${imageYc + imageH - bleedY + offsetY}-${imageXc + bleedX + offsetX},${imageYc + imageH - bleedY + offsetY}`);
        }
        if (cx === hc - 1) {
          normalMarks.add(`${imageXc + imageW - bleedX + offsetX},${imageYc + bleedY + offsetY}-${maxWidth},${imageYc + bleedY + offsetY}`);
          normalMarks.add(`${imageXc + imageW - bleedX + offsetX},${imageYc + imageH - bleedY + offsetY}-${maxWidth},${imageYc + imageH - bleedY + offsetY}`);
        }
        if (cy === 0) {
          normalMarks.add(`${imageXc + bleedX + offsetX},0-${imageXc + bleedX + offsetX},${imageYc + bleedY + offsetY}`);
          normalMarks.add(`${imageXc + imageW - bleedX + offsetX},0-${imageXc + imageW - bleedX + offsetX},${imageYc + bleedY + offsetY}`);
        }
        if (cy === vc - 1) {
          normalMarks.add(`${imageXc + bleedX + offsetX},${imageYc + imageH - bleedY + offsetY}-${imageXc + bleedX + offsetX},${maxHeight}`);
          normalMarks.add(`${imageXc + imageW - bleedX + offsetX},${imageYc + imageH - bleedY + offsetY}-${imageXc + imageW - bleedX + offsetX},${maxHeight}`);
        }
        normalMarks.forEach(nm => {
          const [loc1, loc2] = nm.split('-');
          const [x1, y1] = loc1.split(',');
          const [x2, y2] = loc2.split(',');
          try {
            doc.line(parseFloat(x1), parseFloat(y1), parseFloat(x2), parseFloat(y2));
          } catch (e) {
          }
        });
      }

      if (image) {
        try {
          const base64String = ImageStorage[image.path?.replaceAll('\\', '')];
          doc.addImage(base64String, image.ext, imageXc, imageYc, imageW, imageH, image.path, 'FAST', cardRotation);
        } catch (e) {
          console.log('addImage error', e);
        }
      }

    }
  }
};

export const exportPdf = async (state, onProgress) => {
  const { Config } = state;
  const format = (Config.pageSize.split(':')[0]).toLowerCase();
  const orientation = Config.landscape ? 'landscape' : 'portrait';
  const doc = new jsPDF({ format, orientation, compress: true });
  const pagedImageList = getPagedImageListByCardList(state);
  // const pageJobs = pagedImageList.map((pageData, index) => async () => {
  //   index > 0 && doc.addPage();
  //   await drawPageElements(doc, pageData, state);
  //   onProgress(parseInt((index / pagedImageList.length) * 100));
  // });
  // for (const job of pageJobs) {
  //   await job();
  // }
  if(Config.marginFilling) {
    await loadImageAverageColor();
  }
  for (const index in pagedImageList) {
    const pageData = pagedImageList[index];
    index > 0 && doc.addPage();
    await drawPageElements(doc, pageData, state);
    onProgress(parseInt((index / pagedImageList.length) * 100));
  }
  return doc.output('blob');
};

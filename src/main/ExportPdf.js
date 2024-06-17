const { jsPDF } = require('jspdf');

export const emptyImg = {
  path: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEV/f3+QyhsjAAAACklEQVQI\n' +
    '12NgAAAAAgAB4iG8MwAAAABJRU5ErkJggg==',
  ext: 'png',
};
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
        imageList: result.map(c => c[0]?.face || emptyImg),
        type: 'face',
      });
      pagedImageList.push({
        imageList: result.map(c => c[1]?.face || emptyImg),
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
          imageList: result.map(c => c.back || Config.globalBackground || emptyImg),
          type: 'back',
        });
      }
    }
  }

  return pagedImageList;
};
const drawPageElements = async (doc, pageData, state) => {
  const { Config, ImageStorage } = state;
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
  let offsetX = 1 * Config.offsetX;
  let offsetY = 1 * Config.offsetY;

  const maxWidth = fixFloat(doc.getPageWidth(0));
  const maxHeight = fixFloat(doc.getPageHeight(0));
  const lineWeight = Config.lineWeight;
  const cutlineColor = Config.cutlineColor;
  const avoidDislocation = Config.avoidDislocation;

  doc.setLineWidth(lineWeight * 0.3527);
  doc.setDrawColor(cutlineColor);

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
      bleedX = bleedX + marginX / 2;
      bleedY = bleedY + marginY / 2;
      marginX = 0;
      marginY = 0;
    }
  }
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
      const image = imageList?.[cardIndex] || (type === 'back' ? Config.globalBackground : null) || emptyImg;
      const cardX = (cx - hc / 2) * cardW + (cx - (hc - 1) / 2) * marginX;
      const cardY = (cy - vc / 2) * cardH + (cy - (vc - 1) / 2) * marginY;

      const [cardXc, cardYc] = getLocateByCenterBase(cardX, cardY, doc);
      let [imageXc, imageYc] = [cardXc, cardYc];
      if (cardRotation === 180) {
        imageXc = imageXc + cardW + offsetX;
        imageYc = imageYc - cardH + offsetY;
      } else {
        imageXc = imageXc + offsetX;
        imageYc = imageYc + offsetY;
      }

      if (Config.fCutLine === '2' || Config.fCutLine === '3') {
        //add cross mark loc
        const crossMarks = new Set();
        crossMarks.add(`${cardXc + bleedX + offsetX},${cardYc + bleedY + offsetY}`);
        crossMarks.add(`${cardXc + cardW - bleedX + offsetX},${cardYc + cardH - bleedY + offsetY}`);
        crossMarks.add(`${cardXc + bleedX + offsetX},${cardYc + cardH - bleedY + offsetY}`);
        crossMarks.add(`${cardXc + cardW - bleedX + offsetX},${cardYc + bleedY + offsetY}`);
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
        const normalMarks = new Set();
        //add normal mark loc
        if (cx === 0) {
          normalMarks.add(`0,${cardYc + bleedY + offsetY}-${cardXc + bleedX + offsetX},${cardYc + bleedY + offsetY}`);
          normalMarks.add(`0,${cardYc + cardH - bleedY + offsetY}-${cardXc + bleedX + offsetX},${cardYc + cardH - bleedY + offsetY}`);
        }
        if (cx === hc - 1) {
          normalMarks.add(`${cardXc + cardW - bleedX + offsetX},${cardYc + bleedY + offsetY}-${maxWidth},${cardYc + bleedY + offsetY}`);
          normalMarks.add(`${cardXc + cardW - bleedX + offsetX},${cardYc + cardH - bleedY + offsetY}-${maxWidth},${cardYc + cardH - bleedY + offsetY}`);
        }
        if (cy === 0) {
          normalMarks.add(`${cardXc + bleedX + offsetX},0-${cardXc + bleedX + offsetX},${cardYc + bleedY + offsetY}`);
          normalMarks.add(`${cardXc + cardW - bleedX + offsetX},0-${cardXc + cardW - bleedX + offsetX},${cardYc + bleedY + offsetY}`);
        }
        if (cy === vc - 1) {
          normalMarks.add(`${cardXc + bleedX + offsetX},${cardYc + cardH - bleedY + offsetY}-${cardXc + bleedX + offsetX},${maxHeight}`);
          normalMarks.add(`${cardXc + cardW - bleedX + offsetX},${cardYc + cardH - bleedY + offsetY}-${cardXc + cardW - bleedX + offsetX},${maxHeight}`);
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
          if (image === emptyImg) {
            doc.addImage(image.path, image.ext, imageXc, imageYc, cardW, cardH, image.path, 'NONE', cardRotation);
          } else {
            const base64String = ImageStorage[image.path?.replaceAll('\\', '')];
            doc.addImage(base64String, image.ext, imageXc, imageYc, cardW, cardH, image.path, 'FAST', cardRotation);
          }
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
  for (const index in pagedImageList) {
    const pageData = pagedImageList[index];
    index > 0 && doc.addPage();
    await drawPageElements(doc, pageData, state);
    onProgress(parseInt((index / pagedImageList.length) * 100));
  }
  return doc.output('blob');
};

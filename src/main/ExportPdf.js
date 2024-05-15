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
  const repeatCardList = CardList.reduce((arr, cv) => arr.concat(new Array(cv.repeat).fill(cv)), []);

  const pagedImageList = [];
  const sides = Config.sides;
  const size = Config.rows * Config.columns;
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
  return pagedImageList;
};
const drawPageElements = async (doc, pageData, state) => {
  const { Config, ImageStorage } = state;
  const hc = Config.columns;
  const vc = Config.rows;
  const scale = fixFloat(Config.scale / 100);
  const cardW = fixFloat(Config.cardWidth * scale);
  const cardH = fixFloat(Config.cardHeight * scale);
  const marginX = fixFloat(Config.marginX * scale);
  const marginY = fixFloat(Config.marginY * scale);
  const bleed = fixFloat(Config.bleed * scale);
  let offsetX = 1 * Config.offsetX;
  let offsetY = 1 * Config.offsetY;
  const crossMarks = new Set();
  const normalMarks = new Set();
  const maxWidth = fixFloat(doc.getPageWidth(0));
  const maxHeight = fixFloat(doc.getPageHeight(0));

  const landscape = Config.landscape;
  const flipWay = ['none', 'long-edge binding', 'short-edge binding'].indexOf(Config.flip);
  const { imageList, type } = pageData;
  if (type === 'back') {
    if (landscape && flipWay === 1 || !landscape && flipWay === 2) {
      offsetX = offsetX * -1;
    }
    if (landscape && flipWay === 2 || !landscape && flipWay === 1) {
      offsetY = offsetY * -1;
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
      if (image) {
        try {
          if (image === emptyImg) {
            doc.addImage(image.path, image.ext, imageXc, imageYc, cardW, cardH, image.path, 'NONE', cardRotation);
          } else {
            // const base64String = await readFileToBase64(image.path);
            doc.addImage(ImageStorage[image.path?.replaceAll('\\','')], image.ext, imageXc, imageYc, cardW, cardH, image.path, 'NONE', cardRotation);
          }
        } catch (e) {
          console.log('addImage error', e);
        }
      }
      if (Config.fCutLine === '2' || Config.fCutLine === '3') {
        //add cross mark loc
        crossMarks.add(`${cardXc + bleed + offsetX},${cardYc + bleed + offsetY}`);
        crossMarks.add(`${cardXc + cardW - bleed + offsetX},${cardYc + cardH - bleed + offsetY}`);
        crossMarks.add(`${cardXc + bleed + offsetX},${cardYc + cardH - bleed + offsetY}`);
        crossMarks.add(`${cardXc + cardW - bleed + offsetX},${cardYc + bleed + offsetY}`);
      }

      if (Config.fCutLine === '1' || Config.fCutLine === '3') {
        //add normal mark loc
        if (cx === 0) {
          normalMarks.add(`0,${cardYc + bleed + offsetY}-${cardXc + bleed + offsetX},${cardYc + bleed + offsetY}`);
          normalMarks.add(`0,${cardYc + cardH - bleed + offsetY}-${cardXc + bleed + offsetX},${cardYc + cardH - bleed + offsetY}`);
        }
        if (cx === hc - 1) {
          normalMarks.add(`${cardXc + cardW - bleed + offsetX},${cardYc + bleed + offsetY}-${maxWidth},${cardYc + bleed + offsetY}`);
          normalMarks.add(`${cardXc + cardW - bleed + offsetX},${cardYc + cardH - bleed + offsetY}-${maxWidth},${cardYc + cardH - bleed + offsetY}`);
        }
        if (cy === 0) {
          normalMarks.add(`${cardXc + bleed + offsetX},0-${cardXc + bleed + offsetX},${cardYc + bleed + offsetY}`);
          normalMarks.add(`${cardXc + cardW - bleed + offsetX},0-${cardXc + cardW - bleed + offsetX},${cardYc + bleed + offsetY}`);
        }
        if (cy === vc - 1) {
          normalMarks.add(`${cardXc + bleed + offsetX},${cardYc + cardH - bleed + offsetY}-${cardXc + bleed + offsetX},${maxHeight}`);
          normalMarks.add(`${cardXc + cardW - bleed + offsetX},${cardYc + cardH - bleed + offsetY}-${cardXc + cardW - bleed + offsetX},${maxHeight}`);
        }
      }

    }
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
  crossMarks.forEach(cm => {
    const [x, y] = cm.split(',');
    try {
      doc.line(parseFloat(x) - fixFloat(2 * scale), parseFloat(y), parseFloat(x) + fixFloat(2 * scale), parseFloat(y));
      doc.line(parseFloat(x), parseFloat(y) - fixFloat(2 * scale), parseFloat(x), parseFloat(y) + fixFloat(2 * scale));
    } catch (e) {
    }
  });
};

export const exportPdf = async (state, onProgress) => {
  const { Config } = state;
  const format = (Config.pageSize.split(':')[0]).toLowerCase();
  const orientation = Config.landscape ? 'landscape' : 'portrait';
  const doc = new jsPDF({ format, orientation });
  const pagedImageList = getPagedImageListByCardList(state);
  const pageJobs = pagedImageList.map((pageData, index) => async () => {
    index > 0 && doc.addPage();
    await drawPageElements(doc, pageData, state);
    onProgress(parseInt((index / pagedImageList.length) * 100));
  });
  for (const job of pageJobs) {
    await job();
  }
  return doc.output('blob');
};

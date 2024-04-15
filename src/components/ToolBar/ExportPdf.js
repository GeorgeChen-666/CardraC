import { jsPDF } from 'jspdf';

export const emptyImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEV/f3+QyhsjAAAACklEQVQI\n' +
  '12NgAAAAAgAB4iG8MwAAAABJRU5ErkJggg==';
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
        imageList: result.map(c => c.back || Config.globalBackground[0] || emptyImg),
        type: 'back',
      });
    }
  }
  return pagedImageList;
};
const drawPageElements = (doc, pageData, state) => {
  const { Config } = state;
  const hc = Config.columns;
  const vc = Config.rows;
  const cardW = Config.cardWidth;
  const cardH = Config.cardHeight;
  const marginX = Config.marginX;
  const marginY = Config.marginY;
  const bleed = Config.bleed;
  const crossMarks = new Set();
  const normalMarks = new Set();
  const maxWidth = fixFloat(doc.getPageWidth(0));
  const maxHeight = fixFloat(doc.getPageHeight(0));

  const landscape = Config.landscape;
  const flipWay = ['none', 'long-edge binding', 'short-edge binding'].indexOf(Config.flip);
  const { imageList, type } = pageData;
  for (let cx = 0; cx < hc; cx++) {
    for (let cy = 0; cy < vc; cy++) {
      const cardIndex = cy * hc + cx;
      const imagePath = imageList?.[cardIndex] || emptyImg;
      const cardX = (cx - hc / 2) * cardW + (cx - (hc - 1) / 2) * marginX;
      const cardY = (cy - vc / 2) * cardH + (cy - (vc - 1) / 2) * marginY;
      let cardRotation = 0;
      if (flipWay === 1 && landscape || flipWay === 2 && !landscape) {//横长边 竖短边
        // cardRotation = 180
        // cardX = (cx - hc / 2) * cardW + (cx - (hc - 1) / 2) * marginX;
        // cardY = vc- (cy - vc / 2) * cardH + (cy - (vc - 1) / 2) * marginY;
      } else if (flipWay === 1 && !landscape || flipWay === 2 && landscape) {//竖长边 横短边

      }
      const [cardXc, cardYc] = getLocateByCenterBase(cardX, cardY, doc);
      if (imagePath) {
        doc.addImage(imagePath, 'JPG', cardXc, cardYc, cardW, cardH, imagePath, 'NONE', cardRotation);
      }
      if (Config.fCutLine === '2' || Config.fCutLine === '3') {
        //add cross mark loc
        crossMarks.add(`${cardXc + bleed},${cardYc + bleed}`);
        crossMarks.add(`${cardXc + cardW - bleed},${cardYc + cardH - bleed}`);
        crossMarks.add(`${cardXc + bleed},${cardYc + cardH - bleed}`);
        crossMarks.add(`${cardXc + cardW - bleed},${cardYc + bleed}`);
      }

      if (Config.fCutLine === '1' || Config.fCutLine === '3') {
        //add normal mark loc
        if (cx === 0) {
          normalMarks.add(`0,${cardYc + bleed}-${cardXc + bleed},${cardYc + bleed}`);
          normalMarks.add(`0,${cardYc + cardH - bleed}-${cardXc + bleed},${cardYc + cardH - bleed}`);
        }
        if (cx === hc - 1) {
          normalMarks.add(`${cardXc + cardW - bleed},${cardYc + bleed}-${maxWidth},${cardYc + bleed}`);
          normalMarks.add(`${cardXc + cardW - bleed},${cardYc + cardH - bleed}-${maxWidth},${cardYc + cardH - bleed}`);
        }
        if (cy === 0) {
          normalMarks.add(`${cardXc + bleed},0-${cardXc + bleed},${cardYc + bleed}`);
          normalMarks.add(`${cardXc + cardW - bleed},0-${cardXc + cardW - bleed},${cardYc + bleed}`);
        }
        if (cy === vc - 1) {
          normalMarks.add(`${cardXc + bleed},${cardYc + cardH - bleed}-${cardXc + bleed},${maxHeight}`);
          normalMarks.add(`${cardXc + cardW - bleed},${cardYc + cardH - bleed}-${cardXc + cardW - bleed},${maxHeight}`);
        }
      }

    }
  }
  normalMarks.forEach(nm => {
    const [loc1, loc2] = nm.split('-');
    const [x1, y1] = loc1.split(',');
    const [x2, y2] = loc2.split(',');
    doc.line(parseFloat(x1), parseFloat(y1), parseFloat(x2), parseFloat(y2));
  });
  crossMarks.forEach(cm => {
    const [x, y] = cm.split(',');
    doc.line(parseFloat(x) - 2, parseFloat(y), parseFloat(x) + 2, parseFloat(y));
    doc.line(parseFloat(x), parseFloat(y) - 2, parseFloat(x), parseFloat(y) + 2);
  });
};
export const ExportPdf = (state) => {
  const { CardList, Config } = state;

  const repeatCardList = CardList.reduce((arr, cv) => arr.concat(new Array(cv.repeat).fill(cv)), []);
  // Default export is a4 paper, portrait, using millimeters for units
  const format = (Config.pageSize.split(':')[0]).toLowerCase();
  const orientation = Config.landscape ? 'landscape' : 'portrait';
  const doc = new jsPDF({ format, orientation });


  const pagedImageList = getPagedImageListByCardList(state);
  console.log(pagedImageList);
  pagedImageList.forEach((pageData, index) => {
    index > 0 && doc.addPage();//doc.addPage("a6", "l");
    drawPageElements(doc, pageData, state);
  });

  doc.save('a4.pdf');
};
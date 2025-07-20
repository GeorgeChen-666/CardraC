import { getBorderAverageColors, getConfigStore } from '../../functions';
import { layoutSides } from '../../../../public/constants';
import { fixFloat, getLocateByCenterBase, ImageStorage } from './Utils';

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


const getPagedImageListByCardList = ({ CardList, globalBackground }) => {
  const { Config } = getConfigStore();
  const isFoldInHalf = Config.sides === layoutSides.foldInHalf;
  let repeatCardList = CardList.reduce((arr, cv) => arr.concat(new Array(cv.repeat).fill(cv)), []);

  const pagedImageList = [];
  const sides = Config.sides;
  const size = Config.rows * Config.columns / (isFoldInHalf?2:1);

  for (let i = 0; i < repeatCardList.length; i += size) {
    const result = repeatCardList.slice(i, i + size);
    pagedImageList.push({
      imageList: result.map(c => c.face),
      type: 'face',
    });
    if ([layoutSides.doubleSides, layoutSides.foldInHalf].includes(sides)) {
      pagedImageList.push({
        imageList: result.map(c => c.back?.mtime ? c.back : globalBackground),
        type: 'back',
      });
    }
  }

  return pagedImageList;
};
const drawPageElements = async (doc, pageData, state, cb) => {
  const { Config } = getConfigStore();
  const hc = Config.columns;
  const vc = Config.rows;
  const scale = fixFloat(Config.scale / 100);
  let cardW = fixFloat(Config.cardWidth * scale);
  let cardH = fixFloat(Config.cardHeight * scale);
  let marginX = fixFloat(Config.marginX * scale);
  let marginY = fixFloat(Config.marginY * scale);
  let bleedX = fixFloat(Config.bleedX * scale);
  let bleedY = fixFloat(Config.bleedY * scale);
  let offsetX = fixFloat(scale * Config.offsetX);
  let offsetY = fixFloat(scale * Config.offsetY);

  const maxWidth = fixFloat(doc.getPageWidth(0));
  const maxHeight = fixFloat(doc.getPageHeight(0));
  const lineWeight = Config.lineWeight;
  const cutlineColor = Config.cutlineColor;
  const avoidDislocation = Config.avoidDislocation;
  const foldInHalfMargin = fixFloat(Config.foldInHalfMargin * scale);

  const isFoldInHalf = Config.sides === layoutSides.foldInHalf;
  const foldLineType = Config.foldLineType;

  const landscape = Config.landscape;
  let flipWay = ['none', 'long-edge binding', 'short-edge binding'].indexOf(Config.flip);

  const { imageList, type } = pageData;
  if (type === 'back') {
    if (landscape && flipWay === 1 || !landscape && flipWay === 2) {
      offsetY = offsetY * (isFoldInHalf ? 1 : -1);
    }
    if (landscape && flipWay === 2 || !landscape && flipWay === 1) {
      offsetX = offsetX * (isFoldInHalf ? 1 : -1);
    }
    if (avoidDislocation) {
      bleedX = 0;
      bleedY = 0;
      cardW = cardW + marginX;
      cardH = cardH + marginY;
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
      if(isFoldInHalf) {
        if (type === 'back') {
          if(foldLineType === '0') {
            cy = vc / 2 + cy;
            cardRotation = 180;
          }
          else {
            cx = hc / 2 + cx;
          }
        } else {
          if(foldLineType === '0') {
            cy = vc / 2 - cy - 1;
          }
          else {
            cx = hc / 2 - cx - 1;
          }
        }
      } else {
        if (type === 'back') {
          if (flipWay === 1 && landscape || flipWay === 2 && !landscape) {//横长边 竖短边
            cardRotation = 180;
            cy = vc - cy - 1;
          } else if (flipWay === 1 && !landscape || flipWay === 2 && landscape) {//竖长边 横短边
            cx = hc - cx - 1;
          }
        }
      }

      const cardIndex = (foldLineType === '1' && isFoldInHalf) ? xx * vc + yy : yy * hc + xx;
      let image = imageList?.[cardIndex];

      const imageX = (cx - hc / 2) * imageW + (cx - (hc - 1) / 2) * (marginX - bleedX * 2);
      const imageY = (cy - vc / 2) * imageH + (cy - (vc - 1) / 2) * (marginY - bleedY * 2);

      let [imageXc, imageYc] = getLocateByCenterBase(imageX, imageY, doc);

      if(isFoldInHalf) {
        if (type === 'back') {
          if(foldLineType === '0') imageYc = imageYc + foldInHalfMargin / 2;
          if(foldLineType === '1') imageXc = imageXc + foldInHalfMargin / 2;
        }
        else {
          if(foldLineType === '0') imageYc = imageYc - foldInHalfMargin / 2;
          if(foldLineType === '1') imageXc = imageXc - foldInHalfMargin / 2;
        }
      }
      if (cardRotation === 180) {
        imageXc = imageXc + imageW + offsetX;
        imageYc = imageYc - imageH + offsetY;
      } else {
        imageXc = imageXc + offsetX;
        imageYc = imageYc + offsetY;
      }

      if (image && Config.marginFilling) {
        try {
          doc.setDrawColor(0);
          const averageColor = imageAverageColorSet.get(image.path?.replaceAll('\\', ''));
          if(averageColor && !(marginX / 2 - bleedX === 0 && marginY / 2 - bleedY === 0)) {
            doc.setFillColor(averageColor.r, averageColor.g, averageColor.b);
            doc.rect(imageXc - (marginX / 2 - bleedX) + offsetX, imageYc - (marginY / 2 - bleedY) + offsetY, cardW + marginX, cardH + marginY, 'F');
          }
        } catch (e) {
          console.log('addImageBG error', e);
        }
      }

      doc.setLineWidth(lineWeight * 0.3527);
      doc.setDrawColor(cutlineColor);

      if ((Config.fCutLine === '1' || Config.fCutLine === '3')) {
        drawNormalMark(doc, cx, cy, type);
      }

      if (image) {
        try {
          const base64String = ImageStorage[image.path?.replaceAll('\\', '')];
          doc.addImage(base64String, image.ext, imageXc, imageYc, imageW, imageH, image.path, 'FAST', cardRotation);
          cb && cb();
        } catch (e) {
          console.log('addImage error', e);
        }
      }

      if ((Config.fCutLine === '2' || Config.fCutLine === '3')) {
        drawCrossMark(doc, cx, cy, type);
      }
    }
  }

  if(isFoldInHalf) {
    const dashMarks = new Set();
    foldLineType === '0' && dashMarks.add(`${0},${maxHeight / 2}-${maxWidth},${maxHeight / 2}`);
    foldLineType === '1' && dashMarks.add(`${maxWidth / 2},${0}-${maxWidth / 2},${maxHeight}`);
    dashMarks.forEach(nm => {
      const [loc1, loc2] = nm.split('-');
      const [x2, y2] = loc2.split(',');
      const [x1, y1] = loc1.split(',');
      try {
        doc.setLineDash([0.5]);
        doc.line(parseFloat(x1), parseFloat(y1) + offsetY, parseFloat(x2), parseFloat(y2) + offsetY);
        doc.setLineDash([]);
      } catch (e) {
      }
    });
  }

};

const drawNormalMark = ( doc, xx, yy, type ) => {
  const { Config } = getConfigStore();
  const hc = Config.columns;
  const vc = Config.rows;
  const scale = fixFloat(Config.scale / 100);
  let cardW = fixFloat(Config.cardWidth * scale);
  let cardH = fixFloat(Config.cardHeight * scale);
  let marginX = fixFloat(Config.marginX * scale);
  let marginY = fixFloat(Config.marginY * scale);
  let bleedX = fixFloat(Config.bleedX * scale);
  let bleedY = fixFloat(Config.bleedY * scale);
  let offsetX = fixFloat(scale * Config.offsetX);
  let offsetY = fixFloat(scale * Config.offsetY);
  const maxWidth = fixFloat(doc.getPageWidth(0));
  const maxHeight = fixFloat(doc.getPageHeight(0));
  const foldInHalfMargin = fixFloat(Config.foldInHalfMargin * scale);

  const isFoldInHalf = Config.sides === layoutSides.foldInHalf;
  const foldLineType = Config.foldLineType;

  const [imageW, imageH] = [cardW + bleedX * 2, cardH + bleedY * 2];
  const imageX = (xx - hc / 2) * imageW + (xx - (hc - 1) / 2) * (marginX - bleedX * 2);
  const imageY = (yy - vc / 2) * imageH + (yy - (vc - 1) / 2) * (marginY - bleedY * 2);

  let [imageXc, imageYc] = getLocateByCenterBase(imageX, imageY, doc); //avoid card rotation
  let ignoreMark = false;
  if(isFoldInHalf) {
    if (type === 'back') {
      if(foldLineType === '0') {
        imageYc = imageYc + foldInHalfMargin / 2;
        yy === 2 && (ignoreMark = true);
      }
      if(foldLineType === '1') {
        imageXc = imageXc + foldInHalfMargin / 2;
        xx === 2 && (ignoreMark = true);
      }
    }
    else {
      if(foldLineType === '0') {
        imageYc = imageYc - foldInHalfMargin / 2;
        yy === -1 && (ignoreMark = true);
      }
      if(foldLineType === '1') {
        imageXc = imageXc - foldInHalfMargin / 2;
        xx === -1 && (ignoreMark = true);
      }

    }
  }
  let bleedXM = bleedX;
  let bleedYM = bleedY;

  const normalMarks = new Set();
  //add normal mark loc
  if (xx === 0) {
    normalMarks.add(`0,${imageYc + bleedYM + offsetY}-${imageXc + bleedXM + offsetX},${imageYc + bleedYM + offsetY}`);
    normalMarks.add(`0,${imageYc + imageH - bleedYM + offsetY}-${imageXc + bleedXM + offsetX},${imageYc + imageH - bleedYM + offsetY}`);
  }
  if (xx === hc - 1) {
    normalMarks.add(`${imageXc + imageW - bleedXM + offsetX},${imageYc + bleedYM + offsetY}-${maxWidth},${imageYc + bleedYM + offsetY}`);
    normalMarks.add(`${imageXc + imageW - bleedXM + offsetX},${imageYc + imageH - bleedYM + offsetY}-${maxWidth},${imageYc + imageH - bleedYM + offsetY}`);
  }
  if (yy === 0) {
    normalMarks.add(`${imageXc + bleedXM + offsetX},0-${imageXc + bleedXM + offsetX},${imageYc + bleedYM + offsetY}`);
    normalMarks.add(`${imageXc + imageW - bleedXM + offsetX},0-${imageXc + imageW - bleedXM + offsetX},${imageYc + bleedYM + offsetY}`);
  }
  if (yy === vc - 1) {
    normalMarks.add(`${imageXc + bleedXM + offsetX},${imageYc + imageH - bleedYM + offsetY}-${imageXc + bleedXM + offsetX},${maxHeight}`);
    normalMarks.add(`${imageXc + imageW - bleedXM + offsetX},${imageYc + imageH - bleedYM + offsetY}-${imageXc + imageW - bleedXM + offsetX},${maxHeight}`);
  }
  !ignoreMark && normalMarks.forEach(nm => {
    const [loc1, loc2] = nm.split('-');
    const [x1, y1] = loc1.split(',');
    const [x2, y2] = loc2.split(',');
    try {
      doc.line(parseFloat(x1), parseFloat(y1), parseFloat(x2), parseFloat(y2));
    } catch (e) {
    }
  });
}

const drawCrossMark = ( doc, xx, yy, type ) => {
  const { Config } = getConfigStore();
  const hc = Config.columns;
  const vc = Config.rows;
  const scale = fixFloat(Config.scale / 100);
  let cardW = fixFloat(Config.cardWidth * scale);
  let cardH = fixFloat(Config.cardHeight * scale);
  let marginX = fixFloat(Config.marginX * scale);
  let marginY = fixFloat(Config.marginY * scale);
  let bleedX = fixFloat(Config.bleedX * scale);
  let bleedY = fixFloat(Config.bleedY * scale);
  let offsetX = fixFloat(scale * Config.offsetX);
  let offsetY = fixFloat(scale * Config.offsetY);

  const foldInHalfMargin = fixFloat(Config.foldInHalfMargin * scale);

  const isFoldInHalf = Config.sides === layoutSides.foldInHalf;
  const foldLineType = Config.foldLineType;

  const [imageW, imageH] = [cardW + bleedX * 2, cardH + bleedY * 2];
  const imageX = (xx - hc / 2) * imageW + (xx - (hc - 1) / 2) * (marginX - bleedX * 2);
  const imageY = (yy - vc / 2) * imageH + (yy - (vc - 1) / 2) * (marginY - bleedY * 2);

  let [imageXc, imageYc] = getLocateByCenterBase(imageX, imageY, doc); //avoid card rotation
  let ignoreMark = false;
  if(isFoldInHalf) {
    if (type === 'back') {
      if(foldLineType === '0') {
        imageYc = imageYc + foldInHalfMargin / 2;
        yy === 2 && (ignoreMark = true);
      }
      if(foldLineType === '1') {
        imageXc = imageXc + foldInHalfMargin / 2;
        xx === 2 && (ignoreMark = true);
      }
    }
    else {
      if(foldLineType === '0') {
        imageYc = imageYc - foldInHalfMargin / 2;
        yy === -1 && (ignoreMark = true);
      }
      if(foldLineType === '1') {
        imageXc = imageXc - foldInHalfMargin / 2;
        xx === -1 && (ignoreMark = true);
      }

    }
  }
  let bleedXM = bleedX;
  let bleedYM = bleedY;

  //add cross mark loc
  const crossMarks = new Set();
  crossMarks.add(`${imageXc + bleedXM + offsetX},${imageYc + bleedYM + offsetY}`);
  crossMarks.add(`${imageXc + imageW - bleedXM + offsetX},${imageYc + imageH - bleedYM + offsetY}`);
  crossMarks.add(`${imageXc + bleedXM + offsetX},${imageYc + imageH - bleedYM + offsetY}`);
  crossMarks.add(`${imageXc + imageW - bleedXM + offsetX},${imageYc + bleedYM + offsetY}`);
  !ignoreMark && crossMarks.forEach(cm => {
    const [x, y] = cm.split(',');
    try {
      doc.line(parseFloat(x) - fixFloat(2 * scale), parseFloat(y), parseFloat(x) + fixFloat(2 * scale), parseFloat(y));
      doc.line(parseFloat(x), parseFloat(y) - fixFloat(2 * scale), parseFloat(x), parseFloat(y) + fixFloat(2 * scale));
    } catch (e) {
    }
  });
}

const drawPageNumber = async (doc, state, pageIndex, totalPages) => {
  const { Config } = getConfigStore();
  if(!Config.showPageNumber) {
    return;
  }
  doc.setFontSize(8);
  doc.text(`${pageIndex}/${totalPages}`, 3, 5);
}

export const drawPdfNormal = async (doc, state, onProgress) => {
  const { Config } = getConfigStore();
  const isFoldInHalf = Config.sides === layoutSides.foldInHalf;
  const pagedImageList = getPagedImageListByCardList(state);
  let currentImageNumber = 0;
  const totalImageNumber = [].concat(...pagedImageList.map(l=>l.imageList)).length;
  if(Config.marginFilling) {
    await loadImageAverageColor();
  }
  let currentPage = 0;
  const totalPageCount = pagedImageList.filter(p => p.type === 'face').length;
  for (const index in pagedImageList) {
    const pageData = pagedImageList[index];
    if(!(isFoldInHalf && pageData.type === 'back')) {
      index > 0 && doc.addPage();
    }

    if(pageData.type === 'face') {
      currentPage++;
      await drawPageNumber(doc,state,currentPage, totalPageCount);
    }
    await drawPageElements(doc, pageData, state, p => {
      onProgress(++currentImageNumber / totalImageNumber);
    });
  }
}
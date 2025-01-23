import { layoutSides } from '../../../../public/constants';
import { fixFloat, getLocateByCenterBase, ImageStorage } from './Utils';

const getPagedImageListByCardList = (state) => {
  const { CardList, Config } = state;
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

  if(brochureRepeatPerPage) {
    for (let i = 0; i < tempPairList2.length; i += 2) {
      const result = tempPairList2.slice(i, i + 2);
      const repeatResult = Array(size / 2).fill(result).flat(1);
      pagedImageList.push({
        imageList: repeatResult.map(c => c[0]?.face),
        type: 'face',
      });
      pagedImageList.push({
        imageList: repeatResult.map(c => c[1]?.face),
        type: 'back',
      });
    }
  }
  else {
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
  }
  return pagedImageList;
};

const drawPageElements = async (doc, pageData, state) => {
  const { Config } = state;
  const hc = Config.columns * 2;
  const vc = Config.rows;
  const scale = fixFloat(Config.scale / 100);
  let cardW = fixFloat(Config.cardWidth * scale);
  let cardH = fixFloat(Config.cardHeight * scale);
  const bleedX = fixFloat(Config.bleedX * scale);
  const bleedY = fixFloat(Config.bleedX * scale);
  let offsetX = fixFloat(scale * Config.offsetX);
  let offsetY = fixFloat(scale * Config.offsetY);

  const maxWidth = fixFloat(doc.getPageWidth(0));
  const maxHeight = fixFloat(doc.getPageHeight(0));
  const maxWidthSplited = maxWidth / Config.columns;
  const maxHeightSplited = maxHeight / Config.rows;

  const lineWeight = Config.lineWeight;
  const cutlineColor = Config.cutlineColor;

  const landscape = Config.landscape;
  let flipWay = ['none', 'long-edge binding', 'short-edge binding'].indexOf(Config.flip);

  const { imageList, type } = pageData;
  if (type === 'back') {
    if (landscape && flipWay === 1 || !landscape && flipWay === 2) {
      offsetY = offsetY * -1;
    }
    if (landscape && flipWay === 2 || !landscape && flipWay === 1) {
      offsetX = offsetX * -1;
    }

    // if (avoidDislocation) {
    //   cardW = cardW + marginX;
    //   cardH = cardH + marginY;
    //   bleedX = marginX / 2;
    //   bleedY = marginY / 2;
    //   marginX = 0;
    //   marginY = 0;
    // }
  }

  const [imageW, imageH] = [cardW + bleedX, cardH + bleedY * 2];
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
      const imageX = (cx - hc / 2) * maxWidthSplited / 2 + (cx % 2 === 0? (maxWidthSplited / 2 - imageW) : 0);
      const imageY = (cy - vc / 2) * maxHeightSplited + (maxHeightSplited - imageH) / 2;

      let [imageXc, imageYc] = getLocateByCenterBase(imageX, imageY, doc);
      if (cardRotation === 180) {
        imageXc = imageXc + imageW + offsetX;
        imageYc = imageYc - imageH + offsetY;
      } else {
        imageXc = imageXc + offsetX;
        imageYc = imageYc + offsetY;
      }

      doc.setLineWidth(lineWeight * 0.3527);
      doc.setDrawColor(cutlineColor);

      const dashMarks = new Set();
      if(cx % 2 === 1) {
        doc.setFontSize(8);
        doc.text(`${imageXc + offsetX}`, imageXc + offsetX, cy * maxHeightSplited);
        dashMarks.add(`${imageXc + offsetX},${cy * maxHeightSplited}-${imageXc + offsetX},${imageYc + bleedY + offsetY}`);
        dashMarks.add(`${imageXc + offsetX},${imageYc + imageH - bleedY + offsetY}-${imageXc + offsetX},${(cy + 1) * maxHeightSplited}`);
      }

      dashMarks.forEach(nm => {
        const [loc1, loc2] = nm.split('-');
        const [x1, y1] = loc1.split(',');
        const [x2, y2] = loc2.split(',');
        try {
          doc.setLineDash([0.5]);
          doc.line(parseFloat(x1), parseFloat(y1), parseFloat(x2), parseFloat(y2));
          doc.setLineDash([]);
        } catch (e) {
        }
      });

      if (Config.fCutLine === '1' || Config.fCutLine === '3') {
        const [imageXc, imageYc] = getLocateByCenterBase(imageX, imageY, doc); //avoid card rotation
        const normalMarks = new Set();
        //add normal mark loc
        if (cx % 2 === 0) {
          normalMarks.add(`${cx / 2 * maxWidthSplited},${imageYc + bleedY + offsetY}-${imageXc + bleedX + offsetX},${imageYc + bleedY + offsetY}`);
          normalMarks.add(`${cx / 2 * maxWidthSplited},${imageYc + imageH - bleedY + offsetY}-${imageXc + bleedX + offsetX},${imageYc + imageH - bleedY + offsetY}`);

          normalMarks.add(`${imageXc + bleedX + offsetX},${cy * maxHeightSplited}-${imageXc + bleedX + offsetX},${imageYc + bleedY + offsetY}`);
          normalMarks.add(`${imageXc + bleedX + offsetX},${imageYc + imageH - bleedY + offsetY}-${imageXc + bleedX + offsetX},${(cy + 1) * maxHeightSplited}`);
        }

        if (cx % 2 === 1) {
          normalMarks.add(`${imageXc + imageW - bleedX + offsetX},${imageYc + bleedY + offsetY}-${(cx + 1) / 2 * maxWidthSplited},${imageYc + bleedY + offsetY}`);
          normalMarks.add(`${imageXc + imageW - bleedX + offsetX},${imageYc + imageH - bleedY + offsetY}-${(cx + 1) / 2 * maxWidthSplited},${imageYc + imageH - bleedY + offsetY}`);

          normalMarks.add(`${imageXc + imageW - bleedX + offsetX},${cy * maxHeightSplited}-${imageXc + imageW - bleedX + offsetX},${imageYc + bleedY + offsetY}`);
          normalMarks.add(`${imageXc + imageW - bleedX + offsetX},${imageYc + imageH - bleedY + offsetY}-${imageXc + imageW - bleedX + offsetX},${(cy + 1) * maxHeightSplited}`);
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

      if (Config.fCutLine === '2' || Config.fCutLine === '3') {
        const [imageXc, imageYc] = getLocateByCenterBase(imageX, imageY, doc); //avoid card rotation
        //add cross mark loc
        const crossMarks = new Set();
        if (cx % 2 === 0) {
          crossMarks.add(`${imageXc + bleedX + offsetX},${imageYc + bleedY + offsetY}`);
          crossMarks.add(`${imageXc + bleedX + offsetX},${imageYc + imageH - bleedY + offsetY}`);
        }
        if (cx % 2 === 1) {
          crossMarks.add(`${imageXc + imageW - bleedX + offsetX},${imageYc + imageH - bleedY + offsetY}`);
          crossMarks.add(`${imageXc + imageW - bleedX + offsetX},${imageYc + bleedY + offsetY}`);
        }

        crossMarks.forEach(cm => {
          const [x, y] = cm.split(',');
          try {
            doc.line(parseFloat(x) - fixFloat(2 * scale), parseFloat(y), parseFloat(x) + fixFloat(2 * scale), parseFloat(y));
            doc.line(parseFloat(x), parseFloat(y) - fixFloat(2 * scale), parseFloat(x), parseFloat(y) + fixFloat(2 * scale));
          } catch (e) {
          }
        });
      }

      //draw page split line
      for(let x= 0; x < Config.columns; x++) {
        for (let y= 0; y < Config.rows; y++) {
          const yy = parseFloat((y+1) * maxHeightSplited) + offsetY;
          const xx = parseFloat((x+1) * maxWidthSplited) + offsetX;
          y < Config.rows - 1 && doc.line(0, yy, xx, yy);
          x < Config.columns - 1 && doc.line(xx, 0, xx, yy);
        }
      }

    }
  }
};
const drawPageNumber = async (doc, state, pageIndex, totalPages) => {
  const { Config } = state;
  const { brochureRepeatPerPage } = Config;
  const maxWidth = fixFloat(doc.getPageWidth(0));
  const maxHeight = fixFloat(doc.getPageHeight(0));
  const maxWidthSplited = maxWidth / Config.columns;
  const maxHeightSplited = maxHeight / Config.rows;
  doc.setFontSize(8);
  if(brochureRepeatPerPage) {
    doc.text(`${pageIndex}/${totalPages}`, 3, 5);
  } else {
    for(let x = 0;x<Config.columns;x++) {
      for(let y = 0; y <Config.rows;y++) {
        const pageIndexB = 1 + (pageIndex - 1) * Config.columns * Config.rows + x + y * Config.columns
        const totalPagesB = totalPages * Config.columns * Config.rows;
        doc.text(`${pageIndexB}/${totalPagesB}`, 3 + x * maxWidthSplited, 5 + y * maxHeightSplited);
      }
    }
  }
}
export const drawPdfBrochure = async (doc, state, onProgress) => {
  const pagedImageList = getPagedImageListByCardList(state);
  let currentPage = 0;
  const totalPageCount = pagedImageList.filter(p => p.type === 'face').length;
  for (const index in pagedImageList) {
    const pageData = pagedImageList[index];
    index > 0 && doc.addPage();
    if(pageData.type === 'face') {
      currentPage++;
      await drawPageNumber(doc,state,currentPage, totalPageCount);
    }
    await drawPageElements(doc, pageData, state);
    onProgress(parseInt((index / pagedImageList.length) * 100));
  }
}
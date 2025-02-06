export const defaultImageStorage = {
  '_emptyImg': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEV/f3+QyhsjAAAACklEQVQI\n' +
    '12NgAAAAAgAB4iG8MwAAAABJRU5ErkJggg=='
}
export const ImageStorage = { ...defaultImageStorage};

export const fixFloat = num => parseFloat(num.toFixed(2));

export const getLocateByCenterBase = (x, y, doc, pageIndex = 1) => {
  const pageHeight = doc.getPageHeight(pageIndex);
  const pageWidth = doc.getPageWidth(pageIndex);
  const centerX = pageWidth / 2;
  const centerY = pageHeight / 2;
  return [fixFloat(x + centerX), fixFloat(y + centerY)];
};
import { jsPDF } from 'jspdf';
import { IAdapter } from './IAdapter';

const getPdfImageFormat = ({ base64, ext }) => {
  const normalizedExt = String(ext || '').toLowerCase();
  const mimeMatch = typeof base64 === 'string'
    ? base64.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,/i)
    : null;
  const normalizedMimeExt = mimeMatch?.[1]?.toLowerCase();
  const format = normalizedMimeExt || normalizedExt;

  if (['jpg', 'jpeg'].includes(format)) return 'JPEG';
  if (format === 'webp') return 'WEBP';
  if (format === 'bmp') return 'BMP';
  if (format === 'gif') return 'GIF';
  return 'PNG';
};

export class JsPDFAdapter extends IAdapter {
  constructor(config) {
    super();
    let width = config.pageWidth;
    let height = config.pageHeight;
    if (config.landscape) {
      [width, height] = [height, width];
    }
    this.doc = new jsPDF({
      orientation: config.landscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [width, height],
      compress: true,
      background: "transparent"
    });
  }

  addPage() {
    this.doc.addPage();
  }

  saveState() {
    this.doc.saveGraphicsState();
  }

  restoreState() {
    this.doc.restoreGraphicsState();
  }

  setTransform({ a, b, c, d, e, f }) {
    this.doc.setCurrentTransformationMatrix(new this.doc.Matrix(a, b, c, d, e, f));
  }

  drawText({ text, x, y, size = 12 }) {
    this.doc.setFontSize(size);
    this.doc.text(text, x, y);
  }

  setLineStyle({ width, color }) {
    this.doc.setLineWidth(width);
    this.doc.setDrawColor(color);
  }

  drawLine({ x1, y1, x2, y2, dash }) {
    if (dash) this.doc.setLineDash(dash);
    this.doc.line(x1, y1, x2, y2);
    if (dash) this.doc.setLineDash([]);
  }

  fillRect({ x, y, width, height, color }) {
    this.doc.setFillColor(color.r, color.g, color.b);
    this.doc.rect(x, y, width, height, 'F');
  }

  drawImage({ data, x, y, width, height, rotation = 0 }) {
    this.doc.addImage(data.base64, getPdfImageFormat(data), x, y, width, height, data.path, 'FAST', rotation);
  }

  getPageSize() {
    return {
      width: this.doc.getPageWidth(0),
      height: this.doc.getPageHeight(0)
    };
  }

  finalize() {
    return this.doc.output('arraybuffer');
  }
}

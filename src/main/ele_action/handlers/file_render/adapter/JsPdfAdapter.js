import { jsPDF } from 'jspdf';
import { IAdapter } from './IAdapter';

export class JsPDFAdapter extends IAdapter {
  constructor(config) {
    super();
    const format = config.pageSize.split(':')[0].toLowerCase();
    const orientation = config.landscape ? 'landscape' : 'portrait';
    this.doc = new jsPDF({ format, orientation, compress: true });
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
    this.doc.addImage(data.base64, data.ext, x, y, width, height, data.path, 'FAST', rotation);
  }

  getPageSize() {
    return {
      width: this.doc.getPageWidth(0),
      height: this.doc.getPageHeight(0)
    };
  }

  finalize() {
    return this.doc.output('blob');
  }
}

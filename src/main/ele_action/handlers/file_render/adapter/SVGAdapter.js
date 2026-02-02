// SVGAdapter.js
import { IAdapter } from './IAdapter';
import { OverviewStorage, ImageStorage } from '../utils';

const displayScale = 10;

export class SVGAdapter extends IAdapter {
  constructor(config, quality = 'high', useAppLinks = false) {
    super();
    this.config = config;
    this.useAppLinks = useAppLinks;
    this.imageQuality = quality;

    this.pages = [];
    this.currentPageIndex = -1;
    this.currentPage = null;
    this.transformStack = [];
    this.currentTransform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

    const [width, height] = this.parsePageSize(config.pageSize);

    if (config.landscape) {
      this.pageWidth = height;
      this.pageHeight = width;
    } else {
      this.pageWidth = width;
      this.pageHeight = height;
    }

    console.log('SVG Page Size:', {
      width: this.pageWidth,
      height: this.pageHeight,
      landscape: config.landscape
    });

    this.createNewPage();
  }

  parsePageSize(pageSize) {
    const parts = pageSize.split(':');
    if (parts.length === 2) {
      const [width, height] = parts[1].split(',').map(Number);
      return [width, height];
    }
    return [595, 842];
  }

  createNewPage() {
    this.currentPageIndex++;
    this.currentPage = {
      index: this.currentPageIndex,
      elements: []
    };
    this.pages.push(this.currentPage);
  }

  addPage() {
    this.createNewPage();
  }

  getPageSize() {
    return {
      width: this.pageWidth,
      height: this.pageHeight
    };
  }

  setTransform({ a = 1, b = 0, c = 0, d = 1, e = 0, f = 0 }) {
    this.currentTransform = { a, b, c, d, e, f };
  }

  saveState() {
    this.transformStack.push({ ...this.currentTransform });
  }

  restoreState() {
    if (this.transformStack.length > 0) {
      this.currentTransform = this.transformStack.pop();
    }
  }

  applyTransform(x, y) {
    const { a, b, c, d, e, f } = this.currentTransform;
    return {
      x: a * x + c * y + e,
      y: b * x + d * y + f
    };
  }

  setLineStyle({ width, color }) {
    this.currentLineWidth = width;
    this.currentLineColor = color;
  }

  drawImage({ data, x, y, width, height, rotation = 0 }) {
    const imagePathKey = data.path.replaceAll('\\', '');

    let imageSource;
    if (this.useAppLinks) {
      const quality = this.imageQuality === 'high' ? 'high' : 'low';
      imageSource = `cardrac://image/${imagePathKey}?quality=${quality}`;
    } else {
      const storage = this.imageQuality === 'low' ? OverviewStorage : ImageStorage;
      imageSource = storage[imagePathKey] || '';
    }

    let adjustedX = x;
    let adjustedY = y;

    if (rotation === 180) {
      adjustedX = x - width;
      adjustedY = y + height;
    }
    const transformed = this.applyTransform(adjustedX, adjustedY);
    this.currentPage.elements.push({
      type: 'image',
      href: imageSource,
      x: transformed.x,
      y: transformed.y,
      width,
      height,
      rotation,
      path: data.path
    });
  }

  drawText({ text, x, y, size = 12 }) {
    const transformed = this.applyTransform(x, y);
    this.currentPage.elements.push({
      type: 'text',
      text,
      x: transformed.x,
      y: transformed.y,
      size: Math.floor(size / 2.5)
    });
  }

  drawLine({ x1, y1, x2, y2, dash }) {
    const transformed1 = this.applyTransform(x1, y1);
    const transformed2 = this.applyTransform(x2, y2);

    this.currentPage.elements.push({
      type: 'line',
      x1: transformed1.x,
      y1: transformed1.y,
      x2: transformed2.x,
      y2: transformed2.y,
      dash,
      width: this.currentLineWidth || 1,
      color: this.currentLineColor || '#000000'
    });
  }

  fillRect({ x, y, width, height, color }) {
    const transformed = this.applyTransform(x, y);
    this.currentPage.elements.push({
      type: 'rect',
      x: transformed.x,
      y: transformed.y,
      width,
      height,
      color
    });
  }

  // ✅ 修改：按绘制顺序渲染，不分组
  generatePageSVG(page) {
    const svg = `<svg 
    width="${this.pageWidth * displayScale}" 
    height="${this.pageHeight * displayScale}" 
    viewBox="0 0 ${this.pageWidth * displayScale} ${this.pageHeight * displayScale}"
    xmlns="http://www.w3.org/2000/svg">
    <rect width="${this.pageWidth * displayScale}" height="${this.pageHeight * displayScale}" fill="white"/>
    ${page.elements.map(el => this.renderElement(el)).join('\n')}
  </svg>`;
    return svg;
  }

  renderElement(el) {
    const s = displayScale;

    switch (el.type) {
      case 'image':
        if (!el.href) return '';
        const centerX = (el.x + el.width / 2) * s;
        const centerY = (el.y + el.height / 2) * s;

        return `<image 
    href="${el.href}" 
    x="${el.x * s}" 
    y="${el.y * s}" 
    width="${el.width * s}" 
    height="${el.height * s}" 
    preserveAspectRatio="none"
    transform="rotate(${el.rotation}, ${centerX}, ${centerY})" />`;

      case 'text':
        const escapedText = el.text
          .replace(/&/g, '&amp;')
          .replace(/</g, '<')
          .replace(/>/g, '>')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
        return `<text x="${el.x * s}" y="${el.y * s}" font-size="${el.size * s}" font-family="Arial">${escapedText}</text>`;

      case 'line':
        return `<line 
          x1="${el.x1 * s}" 
          y1="${el.y1 * s}" 
          x2="${el.x2 * s}" 
          y2="${el.y2 * s}" 
          stroke="${el.color || '#000000'}"
          stroke-width="${el.width * s}"
          ${el.dash ? `stroke-dasharray="${el.dash.map(d => d * s).join(',')}"` : ''} />`;

      case 'rect':
        return `<rect 
          x="${el.x * s}" 
          y="${el.y * s}" 
          width="${el.width * s}" 
          height="${el.height * s}" 
          fill="rgb(${el.color.r},${el.color.g},${el.color.b})" />`;

      default:
        return '';
    }
  }

  finalize() {
    const validPages = this.pages.filter(page => page.elements.length > 0);

    if (validPages.length === 0) {
      throw new Error('No pages to export');
    }

    if (validPages.length === 1) {
      return this.generatePageSVG(validPages[0]);
    } else {
      return validPages.map(page => this.generatePageSVG(page));
    }
  }
}

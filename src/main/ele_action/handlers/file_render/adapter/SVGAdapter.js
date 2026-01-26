// SVGAdapter.js
import { IAdapter } from './IAdapter';
import { OverviewStorage, ImageStorage } from '../Utils';

export class SVGAdapter extends IAdapter {
  constructor(config, quality = 'high', useAppLinks = false) {
    super();
    this.config = config;
    this.useAppLinks = useAppLinks;
    this.imageQuality = quality;

    this.pages = [];
    this.currentPageIndex = -1;
    this.currentPage = null;

    // 解析页面尺寸
    const [width, height] = this.parsePageSize(config.pageSize);

    // 处理横置模式
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

    // ✅ 创建第一页
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

  // ✅ 创建新页面
  createNewPage() {
    this.currentPageIndex++;
    this.currentPage = {
      index: this.currentPageIndex,
      elements: []
    };
    this.pages.push(this.currentPage);
  }

  // ✅ 添加新页面
  addPage() {
    this.createNewPage();
  }

  getPageSize() {
    return {
      width: this.pageWidth,
      height: this.pageHeight
    };
  }

  saveState() {}
  restoreState() {}
  setTransform() {}
  setLineStyle({ width, color }) {
    this.currentLineWidth = width;
    this.currentLineColor = color;
  }

  drawImage({ data, x, y, width, height, rotation = 0 }) {
    const imagePathKey = data.path.replaceAll('\\', '');

    let imageSource;
    if (this.useAppLinks) {
      // app 链接模式：默认低清晰度
      const quality = this.imageQuality === 'high' ? 'high' : 'low';
      imageSource = `cardrac://image/${imagePathKey}?quality=${quality}`;
    } else {
      // base64 模式：根据 imageQuality 选择存储
      const storage = this.imageQuality === 'low' ? OverviewStorage : ImageStorage;
      imageSource = storage[imagePathKey] || '';
    }

    let adjustedX = x;
    let adjustedY = y;

    if (rotation === 180) {
      adjustedX = x - width;
      adjustedY = y + height;
    }

    this.currentPage.elements.push({
      type: 'image',
      href: imageSource,
      x: adjustedX,
      y: adjustedY,
      width,
      height,
      rotation,
      path: data.path
    });
  }

  drawText({ text, x, y, size = 12 }) {
    this.currentPage.elements.push({
      type: 'text',
      text, x, y, size
    });
  }

  drawLine({ x1, y1, x2, y2, dash }) {
    this.currentPage.elements.push({
      type: 'line',
      x1, y1, x2, y2, dash,
      width: this.currentLineWidth || 1,  // ✅ 使用存储的线宽
      color: this.currentLineColor || '#000000'
    });
  }

  fillRect({ x, y, width, height, color }) {
    this.currentPage.elements.push({
      type: 'rect',
      x, y, width, height, color
    });
  }

  // ✅ 生成单个页面的 SVG
  generatePageSVG(page) {
    const rects = page.elements.filter(el => el.type === 'rect');
    const others = page.elements.filter(el => el.type !== 'rect');

    const svg = `<svg 
    width="${this.pageWidth}" 
    height="${this.pageHeight}" 
    viewBox="0 0 ${this.pageWidth} ${this.pageHeight}"
    xmlns="http://www.w3.org/2000/svg">
    <rect width="${this.pageWidth}" height="${this.pageHeight}" fill="white"/>
    ${rects.map(el => this.renderElement(el)).join('\n')}
    ${others.map(el => this.renderElement(el)).join('\n')}
  </svg>`;
    return svg;
  }

  renderElement(el) {
    switch (el.type) {
      case 'image':
        if (!el.href) return '';
        const centerX = el.x + el.width / 2;
        const centerY = el.y + el.height / 2;

        return `<image 
    href="${el.href}" 
    x="${el.x}" 
    y="${el.y}" 
    width="${el.width}" 
    height="${el.height}" 
    preserveAspectRatio="none"
    transform="rotate(${el.rotation}, ${centerX}, ${centerY})" />`;
      case 'text':
        const escapedText = el.text
          .replace(/&/g, '&amp;')
          .replace(/</g, '<')
          .replace(/>/g, '>')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
        return `<text x="${el.x}" y="${el.y}" font-size="${el.size}" font-family="Arial">${escapedText}</text>`;
      case 'line':
        return `<line 
          x1="${el.x1}" 
          y1="${el.y1}" 
          x2="${el.x2}" 
          y2="${el.y2}" 
          stroke="black" 
          stroke-width="${el.width}"
          ${el.dash ? `stroke-dasharray="${el.dash.join(',')}"` : ''} />`;
      case 'rect':
        return `<rect 
          x="${el.x}" 
          y="${el.y}" 
          width="${el.width}" 
          height="${el.height}" 
          fill="rgb(${el.color.r},${el.color.g},${el.color.b})" />`;
      default:
        return '';
    }
  }

  // ✅ 完成渲染，返回单个或多个 SVG
  finalize() {
    const validPages = this.pages.filter(page => page.elements.length > 0);

    if (validPages.length === 0) {
      throw new Error('No pages to export');
    }

    // ✅ 单页返回字符串，多页返回数组
    if (validPages.length === 1) {
      return this.generatePageSVG(validPages[0]);
    } else {
      return validPages.map(page => this.generatePageSVG(page));
    }
  }
}

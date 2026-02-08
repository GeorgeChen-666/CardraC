// src/main/ele_action/handlers/pdf/adapter/ShadowAdapter.js
import { IAdapter } from './IAdapter';

export class ShadowAdapter extends IAdapter {
  constructor(config) {
    super();
    this.config = config;
    this.pages = [];
    this.currentPageIndex = -1;
    this.currentPage = null;

    const [width, height] = [config.pageWidth, config.pageHeight];
    this.pageWidth = Math.ceil(config.landscape ? height : width);
    this.pageHeight = Math.ceil(config.landscape ? width : height);

    // 创建第一页
    this.createNewPage();
  }

  createNewPage() {
    this.currentPageIndex++;

    this.currentPage = {
      index: this.currentPageIndex,
      width: this.pageWidth,
      height: this.pageHeight,
      elements: []
    };

    this.pages.push(this.currentPage);
  }

  addPage() {
    this.createNewPage();
  }

  saveState() {
    this.currentPage.elements.push({
      type: 'saveState',
      timestamp: Date.now()
    });
  }

  restoreState() {
    this.currentPage.elements.push({
      type: 'restoreState',
      timestamp: Date.now()
    });
  }

  setTransform({ a, b, c, d, e, f }) {
    this.currentPage.elements.push({
      type: 'transform',
      matrix: { a, b, c, d, e, f },
      timestamp: Date.now()
    });
  }

  drawText({ text, x, y, size = 12 }) {
    this.currentPage.elements.push({
      type: 'text',
      text,
      x,
      y,
      fontSize: size,
      timestamp: Date.now()
    });
  }

  setLineStyle({ width, color }) {
    this.currentLineWidth = width;
    this.currentLineColor = color;

    this.currentPage.elements.push({
      type: 'lineStyle',
      width,
      color,
      timestamp: Date.now()
    });
  }

  drawLine({ x1, y1, x2, y2, dash }) {
    this.currentPage.elements.push({
      type: 'line',
      x1,
      y1,
      x2,
      y2,
      width: this.currentLineWidth || 1,
      color: this.currentLineColor || '#000000',
      dashed: !!dash,
      dashPattern: dash || null,
      timestamp: Date.now()
    });
  }

  fillRect({ x, y, width, height, color }) {
    this.currentPage.elements.push({
      type: 'rect',
      x,
      y,
      width,
      height,
      color,
      timestamp: Date.now()
    });
  }

  async drawImage({ data, x, y, width, height, rotation = 0 }) {
    // 调整坐标使其表示旋转后的视觉位置
    let adjustedX = x;
    let adjustedY = y;

    if (rotation === 180) {
      adjustedX = x - width;
      adjustedY = y + height;
    }

    this.currentPage.elements.push({
      type: 'image',
      x: adjustedX,
      y: adjustedY,
      width,
      height,
      rotation,
      rotated: rotation !== 0,
      dataType: data.base64 ? 'base64' : (data.path ? 'path' : 'unknown'),
      dataPath: data.path || null,
      dataSize: data.base64 ? data.base64.length : null,
      timestamp: Date.now()
    });
  }


  getPageSize() {
    return {
      width: this.pageWidth,
      height: this.pageHeight
    };
  }

  async finalize() {
    // 返回完整的绘制记录
    return {
      config: {
        pageSize: `${this.pageWidth}x${this.pageHeight}`,
        landscape: this.config.landscape,
        compressLevel: this.config.compressLevel
      },
      totalPages: this.pages.length,
      pages: this.pages.map(page => ({
        index: page.index,
        width: page.width,
        height: page.height,
        elementCount: page.elements.length,
        elements: page.elements
      })),
      summary: this.generateSummary()
    };
  }

  generateSummary() {
    const summary = {
      totalElements: 0,
      byType: {},
      byPage: []
    };

    this.pages.forEach(page => {
      const pageStats = {
        pageIndex: page.index,
        elements: {}
      };

      page.elements.forEach(element => {
        summary.totalElements++;

        // 统计类型
        if (!summary.byType[element.type]) {
          summary.byType[element.type] = 0;
        }
        summary.byType[element.type]++;

        // 统计每页
        if (!pageStats.elements[element.type]) {
          pageStats.elements[element.type] = 0;
        }
        pageStats.elements[element.type]++;
      });

      summary.byPage.push(pageStats);
    });

    return summary;
  }

  // 测试辅助方法
  getElementsOfType(type, pageIndex = null) {
    if (pageIndex !== null) {
      return this.pages[pageIndex]?.elements.filter(e => e.type === type) || [];
    }

    return this.pages.flatMap(page =>
      page.elements.filter(e => e.type === type)
    );
  }

  getTexts(pageIndex = null) {
    return this.getElementsOfType('text', pageIndex);
  }

  getLines(pageIndex = null) {
    return this.getElementsOfType('line', pageIndex);
  }

  getImages(pageIndex = null) {
    return this.getElementsOfType('image', pageIndex);
  }

  getRects(pageIndex = null) {
    return this.getElementsOfType('rect', pageIndex);
  }

  getDashedLines(pageIndex = null) {
    return this.getLines(pageIndex).filter(line => line.dashed);
  }

  getRotatedImages(pageIndex = null) {
    return this.getImages(pageIndex).filter(img => img.rotated);
  }

  findTextByContent(searchText, pageIndex = null) {
    return this.getTexts(pageIndex).filter(text =>
      text.text.includes(searchText)
    );
  }

  findElementsAtPosition(x, y, tolerance = 1, pageIndex = null) {
    const pages = pageIndex !== null ? [this.pages[pageIndex]] : this.pages;
    const results = [];

    pages.forEach(page => {
      page.elements.forEach(element => {
        let matches = false;

        if (element.type === 'text' || element.type === 'image' || element.type === 'rect') {
          matches = Math.abs(element.x - x) <= tolerance &&
            Math.abs(element.y - y) <= tolerance;
        } else if (element.type === 'line') {
          matches = (Math.abs(element.x1 - x) <= tolerance && Math.abs(element.y1 - y) <= tolerance) ||
            (Math.abs(element.x2 - x) <= tolerance && Math.abs(element.y2 - y) <= tolerance);
        }

        if (matches) {
          results.push({ ...element, pageIndex: page.index });
        }
      });
    });

    return results;
  }
}

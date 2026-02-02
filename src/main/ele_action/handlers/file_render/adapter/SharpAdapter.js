import { IAdapter } from './IAdapter';
import sharp from 'sharp';

export class SharpAdapter extends IAdapter {
  constructor(config, quality = 'high') {
    super();
    this.config = config;
    this.pages = [];
    this.currentPageIndex = -1;
    this.currentPage = null;
    this.renderingTasks = [];

    const qualitySettings = {
      high: {
        scaleFactor: 9,
        kernel: 'lanczos3',
        compressionLevel: 6,
        effort: 5
      },
      medium: {
        scaleFactor: 6,
        kernel: 'lanczos2',
        compressionLevel: 4,
        effort: 3
      },
      low: {
        scaleFactor: 3,
        kernel: 'cubic',
        compressionLevel: 3,
        effort: 2
      }
    };

    const settings = qualitySettings[quality] || qualitySettings.high;
    this.scaleFactor = settings.scaleFactor;
    this.kernel = settings.kernel;
    this.compressionLevel = settings.compressionLevel;
    this.effort = settings.effort;

    const [width, height] = this.parsePageSize(config.pageSize);

    this.pageWidth = Math.ceil(config.landscape ? height : width);
    this.pageHeight = Math.ceil(config.landscape ? width : height);

    this.renderWidth = Math.ceil(this.pageWidth * this.scaleFactor);
    this.renderHeight = Math.ceil(this.pageHeight * this.scaleFactor);

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

  scale(value) {
    return value * this.scaleFactor;
  }

  createNewPage() {
    this.currentPageIndex++;

    this.currentPage = {
      index: this.currentPageIndex,
      width: this.renderWidth,
      height: this.renderHeight,
      background: null,
      //改为按顺序存储绘制命令
      drawCommands: [],
      isRendering: false,
      renderPromise: null
    };

    this.pages.push(this.currentPage);
    this.initBackground(this.currentPage);
  }

  async initBackground(page) {
    page.background = await sharp({
      create: {
        width: page.width,
        height: page.height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    }).png().toBuffer();
  }

  addPage() {
    this.startPageRendering(this.currentPage);
    this.createNewPage();
  }

  //按绘制顺序渲染
  startPageRendering(page) {
    if (page.isRendering || page.renderPromise) {
      return;
    }

    page.isRendering = true;

    const renderTask = (async () => {
      try {
        if (!page.background) {
          await this.initBackground(page);
        }

        let composite = sharp(page.background);

        //按顺序处理每个绘制命令
        const overlays = [];
        for (const command of page.drawCommands) {
          const overlay = await command();
          if (overlay !== null) {
            overlays.push(overlay);
          }
        }

        if (overlays.length > 0) {
          composite = composite.composite(overlays);
        }

        page.buffer = await composite.png().toBuffer();
        page.isRendering = false;
      } catch (error) {
        console.error(`Failed to render page ${page.index}:`, error);
        page.isRendering = false;
        throw error;
      }
    })();

    page.renderPromise = renderTask;
    this.renderingTasks.push(renderTask);
  }

  async createImageLayer(data, x, y, width, height, rotation = 0) {
    try {
      let imageBuffer;

      if (data.base64) {
        const base64Data = data.base64.replace(/^data:image\/\w+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else if (data.path) {
        imageBuffer = require('fs').readFileSync(data.path);
      } else {
        return null;
      }

      let image = sharp(imageBuffer);

      const scaledWidth = Math.ceil(this.scale(width));
      const scaledHeight = Math.ceil(this.scale(height));

      image = image.resize(scaledWidth, scaledHeight, {
        fit: 'fill',
        kernel: this.kernel,
        withoutEnlargement: false
      });

      let adjustedX = x;
      let adjustedY = y;

      if (rotation === 180) {
        adjustedX = x - width;
        adjustedY = y + height;
      }
      if (rotation !== 0) {
        image = image.rotate(rotation, {
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        });
      }

      image = image.png({
        compressionLevel: this.compressionLevel,
        effort: this.effort
      });

      return {
        input: await image.toBuffer(),
        top: Math.ceil(this.scale(adjustedY)),
        left: Math.ceil(this.scale(adjustedX))
      };
    } catch (error) {
      console.error('Failed to create image layer:', error);
      return null;
    }
  }

  async createRectLayer(x, y, width, height, color) {
    try {
      const rectBuffer = await sharp({
        create: {
          width: Math.ceil(this.scale(width)),
          height: Math.ceil(this.scale(height)),
          channels: 4,
          background: { r: color.r, g: color.g, b: color.b, alpha: 1 }
        }
      }).png().toBuffer();

      return {
        input: rectBuffer,
        top: Math.ceil(this.scale(y)),
        left: Math.ceil(this.scale(x))
      };
    } catch (error) {
      console.error('Failed to create rect layer:', error);
      return null;
    }
  }

  async createLineLayer(x1, y1, x2, y2, lineWidth, color, dash) {
    try {
      const sx1 = this.scale(x1);
      const sy1 = this.scale(y1);
      const sx2 = this.scale(x2);
      const sy2 = this.scale(y2);
      const sLineWidth = this.scale(lineWidth);

      const minX = Math.min(sx1, sx2);
      const minY = Math.min(sy1, sy2);
      const maxX = Math.max(sx1, sx2);
      const maxY = Math.max(sy1, sy2);

      const boxWidth = Math.max(Math.ceil(maxX - minX), 1);
      const boxHeight = Math.max(Math.ceil(maxY - minY), 1);

      const dashArray = dash
        ? dash.map(d => this.scale(d)).join(',')
        : '';

      const svg = `
        <svg width="${boxWidth}" height="${boxHeight}">
          <line 
            x1="${sx1 - minX}" 
            y1="${sy1 - minY}" 
            x2="${sx2 - minX}" 
            y2="${sy2 - minY}" 
            stroke="${this.colorToHex(color)}" 
            stroke-width="${sLineWidth}"
            ${dashArray ? `stroke-dasharray="${dashArray}"` : ''}
          />
        </svg>
      `;

      const lineBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

      return {
        input: lineBuffer,
        top: Math.ceil(minY),
        left: Math.ceil(minX)
      };
    } catch (error) {
      console.error('Failed to create line layer:', error);
      return null;
    }
  }

  async createTextLayer(text, x, y, size) {
    try {
      const sx = this.scale(x);
      const sy = this.scale(y);
      const sSize = this.scale(size) * 0.3;

      const svg = `
        <svg width="${this.renderWidth}" height="${this.renderHeight}">
          <text 
            x="${sx}" 
            y="${sy}" 
            font-family="Arial" 
            font-size="${sSize}" 
            fill="#000000"
          >${this.escapeXml(text)}</text>
        </svg>
      `;

      const textBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

      return {
        input: textBuffer,
        top: 0,
        left: 0
      };
    } catch (error) {
      console.error('Failed to create text layer:', error);
      return null;
    }
  }

  colorToHex(color) {
    if (typeof color === 'string') return color;
    if (typeof color === 'number') {
      const hex = color.toString(16).padStart(2, '0');
      return `#${hex}${hex}${hex}`;
    }
    return '#000000';
  }

  escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  saveState() {
    // Sharp 不需要状态管理
  }

  restoreState() {
    // Sharp 不需要状态管理
  }

  setTransform({ a, b, c, d, e, f }) {
    this.currentTransform = { a, b, c, d, e, f };
  }

  //添加绘制命令到队列
  drawText({ text, x, y, size = 12 }) {
    this.currentPage.drawCommands.push(() =>
      this.createTextLayer(text, x, y, size)
    );
  }

  setLineStyle({ width, color }) {
    this.currentLineWidth = width;
    this.currentLineColor = color;
  }

  drawLine({ x1, y1, x2, y2, dash }) {
    const lineWidth = this.currentLineWidth || 1;
    const lineColor = this.currentLineColor || '#000000';
    this.currentPage.drawCommands.push(() =>
      this.createLineLayer(
        x1, y1, x2, y2,
        lineWidth,
        lineColor,
        dash
      )
    );
  }

  fillRect({ x, y, width, height, color }) {
    this.currentPage.drawCommands.push(() =>
      this.createRectLayer(x, y, width, height, color)
    );
  }

  async drawImage({ data, x, y, width, height, rotation = 0 }) {
    this.currentPage.drawCommands.push(() =>
      this.createImageLayer(data, x, y, width, height, rotation)
    );
  }

  getPageSize() {
    return {
      width: this.pageWidth,
      height: this.pageHeight
    };
  }

  async finalize() {
    this.pages.forEach(page => {
      if (!page.isRendering && !page.renderPromise) {
        this.startPageRendering(page);
      }
    });

    await Promise.all(this.renderingTasks);

    const validPages = this.pages.filter(page => page.buffer);

    if (validPages.length === 0) {
      throw new Error('No pages to export');
    }

    if (validPages.length === 1) {
      return validPages[0].buffer;
    } else {
      return validPages.map(page => page.buffer);
    }
  }
}

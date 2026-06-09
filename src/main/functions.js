import sharp from 'sharp';
import { BrowserWindow, app } from 'electron';
import fs from 'fs';
import path from 'path';
import { expandPath } from '../shared/functions';

export async function getBorderAverageColors(base64String, borderWidth = 5) {
  try {
    if(!base64String) return null;
    const buffer = Buffer.from(base64String.split(',')[1], 'base64');
    const baseImage = sharp(buffer);
    const metadata = await baseImage.metadata();
    const { width, height, channels } = metadata;

    const { data } = await baseImage
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const actualBorderWidth = Math.min(borderWidth, Math.floor(Math.min(width, height) / 2));

    let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
    let pixelCount = 0, visiblePixelCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const isInBorder =
          y < actualBorderWidth ||
          y >= height - actualBorderWidth ||
          x < actualBorderWidth ||
          x >= width - actualBorderWidth;

        if (isInBorder) {
          const index = (y * width + x) * 4;
          const a = data[index + 3];

          pixelCount++;
          if (a > 0) {
            const weight = a / 255;
            totalR += data[index] * weight;
            totalG += data[index + 1] * weight;
            totalB += data[index + 2] * weight;
            totalA += a;
            visiblePixelCount++;
          }
        }
      }
    }
    if (visiblePixelCount === 0) {
      return null;  // ✅ 无可见像素
    }
    return {
      r: Math.round(totalR / pixelCount),
      g: Math.round(totalG / pixelCount),
      b: Math.round(totalB / pixelCount),
      alpha: 1
    };
  } catch (error) {
    console.error('Error processing image:', error.message);
    return null;
  }
}

export const readCompressedImage = async (path, options = {}) => {
  options.format = options.format === 'jpg' ? 'jpeg' : 'png';
  const {
    maxWidth = 1000,
    quality = 80,
    format= 'webp',
    maxDpi = 300,
    returnFormat = 'base64'
  } = options;
  try {
    const fileBuffer = fs.readFileSync(expandPath(path));

    // ✅ 只改这里：加优化参数
    let image = sharp(fileBuffer, {
      sequentialRead: true,
      failOnError: false
    });

    const metadata = await image.metadata();
    const imageDpi = metadata.density || 72;
    let rotateDegrees = 0;
    if (metadata.orientation) {
      if ([5, 6, 7, 8].includes(metadata.orientation)) {
        rotateDegrees = 90;
      } else if ([3, 4].includes(metadata.orientation)) {
        rotateDegrees = 180;
      } else if ([7, 8].includes(metadata.orientation)) {
        rotateDegrees = 270;
      }
    }

    // ✅ 只改这里：resize 参数改成这种形式
    image = image.rotate(rotateDegrees)
      .resize(Math.min(metadata.width, maxWidth), null, {
        fastShrinkOnLoad: true
      })
      .withMetadata({ density: Math.min(imageDpi, maxDpi) })
      .toFormat(format, {
        lossless: true,
        force: true,
        quality
      });
    // const ext = 'webp';
    const buffer = await image.toBuffer()
    if(returnFormat === 'base64') {
      const base64String = (buffer).toString('base64');
      return `data:image/${format};base64,${base64String}`;
    }
    return buffer;
  } catch (e) {
    return null;
  }
}

export const saveDataToFile = async (data, filePath) => {
  let buffer = null;

  if (Buffer.isBuffer(data)) {
    buffer = data;
  } else if (data instanceof ArrayBuffer) {
    buffer = Buffer.from(data);
  } else if (typeof data === 'object' && data instanceof Blob) {
    buffer = Buffer.from(await data.arrayBuffer());
  } else if (typeof data === 'string') {
    buffer = data;
  } else if (typeof data === 'object' && data.constructor === Object) {
    buffer = JSON.stringify(data);
  } else {
    throw new Error(`Unsupported data type: ${typeof data}`);
  }

  await fs.writeFileSync(filePath, buffer);
};

/**
 * 打印 SVG 数组
 * @param printerName string - 打印机名
 * @param {string[]} svgDataList - SVG 数组
 * @param {Object} options - 打印选项
 * @param {number} [options.pageWidthMm=210] - 页面宽度（毫米）
 * @param {number} [options.pageHeightMm=297] - 页面高度（毫米）
 * @param {number} [options.offsetXmm=0] - 水平偏移（毫米）
 * @param {number} [options.offsetYmm=0] - 垂直偏移（毫米）
 * @param {number} [options.scaleX=1] - 水平缩放
 * @param {number} [options.scaleY=1] - 垂直缩放
 * @param {boolean} [options.landscape=false] - 横向打印
 * @param {boolean} [options.silent=true] - 静默打印
 */
export async function printSVGs(printerName, svgDataList, options = {}) {
  const {
    pageWidthMm = 210,
    pageHeightMm = 297,
    offsetXmm = 0,
    offsetYmm = 0,
    scaleX = 1,
    scaleY = 1,
    landscape = false,
    silent = true,
    paperSize = ''
  } = options;

  const [width, height] = landscape?[pageHeightMm, pageWidthMm]:[pageWidthMm, pageHeightMm];

  // ✅ 提取 HTML 生成，避免 IDE 报红
  const html = buildPrintHTML(svgDataList, { width, height, offsetXmm, offsetYmm, scaleX, scaleY });

  const tempFile = path.join(app.getPath('temp'), `print_${Date.now()}.html`);
  fs.writeFileSync(tempFile, html);

  const win = new BrowserWindow({
    show: false,
    offscreen: false,
    enableWebGL: true,
    webPreferences: { zoomFactor: 3 }
  });

  try {
    await win.loadFile(tempFile);
    await waitForLoad(win);

    return await executePrint(win, printerName, { paperSize, landscape });
  } finally {
    win.destroy();
    fs.unlinkSync(tempFile);
  }
}

// ========== 辅助函数 ==========

function decodeSVG(data) {
  if (!data || data.startsWith('<svg')) return data;

  const decoders = {
    'data:image/svg+xml;base64,': (s) => Buffer.from(s, 'base64').toString(),
    'data:image/svg+xml;charset=utf-8,': decodeURIComponent,
    'data:image/svg+xml,': decodeURIComponent
  };

  for (const [prefix, decoder] of Object.entries(decoders)) {
    if (data.startsWith(prefix)) {
      return decoder(data.slice(prefix.length)).replace(/quality=low/g, 'quality=high');
    }
  }

  return data;
}

function buildPrintHTML(svgDataList, { width, height, offsetXmm, offsetYmm, scaleX, scaleY }) {
  const pageStyle = `width:${width}mm;height:${height}mm;position:relative;page-break-after:always;overflow:hidden`;
  const contentStyle = `position:absolute;left:${offsetXmm}mm;top:${offsetYmm}mm;transform:scale(${scaleX},${scaleY});transform-origin:0 0`;

  const pages = svgDataList
    .map(svg => `<div class="page" style="${pageStyle}"><div style="${contentStyle}">${decodeSVG(svg)}</div></div>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: ${width}mm ${height}mm; margin: 0; }
    * { margin: 0; padding: 0; }
    body { 
      -webkit-print-color-adjust: exact;
      image-rendering: pixelated;
    }
    .page:last-child { page-break-after: auto; }
    svg {
      width: 100% !important;
      height: 100% !important;
      display: block;
    }
    svg image {
      image-rendering: high-quality;
    }
  </style>
</head>
<body>${pages}</body>
</html>`;
}

async function waitForLoad(win) {
  await win.webContents.executeJavaScript(`
    new Promise(resolve => {
      const images = document.querySelectorAll('svg image');
      if (!images.length) return resolve();
      
      Promise.race([
        Promise.all(Array.from(images).map(img => 
          new Promise(r => {
            const i = new Image();
            i.onload = i.onerror = r;
            i.src = img.getAttribute('href') || img.getAttribute('xlink:href');
          })
        )),
        new Promise(r => setTimeout(r, 10000))
      ]).then(resolve);
    })
  `);

  await new Promise(r => setTimeout(r, 1000));
}

async function executePrint(win, printerName, { paperSize, landscape }) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Print timeout')), 30000);

    win.webContents.print({
      landscape,
      silent: true,
      deviceName: printerName,
      scaleFactor:100,
      pageSize: paperSize,
      // dpi: { horizontal: 300, vertical: 300 }
    }, (success, error) => {
      clearTimeout(timeout);
      resolve({
        success,
        cancelled: !error || error === 'cancelled',
        error
      });
    });
  });
}



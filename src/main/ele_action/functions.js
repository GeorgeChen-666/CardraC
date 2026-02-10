import sharp from 'sharp';
import Store from 'electron-store';
import path from 'path';
const { Buffer } = require('buffer');
import fs from 'fs';
import { app, BrowserWindow } from 'electron';
import { expandPath, fixPath } from '../utils';

export async function getBorderAverageColors(base64String, borderWidth = 5) {
  try {
    const buffer = Buffer.from(base64String.split(',')[1], 'base64');
    const baseImage = sharp(buffer);
    const metadata = await baseImage.metadata();
    const { width, height, channels } = metadata;

    //一次性获取所有像素数据
    const { data } = await baseImage.raw().toBuffer({ resolveWithObject: true });

    const pixelsPerChannel = channels || 3;
    const actualBorderWidth = Math.min(borderWidth, Math.floor(Math.min(width, height) / 2));

    let totalR = 0, totalG = 0, totalB = 0;
    let pixelCount = 0;

    //遍历所有像素，只统计边框区域
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // 判断是否在边框区域
        const isInBorder =
          y < actualBorderWidth ||                    // 上边框
          y >= height - actualBorderWidth ||          // 下边框
          x < actualBorderWidth ||                    // 左边框
          x >= width - actualBorderWidth;             // 右边框

        if (isInBorder) {
          const index = (y * width + x) * pixelsPerChannel;
          totalR += data[index];
          totalG += data[index + 1];
          totalB += data[index + 2];
          pixelCount++;
        }
      }
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
    format= 'webp'
  } = options;
  try {
    let image = sharp(expandPath(path));
    const metadata = await image.metadata();

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

    image = image.rotate(rotateDegrees)
      .resize({ width: Math.min(metadata.width, maxWidth) });
    image = (image[format])({ lossless: true, force: true, quality });
    const ext = 'webp';
    const base64String = (await image.toBuffer()).toString('base64');
    return `data:image/${ext};base64,${base64String}`;
  } catch (e) {
    return null;
  }
}

export const readFileToData = async (filePath, format = '') => {
  const readStream = fs.createReadStream(filePath);

  return new Promise((resolve, reject) => {
    const chunks = [];
    readStream.on('data', (chunk) => {
      chunks.push(chunk)
    });

    readStream.on('end', () => {
      const resultBuffer = Buffer.concat(chunks);
      const formatedData = format ? resultBuffer.toString(format) : resultBuffer.toString();
      resolve(formatedData)
    });
    readStream.on('error', (err) => {
      reject(err);
    });
  })
};

export const saveDataToFile = async (data, filePath) => {
  let buffer = null;

  if (Buffer.isBuffer(data)) {
    buffer = data;
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
export const base64ToBuffer = (base64Data) => {
  const buffer = Buffer.from(base64Data, 'base64');
  const decodedString = buffer.toString('binary');
  return decodedString;
};

let store = null;
export const updateConfigStore = (value) => {
  getConfigStore();
  store.set(value);
}
export const initConfigStore = async () => {
  return new Promise((resolve, reject) => {
    try {
      if (!store) {
        store = new Store();
        resolve();
      }
    } catch (e) {
      //APPDATA npm_package_name process
      const {APPDATA, npm_package_name} = process.env;
      const configPath = path.join(APPDATA, npm_package_name, 'config.json');
      fs.unlink(configPath, () => {
        store = new Store();
        resolve();
      });
    }
  })
}

export const getConfigStore = () => {

  return store.get() || {};
}

/**
 * 打印 PNG Buffer 数组
 * @param printerName string - 打印机名
 * @param {Buffer[]} buffers - PNG Buffer 数组
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
export async function printPNGs(printerName, buffers, options = {}) {
  const {
    pageWidthMm = 210,
    pageHeightMm = 297,
    offsetXmm = 0,
    offsetYmm = 0,
    scaleX = 1,
    scaleY = 1,
    landscape = false,
    silent = false
  } = options;

  const actualWidth = landscape ? pageHeightMm : pageWidthMm;
  const actualHeight = landscape ? pageWidthMm : pageHeightMm;

  const PRINT_SCALE = 3; // 3倍分辨率，相当于 288 DPI

  const decodeSvg = (data) => {
    if (!data) return '';
    try {
      let decoded = '';
      if (data.startsWith('<svg')) {
        decoded = data;
      } else if (data.startsWith('data:image/svg+xml;charset=utf-8,')) {
        decoded = decodeURIComponent(data.replace('data:image/svg+xml;charset=utf-8,', ''));
      } else if (data.startsWith('data:image/svg+xml,')) {
        decoded = decodeURIComponent(data.replace('data:image/svg+xml,', ''));
      } else if (data.startsWith('data:image/svg+xml;base64,')) {
        const base64Data = data.replace('data:image/svg+xml;base64,', '');
        decoded = Buffer.from(base64Data, 'base64').toString('utf-8');
      }

      decoded = decoded.replace(/quality=low/g, 'quality=high');

      return decoded;
    } catch (e) {
      console.error('Failed to decode SVG:', e);
      return '';
    }
  };

  const pages = buffers.map((svgData) => {
    const svgContent = decodeSvg(svgData);

    return `<div class="page">
  <div class="svg-container" style="
    position: absolute;
    left: ${offsetXmm}mm;
    top: ${offsetYmm}mm;
    width: ${actualWidth}mm;
    height: ${actualHeight}mm;
    transform: scale(${scaleX}, ${scaleY});
    transform-origin: 0 0;
  ">
    ${svgContent}
  </div>
</div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { 
      size: ${actualWidth}mm ${actualHeight}mm;
      margin: 0; 
    }
    * { 
      margin: 0; 
      padding: 0; 
    }
    body { 
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      /*提高渲染质量 */
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
    }
    .page { 
      width: ${actualWidth}mm;
      height: ${actualHeight}mm;
      position: relative;
      page-break-after: always;
      overflow: hidden;
    }
    .page:last-child {
      page-break-after: auto;
    }
    .svg-container {
      overflow: hidden;
    }
    .svg-container svg {
      width: 100% !important;
      height: 100% !important;
      display: block;
    }
    /*提高 SVG 图片质量 */
    .svg-container svg image {
      image-rendering: -webkit-optimize-contrast;
      image-rendering: high-quality;
    }
  </style>
</head>
<body>${pages}</body>
</html>`;

  const tempDir = app.getPath('temp');
  const tempFile = path.join(tempDir, `cardrac_print_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.html`);

  let fileCreated = false;

  try {
    fs.writeFileSync(tempFile, html, 'utf-8');
    fileCreated = true;
  } catch (error) {
    throw new Error(`Failed to create temp file: ${error.message}`);
  }

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: false,
      enableWebGL: true,
      zoomFactor: PRINT_SCALE
    }
  });

  try {
    await win.loadFile(tempFile);

    await win.webContents.executeJavaScript(`
      new Promise(async (resolve) => {
        if (document.readyState !== 'complete') {
          await new Promise(r => window.addEventListener('load', r));
        }
    
        const images = Array.from(document.querySelectorAll('svg image'));
    
        console.log('Waiting for', images.length, 'SVG images to load');
    
        if (images.length === 0) {
          console.log('No images found, resolving immediately');
          resolve();
          return;
        }
    
        const imagePromises = images.map((img, index) => {
          return new Promise((resolveImg) => {
            const href = img.getAttribute('href') || img.getAttribute('xlink:href');
            
            if (!href) {
              console.log('Image', index, 'has no href');
              resolveImg();
              return;
            }

            const testImg = new Image();
            
            const onLoad = () => {
              console.log('Image', index, 'loaded:', href.substring(0, 50));
              resolveImg();
            };
            
            const onError = () => {
              console.warn('Image', index, 'failed to load:', href.substring(0, 50));
              resolveImg();
            };

            testImg.addEventListener('load', onLoad);
            testImg.addEventListener('error', onError);

            setTimeout(() => {
              console.warn('Image', index, 'timeout');
              testImg.removeEventListener('load', onLoad);
              testImg.removeEventListener('error', onError);
              resolveImg();
            }, 10000);

            testImg.src = href;
          });
        });
    
        await Promise.race([
          Promise.all(imagePromises),
          new Promise(r => setTimeout(r, 30000))
        ]);
    
        console.log('All SVG images loaded or timeout');
        resolve();
      })
    `);

    await new Promise(r => setTimeout(r, 2000));

    const result = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Print timeout')), 30000);

      win.webContents.print({
        silent,
        printBackground: true,
        deviceName: printerName || '',
        landscape: false,
        margins: {
          marginType: 'none'
        },
        pageSize: {
          width: actualWidth * 1000,
          height: actualHeight * 1000
        },
        dpi: {
          horizontal: 300,
          vertical: 300
        }
      }, (ok, err) => {
        clearTimeout(t);

        if (ok) {
          resolve({ success: true, cancelled: false });
        } else {
          const isCancelled = !err || err === 'cancelled' || err === 'canceled';

          if (isCancelled) {
            resolve({ success: false, cancelled: true });
          } else {
            resolve({ success: false, cancelled: false, error: err });
          }
        }
      });
    });

    return result;

  } finally {
    win.destroy();

    if (fileCreated) {
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {
        console.warn('Failed to delete temp file:', tempFile, e);
      }
    }
  }
}


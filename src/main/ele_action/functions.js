import sharp from 'sharp';
import Store from 'electron-store';
import path from 'path';

const fs = require('fs');

export async function getBorderAverageColors(base64String, borderWidth = 5) {
  try {
    const buffer = Buffer.from(base64String.split(',')[1], 'base64');
    // 读取图片元数据
    const metadata = await sharp(buffer).metadata();
    const { width, height } = metadata;

    // 定义四边裁剪区域（自动处理小尺寸图片）
    const regions = {
      top: {
        left: 0,
        top: 0,
        width: width,
        height: Math.min(borderWidth, height)
      },
      bottom: {
        left: 0,
        top: Math.max(0, height - borderWidth),
        width: width,
        height: Math.min(borderWidth, height - Math.max(0, height - borderWidth))
      },
      left: {
        left: 0,
        top: 0,
        width: Math.min(borderWidth, width),
        height: height
      },
      right: {
        left: Math.max(0, width - borderWidth),
        top: 0,
        width: Math.min(borderWidth, width - Math.max(0, width - borderWidth)),
        height: height
      }
    };

    const colors = {};

    // 并行处理所有区域
    await Promise.all(
      Object.entries(regions).map(async ([name, rect]) => {
        try {
          // 跳过无效区域
          if (rect.width <= 0 || rect.height <= 0) {
            colors[name] = null;
            return;
          }

          // 提取区域并计算统计信息
          const stats = await sharp(await sharp(buffer).extract(rect).toBuffer()).stats();

          // 获取 RGB 通道平均值
          const [r, g, b] = stats.channels
            .slice(0, 3)
            .map(c => Math.round(c.mean));

          colors.r = (colors.r || 0) + Math.round(r);
          colors.g = (colors.g || 0) + Math.round(g);
          colors.b = (colors.b || 0) + Math.round(b);
        } catch (error) {
          console.error(`Error processing ${name}:`, error.message);
          //colors[name] = null;
        }
      })
    );

    return {
      r: Math.round(colors.r / 4),
      g: Math.round(colors.g / 4),
      b: Math.round(colors.b / 4),
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
    let image = sharp(path);
    const metadata = await image.metadata();
    image = image.resize({ width: Math.min(metadata.width, maxWidth) });
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
  if (typeof data === 'string') {
    buffer = data;
  } else if (typeof data === 'object' && data instanceof Blob) {
    buffer = Buffer.from(await data.arrayBuffer());
  } else if (typeof data === 'object' && data.constructor === Object) {
    buffer = JSON.stringify(data);
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



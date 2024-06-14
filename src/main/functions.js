import sharp from 'sharp';

const fs = require('fs');

export const readCompressedImage = async (path, options = {}) => {
  options.format = options.format === 'jpg' ? 'jpeg' : 'png';
  const {
    maxWidth = 1000,
    quality = 60,
    format= 'webp'
  } = options;

  let image = sharp(path);
  const metadata = await image.metadata();
  image = image.resize({ width: Math.min(metadata.width, maxWidth) });
  image = (image[format])({ lossless: true, force: true, quality });
  const ext = 'webp';
  const base64String = (await image.toBuffer()).toString('base64');
  return `data:image/${ext};base64,${base64String}`;
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




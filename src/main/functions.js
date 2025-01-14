import sharp from 'sharp';

const fs = require('fs');
export const getImageBorderAverageColor = async (base64String, borderWidth= 10) => {
  const buffer = Buffer.from(base64String.split(',')[1], 'base64');
  const image = sharp(buffer);
  const {width, height} = await image.metadata();
  const rectangles = [
    { width, height: borderWidth, left: 0, top: 0 },
    { width: borderWidth, height, left: 0, top: 0 },
    { width: borderWidth, height, left: width - borderWidth, top: 0 },
    { width, height: borderWidth, left: 0, top: height - borderWidth },
  ];
  let [tr,tg,tb]=[0,0,0];
  for (const rectangle of rectangles) {
    const { r, g, b, alpha } = await image
      .extract(rectangle)
      .stats()
      .then(stats => ({
        r: stats.channels[0].mean,
        g: stats.channels[1].mean,
        b: stats.channels[2].mean,
        alpha: stats.channels[3] ? stats.channels[3].mean : 1
      }));

    const averageColor = { r: Math.round(r), g: Math.round(g), b: Math.round(b), alpha };
    tr += averageColor.r;
    tg += averageColor.g;
    tb += averageColor.b;
  }
  return {
    r: Math.round(tr / rectangles.length),
    g: Math.round(tg / rectangles.length),
    b: Math.round(tb / rectangles.length),
    alpha: 1
  };
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




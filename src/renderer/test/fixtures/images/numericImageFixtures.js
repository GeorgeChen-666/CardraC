import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const numericImagesDir = path.resolve(__dirname, 'numeric-images');

export const getNumericImagePath = (index) => path.join(numericImagesDir, `${index}.png`);

export const createOpenImageResult = (index) => [{
  face: {
    path: getNumericImagePath(index),
    mtime: 1700000000000 + index,
    ext: 'png',
  },
  back: null,
}];

export const createOpenMultiImageResult = (...indexes) => indexes.map((index) => ({
  face: {
    path: getNumericImagePath(index),
    mtime: 1700000000000 + index,
    ext: 'png',
  },
  back: null,
}));



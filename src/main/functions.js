const fs = require('fs');


export const readFileToData = async (filePath, format = '') => {
  const data = await fs.readFileSync(filePath);
  const formatedData = format ? data.toString(format) : data.toString();
  return formatedData;
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




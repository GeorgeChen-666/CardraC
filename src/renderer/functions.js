import { ipcRenderer } from 'electron';

export const emptyImg = {
  path: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEV/f3+QyhsjAAAACklEQVQI\n' +
    '12NgAAAAAgAB4iG8MwAAAABJRU5ErkJggg==',
  ext: 'png',
};

export const isDev = 'ELECTRON_IS_DEV' in process?.env;

function isPromise(obj) {
  return !!obj && typeof obj.then === 'function' && typeof obj.catch === 'function';
}

export const getResourcesPath = (path) => (isDev ? '' : '..') + path;

export const isObject = data => typeof data === 'object' && data?.constructor === Object;

export const getImageSrc = imageData => OverviewStorage[imageData?.path?.replaceAll('\\', '')] || ImageStorage[imageData?.path?.replaceAll('\\', '')] || emptyImg.path;

export const base64ImageToBlob = (imageData) => new Promise((resolve) => {
  const base64Data = imageData.data.split(';base64,')[1] || imageData.data;
  const returnKey = `base64-to-buffer-return-${imageData.path.replaceAll('\\', '')}`;
  ipcRenderer.send('base64-to-buffer', {
    base64Data,
    returnChannel: returnKey,
  });
  const onEvent = (event, returnValue) => {
    ipcRenderer.off(returnKey, onEvent);
    const contentType = 'image/' + imageData.ext;
    const raw = returnValue;
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    resolve(new Blob([uInt8Array], { type: contentType }));
  };
  ipcRenderer.on(returnKey, onEvent);
});


export const fillByObjectValue = (source, value) => {
  if (isObject(source) && isObject(value)) {
    Object.keys(value).forEach(key => {
      const newValue = value[key];
      if (isObject(newValue)) {
        if (!isObject(source[key])) {
          source[key] = {};
        }
        fillByObjectValue(source[key], newValue);
      } else {
        source[key] = newValue;
      }
    });
  }
};


const mergeState = (state) => {
  const newState = JSON.parse(JSON.stringify(state));
  const { ImageStorage, OverviewStorage } = window;
  return { ...newState, ImageStorage, OverviewStorage };
};


ipcRenderer.on('console', (ev, ...args) => console.log(...args));
export const onOpenProjectFile = (dispatch, Actions, cb) => {
  ipcRenderer.on('open-project-file', async (event, data) => {
    const newState = JSON.parse(data)
    await cb(newState);
    dispatch(Actions.StateFill(newState));
  });
};

export const reloadLocalImage = ({ path, mtime }) => {
  const result = callMain('reload-local-image', { returnChannel: 'reload-local-image-return' + path, path, mtime });
  console.log({ path, mtime }, result);
  return result;
};

export const openImage = (key) => callMain('open-image', {
  returnChannel: 'open-image-return' + key,
}, async imageDatas => {
  if (imageDatas.length === 0) return;
  const imageData = imageDatas[0];
  imageData.ext = imageData.path.split('.').pop();
  const imagePathKey = imageData?.path.replaceAll('\\','');
  window.OverviewStorage[imagePathKey] = imageData.overviewData;
  delete imageData.data;
  delete imageData.overviewData;
  return imageData;
});

export const openMultiImage = (key) => callMain('open-image', {
  properties: ['multiSelections'],
  returnChannel: 'open-multi-image-return' + key,
}, async imageDatas => {
  const newImageDatas = [...imageDatas];
  for (const imageData of newImageDatas) {
    imageData.ext = imageData.path.split('.').pop();
    const imagePathKey = imageData?.path.replaceAll('\\','');
    window.OverviewStorage[imagePathKey] = imageData.overviewData;
    delete imageData.data;
    delete imageData.overviewData;
  }
  return newImageDatas;
});

export const exportPdf = ({ state, onProgress }) => {
  const key = 'export-pdf';
  if (onProgress) {
    const onMainProgress = ($, value) => {
      onProgress(value);
      if (value >= 100) {
        ipcRenderer.off(`${key}-progress`, onMainProgress);
      }
    };
    ipcRenderer.on(`${key}-progress`, onMainProgress);
  }
  return callMain(key, { state: mergeState(state) });
};

export const saveProject = ({ state }) => callMain('save-project', { state: mergeState(state) });

export const openProject = () => callMain('open-project', {
    properties: [],
  },
  data => data);

export const loadConfig = () => callMain('load-config');

export const saveConfig = ({ state }) => callMain('save-config', { state: mergeState(state) });

const callMain = (key, params, transform = d => d) => new Promise((resolve) => {
  const returnKey = params?.returnChannel || `${key}-done`;
  ipcRenderer.send(key, {
    returnChannel: returnKey,
    ...params,
  });

  const onDone = (event, data) => {
    ipcRenderer.off(returnKey, onDone);
    const newData = transform(data);
    if (isPromise(newData)) {
      newData.then(nd => {
        resolve(nd);
      });
    } else {
      resolve(newData);
    }
  };
  ipcRenderer.on(returnKey, onDone);
});
import { ipcRenderer } from 'electron';
import { eleActions, emptyImg } from '../shared/constants';
// import { Actions, store } from './store';
import { i18nInstance } from './i18n';
import { triggerNotification } from './parts/Notification';
import { useGlobalStore } from './state/store';



export const isDev = process?.env?.NODE_ENV === 'development';

function isPromise(obj) {
  return !!obj && typeof obj.then === 'function' && typeof obj.catch === 'function';
}

export const getResourcesPath = (path) => (isDev ? '' : '..') + path;

export const isObject = data => typeof data === 'object' && data?.constructor === Object;

export const getImageSrc = (imageData, {quality = 'low', version = 1}) =>
  imageData?.path
    ? `cardrac://image/${imageData.path.replaceAll('\\', '')}?quality=${quality}&version=${version}`
    : emptyImg.path;

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

ipcRenderer.on('notification', (ev, args) => {
  return triggerNotification({...args, description: i18nInstance.t(args.description)})
});

ipcRenderer.on('console', (ev, ...args) => console.log(...args));

export const onOpenProjectFile = (cb) => {
  ipcRenderer.once('open-project-file', async (event, data) => {
    // dispatch(Actions.GlobalEdit({isLoading: true, loadingText: ''}));
    console.log('open-project-file ',data);
    cb && await cb(data);
    // dispatch(Actions.StateFill(data));
    // dispatch(Actions.GlobalEdit({isLoading: false, isInProgress:false, loadingText: ''}));
  });
};

export const getMainImage = (args) => ipcRenderer.invoke(eleActions.getImageContent, args);

export const clearPreviewCache = (args) => ipcRenderer.invoke(eleActions.clearPreviewCache, args);

export const openImage = (key) => callMain(eleActions.openImage, {
  returnChannel: `${eleActions.openImage}-return-${key}`,
}, async imageDatas => {
  if (imageDatas.length === 0) return;
  const imageData = imageDatas[0];
  imageData.ext = imageData.path.split('.').pop();
  return imageData;
});

export const openMultiImage = (key) => callMain(eleActions.openImage, {
  properties: ['multiSelections'],
  returnChannel: `${eleActions.openImage}-return-Multi-${key}`,
}, async imageDatas => {
  const newImageDatas = [...imageDatas];
  for (const imageData of newImageDatas) {
    imageData.ext = imageData.path.split('.').pop();
  }
  return newImageDatas;
});


export const loadConfig = () => callMain(eleActions.loadConfig);

export const setTemplate = (args) => callMain('set-template', { ...args });
export const editTemplate = (args) => callMain('edit-template', { ...args });
export const getTemplate = (args) => callMain('get-template', { ...args });
export const deleteTemplate = (args) => callMain('delete-template', { ...args });
export const version = () => callMain('version');

let updateProgress = () => {};
export const regUpdateProgress = cb => updateProgress = cb;
export const callMain = (key, params = {}, transform = d => d) => new Promise((resolve) => {
  const { returnChannel, onProgress, progressChannel, cancelCallback, ...restParams } = params;
  const returnKey = returnChannel || `${key}-done`;
  const progressKey = progressChannel || `${key}-progress`;
  const cancelKey = `${key}-cancel`;

  cancelCallback && cancelCallback(() => {
    ipcRenderer.off(progressKey, onMainProgress);
    ipcRenderer.off(returnKey, onDone);
    ipcRenderer.send(cancelKey);
    onMainProgress(null, 0);
  });
  if(restParams.state) {
    restParams.state = JSON.parse(JSON.stringify(restParams.state));
  }
  ipcRenderer.send(key, {
    returnChannel: returnKey,
    progressChannel: progressKey,
    ...restParams,
  });

  let lastProgress = -1;
  const onMainProgress = ($, value) => {
    const currentProgress = Math.round(value * 100);
    if(currentProgress>lastProgress) {
      if(onProgress) {
        onProgress(currentProgress);
      }
      else {
        updateProgress(currentProgress);
      }
    }
    if (Math.round(value * 100) >= 100) {
      updateProgress(-1);
      lastProgress = -1;
      ipcRenderer.off(progressKey, onMainProgress);
    }
  };
  ipcRenderer.once(progressKey, onMainProgress);

  const onDone = (event, data) => {
    ipcRenderer.off(progressKey, onMainProgress);
    ipcRenderer.off(returnKey, onDone);
    const newData = transform(data);
    const resolveData = (rs) => {
      if(data instanceof Uint8Array) {
        resolve(new TextDecoder().decode(rs))
      }
      resolve(rs);
    }
    if (isPromise(newData)) {
      newData.then(nd => {
        resolveData(nd);
      });
    } else {
      resolveData(newData);
    }
  };
  ipcRenderer.once(returnKey, onDone);
});

function isPlainObject(obj) {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

/**
 * 深度不可变合并，数组或对象的任意子字段引用变化时，父级对象/数组也会新建引用
 */
export function immutableMerge(oldVal, newVal) {
  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    return oldVal !== newVal ? newVal : oldVal;
  }
  if (isPlainObject(oldVal) && isPlainObject(newVal)) {
    // 对象递归合并
    const result = { ...oldVal };
    for (const key of Object.keys(newVal)) {
      result[key] = immutableMerge(oldVal[key], newVal[key]);
    }
    return result;
  }
  // 其它类型直接替换
  return newVal;
}

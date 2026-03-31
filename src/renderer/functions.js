import { ipcRenderer } from 'electron';
import { eleActions, emptyImg } from '../shared/constants';
// import { Actions, store } from './store';
import { i18nInstance } from './i18n';
import { triggerNotification } from './parts/Notification';
import { useGlobalStore } from './state/store';
import { filePathToImageKey, fixPath } from '../shared/functions';



export const isDev = process?.env?.NODE_ENV === 'development';

function isPromise(obj) {
  return !!obj && typeof obj.then === 'function' && typeof obj.catch === 'function';
}

export const getResourcesPath = (path) => (isDev ? '' : '..') + path;

export const isObject = data => typeof data === 'object' && data?.constructor === Object;

export const getImageSrc = (imageData, {quality = 'low', version = 1}) =>
  imageData?.path
    ? `cardrac://image/${filePathToImageKey(fixPath(imageData.path))}?quality=${quality}&version=${version}`
    : emptyImg.path;

export const fillByObjectValue = (source, value) => {
  if (!isObject(source) || !isObject(value)) {
    return value;
  }
  const result = { ...source };
  Object.keys(value).forEach(key => {
    const newValue = value[key];
    if (newValue === null || newValue === undefined) {
      result[key] = newValue;
    } else if (isObject(newValue)) {
      // 递归创建新对象
      result[key] = fillByObjectValue(source[key] || {}, newValue);
    } else {
      result[key] = newValue;
    }
  });
  return result;
};

export const showFileOpenDialog = (params) => new Promise((resolve, reject) => {
  try {
    fileBrowserRef.current?.openDialog({
      multiSelect: false,
      showFileIcon: false,
      filterExtensions: '*',
      ...params,
      onSelect: async (selectedFiles) => {
        if(params.mode ==='save') {
          resolve(selectedFiles?.[0]?.[0])
        } else {
          resolve(selectedFiles)
        }
      }
    });
  }
  catch (e) {
    reject(e);
  }
});

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

export const reloadLocalImage = (params) =>
  callMain(eleActions.reloadLocalImage, params)
export const checkImage = (params) =>
  callMain(eleActions.checkImage, params)
export const clearPreviewCache = () =>
  callMain(eleActions.clearPreviewCache)
export const getExportPreview = (params) =>
  callMain(eleActions.getExportPreview, params)
export const getExportPageCount = (params) =>
  callMain( eleActions.getExportPageCount, params)
export const getTemplate = (params) =>
  callMain(eleActions.getTemplate, { ...params });
export const setTemplate = (params) =>
  callMain(eleActions.setTemplate, { ...params });
export const editTemplate = (params) =>
  callMain(eleActions.editTemplate, { ...params });
export const deleteTemplate = (params) =>
  callMain(eleActions.deleteTemplate, { ...params });
export const loadConfig = (params) =>
  callMain(eleActions.loadConfig, { ...params });
export const saveConfig = (params) =>
  callMain(eleActions.saveConfig, { ...params });
export const openProject = (params) =>
  callMain(eleActions.openProject, params)
export const saveProject = (params) =>
  callMain(eleActions.saveProject, params)
export const loadImageList = (params) =>
  callMain(eleActions.loadImageList, params)
export const exportFile = (params) =>
  callMain(eleActions.exportFile, params)
export const version = (params) =>
  callMain(eleActions.version, params)
export const getDefaultPath = (params) =>
  callMain(eleActions.getDefaultPath, params)
export const setDefaultPath = (params) =>
  callMain(eleActions.setDefaultPath, params)
export const listDrives = (params) =>
  callMain(eleActions.listDrives, params)
export const browsePath = (params) =>
  callMain(eleActions.browsePath, params)

export const openMultiImage = (isDoubleSides) => openImage(isDoubleSides, true)
export const openImage = async (isDoubleSides, isMultiImage = false) => {
  const selectedFiles = await showFileOpenDialog({multiSelect: true, filterExtensions: 'jpg,png,gif',isDoubleSides, showFileIcon: true});
  const convertFn = (data) => data ? {
    ext: data.ext,
    mtime: data.modified,
    path: data.safePath
  } : data;
  const paramFiles = selectedFiles.map(f => ({
    face: convertFn(f[0]),
    back: convertFn(f[1]),
  }))

  const allFiles = [];
  paramFiles.forEach(f => {
    if (f.face) allFiles.push(f.face);
    if (f.back) allFiles.push(f.back);
  });

  if (allFiles.length > 0) {
    try {
      const result = await loadImageList({ imageList: allFiles })
      console.log('Background loading started:', result);

      if (!result.success) {
        console.warn('Some images failed to start loading:', result);
      }
    } catch (error) {
      console.error('Failed to trigger background image loading:', error);
      // 不阻止返回结果，只是记录错误
    }
  }

  return paramFiles;
}

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

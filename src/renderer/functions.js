import { eleActions, emptyImg } from '../shared/constants';
import { fixPath } from '../main/utils';
import { wsAdapter } from './wsAdapter';

export const isDev = process?.env?.NODE_ENV === 'development';

function isPromise(obj) {
  return !!obj && typeof obj.then === 'function' && typeof obj.catch === 'function';
}

export const getResourcesPath = (path) => (isDev ? '' : '..') + path;

export const isObject = data => typeof data === 'object' && data?.constructor === Object;

export const getImageSrc = (imageData, {quality = 'low', version = 1}) => {
  return imageData?.path
    ? `http://localhost:3333/api/${eleActions.getImageContent}?path=${fixPath(imageData.path)}&quality=${quality}&version=${version}`
    : emptyImg.path;
}

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


// json	Object/Array	JSON 数据
// text	String	文本数据
// blob	Blob	图片、文件
// arrayBuffer	ArrayBuffer	二进制数据
// formData	FormData	表单数据
// body	ReadableStream	流式处理
const fetchMain = async (path, params= null, config = {}) => {
  try {
    const fetchConfig = {
      format: 'json',
      method: 'POST',
      ...(config || {})
    }
    const response =  await fetch(`http://localhost:3333/api/${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...fetchConfig,
      ...(params && {body: JSON.stringify(params)})
    });
    return await response[fetchConfig.format]()
  } catch (error) {
    console.error('Failed to trigger background image loading:', error);
  }
}
let updateProgress = () => {};
export const regUpdateProgress = cb => updateProgress = cb;
export const callMain = (key, params = {}, transform = d => d) => new Promise((resolve) => {
  const { returnChannel, onProgress, progressChannel, cancelCallback, ...restParams } = params;
  const returnKey = returnChannel || `${key}-done`;
  const progressKey = progressChannel || `${key}-progress`;
  const cancelKey = `${key}-cancel`;

  cancelCallback && cancelCallback(() => {
    wsAdapter.off(progressKey, onMainProgress);
    wsAdapter.off(returnKey, onDone);
    wsAdapter.send(cancelKey);
    onMainProgress(null, 0);
  });
  if(restParams.state) {
    restParams.state = JSON.parse(JSON.stringify(restParams.state));
  }
  wsAdapter.send(key, {
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
      wsAdapter.off(progressKey, onMainProgress);
    }
  };
  wsAdapter.once(progressKey, onMainProgress);

  const onDone = (data) => {
    wsAdapter.off(progressKey, onMainProgress);
    wsAdapter.off(returnKey, onDone);
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
  wsAdapter.once(returnKey, onDone);
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
export const getImageContent = (params) =>
  callMain(eleActions.getImageContent, params)

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

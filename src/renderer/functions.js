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

export const getImageSrc = (imageData, {quality = 'low', version = 1}) => {
  // imageData?.path
  //   ? `cardrac://image/${imageData.path.replaceAll('\\', '')}?quality=${quality}&version=${version}`
  //   : emptyImg.path;
  return imageData?.path
    ? `http://localhost:3333/images/${eleActions.getImageContent}?path=${imageData.path.replaceAll('\\', '')}&quality=${quality}&version=${version}`
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
const fetchMain = async (path, params) => {
  try {
    const response = await fetch(`http://localhost:3333/${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...params,
    });
    return response;
  } catch (error) {
    console.error('Failed to trigger background image loading:', error);
  }
}
export const getExportPreview = async (args) => {
  const response = await fetchMain(`images/${eleActions.getExportPreview}`, {
    method: 'POST',
    body: JSON.stringify(args)
  });
  const result = await response.text()
  return result;
}
export const getExportPageCount = async (param) => {
  try {
    const response = await fetchMain( `images/${eleActions.getExportPageCount}`, {
      method: 'POST',
      body: JSON.stringify(param)
    });

    const result = await response.json();
    return result.count;
  } catch (error) {
  }
}
export const openProject = () => new Promise((res, rej) => {
  try {
    fileBrowserRef.current?.openDialog({
      multiSelect: false,
      filterExtensions: 'cpnp',
      showFileIcon: false,
      onSelect: async (selectedFiles) => {
        const convertFn = (data) => data ? {
          ext: data.ext,
          mtime: data.modified,
          path: data.safePath
        } : data;
        const paramFiles = selectedFiles.map(f => ({
          face: convertFn(f.face),
          back: convertFn(f.back),
        }))

        res(paramFiles);
      }
    });
  }
  catch (e) {
    rej(e);
  }
})
export const openMultiImage = (isDoubleSides) => new Promise((res,rej) => {
  try {
    fileBrowserRef.current?.openDialog({
      multiSelect: true,
      filterExtensions: 'jpg,png,gif',
      isDoubleSides,
      showFileIcon: true,
      onSelect: async (selectedFiles) => {
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
            const response = await fetchMain(`images/${eleActions.loadImageList}`, {
              method: 'POST',
              body: JSON.stringify({ imageList: allFiles })
            });

            const result = await response.json();
            console.log('Background loading started:', result);

            if (!result.success) {
              console.warn('Some images failed to start loading:', result);
            }
          } catch (error) {
            console.error('Failed to trigger background image loading:', error);
            // 不阻止返回结果，只是记录错误
          }
        }

        res(paramFiles);
      }
    });
  }
  catch (e) {
    rej(e);
  }
})

export const openImage = (key) => callMain(eleActions.openImage, {
  returnChannel: `${eleActions.openImage}-return-${key}`,
}, async imageDatas => {
  if (imageDatas.length === 0) return;
  const imageData = imageDatas[0];
  imageData.ext = imageData.path.split('.').pop();
  return imageData;
});

// export const openMultiImage = (key) => callMain(eleActions.openImage, {
//   properties: ['multiSelections'],
//   returnChannel: `${eleActions.openImage}-return-Multi-${key}`,
// }, async imageDatas => {
//   const newImageDatas = [...imageDatas];
//   for (const imageData of newImageDatas) {
//     imageData.ext = imageData.path.split('.').pop();
//   }
//   return newImageDatas;
// });


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

import { ipcRenderer } from 'electron';
import { eleActions } from '../public/constants';
import { Actions, store } from './store';
import { i18nInstance } from './i18n';

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

export const getImageSrc = imageData => OverviewStorage[imageData?.path?.replaceAll?.('\\', '')] || emptyImg.path;

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

let notificationList = [];
export let triggerNotification = (args) => {
  notificationList.push(args);
};
export const getNotificationTrigger = () => triggerNotification
export const regNotification = (cb) => {
  triggerNotification = cb;
  if(notificationList.length > 0) {
    notificationList.forEach(arg => {
      cb(arg);
    });
    notificationList = [];
  }
}

export const notificationSuccess = () => triggerNotification({
  description: i18nInstance.t('util.success'),
  status: 'success',
  duration: 9000,
  isClosable: true,
});
ipcRenderer.on('notification', (ev, args) => {
  return triggerNotification({...args, description: i18nInstance.t(args.description)})
});

ipcRenderer.on('console', (ev, ...args) => console.log(...args));

export const onOpenProjectFile = (dispatch, Actions, cb) => {
  ipcRenderer.on('open-project-file', async (event, data) => {
    dispatch(Actions.GlobalEdit({isLoading: true, loadingText: ''}));
    cb && await cb(data);
    dispatch(Actions.StateFill(data));
    dispatch(Actions.GlobalEdit({isLoading: false, isInProgress:false, loadingText: ''}));
  });
};

export const reloadLocalImage = (args) => callMain(eleActions.reloadLocalImage, args);

export const openImage = (key) => callMain(eleActions.openImage, {
  returnChannel: `${eleActions.openImage}-return-${key}`,
}, async imageDatas => {
  if (imageDatas.length === 0) return;
  const imageData = imageDatas[0];
  imageData.ext = imageData.path.split('.').pop();
  if(imageData.overviewData) {
    const imagePathKey = imageData?.path.replaceAll('\\','');
    window.OverviewStorage[imagePathKey] = imageData.overviewData;
    delete imageData.overviewData;
  }
  return imageData;
});

export const openMultiImage = (key) => callMain(eleActions.openImage, {
  properties: ['multiSelections'],
  returnChannel: `${eleActions.openImage}-return-Multi-${key}`,
}, async imageDatas => {
  const newImageDatas = [...imageDatas];
  for (const imageData of newImageDatas) {
    imageData.ext = imageData.path.split('.').pop();
    if(imageData.overviewData) {
      const imagePathKey = imageData?.path.replaceAll('\\','');
      window.OverviewStorage[imagePathKey] = imageData.overviewData;
      delete imageData.overviewData;
    }
  }
  return newImageDatas;
});

export const getImagePath = () => callMain(eleActions.getImagePath);
export const checkImage = ({ pathList }) => callMain(eleActions.checkImage, { pathList });

export const exportPdf = (args) => callMain('export-pdf', args);

//export const saveProject = ({ state }) => callMain(eleActions.saveProject, { state: refreshCardStorage(state) });
export const saveProject = (args) => callMain(eleActions.saveProject, args);

export const openProject = () => callMain(eleActions.openProject, {
    properties: [],
  });

export const loadConfig = () => callMain(eleActions.loadConfig);

export const saveConfig = ({ state }) => callMain(eleActions.saveConfig, { state });

export const setTemplate = (args) => callMain('set-template', { ...args });
export const editTemplate = (args) => callMain('edit-template', { ...args });
export const getTemplate = (args) => callMain('get-template', { ...args });
export const deleteTemplate = (args) => callMain('delete-template', { ...args });
export const version = () => callMain('version');

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

  const onMainProgress = ($, value) => {
    if(onProgress) {
      onProgress(value);
    }
    else {
      store.dispatch(Actions.GlobalEdit({ isInProgress:true, progress: value }));
    }
    if (Math.round(value * 100) >= 100) {
      store.dispatch(Actions.GlobalEdit({ isInProgress: false }));
      ipcRenderer.off(progressKey, onMainProgress);
    }
  };
  ipcRenderer.on(progressKey, onMainProgress);

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
  ipcRenderer.on(returnKey, onDone);
});
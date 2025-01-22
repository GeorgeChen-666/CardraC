import { ipcRenderer } from 'electron';
import { eleActions } from '../public/constants';

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

export const getImageSrc = imageData => OverviewStorage[imageData?.path?.replaceAll('\\', '')] || emptyImg.path;

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
  const { OverviewStorage } = window;
  return { ...newState, OverviewStorage };
};

let triggerNotification = () => {};
export const getNotificationTrigger = () => triggerNotification
export const regNotification = (cb) => {
  triggerNotification = cb;
}
ipcRenderer.on('notification', (ev, ...args) => triggerNotification(...args));

ipcRenderer.on('console', (ev, ...args) => console.log(...args));
export const onOpenProjectFile = (dispatch, Actions, cb) => {
  ipcRenderer.on('open-project-file', async (event, data) => {
    const newState = JSON.parse(data)
    await cb(newState);
    dispatch(Actions.StateFill(newState));
  });
};

export const reloadLocalImage = (args) => callMain('reload-local-image', {...args, state: mergeState(args.state)});

export const openImage = (key) => callMain(eleActions.openImage, {
  returnChannel: `${eleActions.openImage}-return-${key}`,
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

export const openMultiImage = (key) => callMain(eleActions.openImage, {
  properties: ['multiSelections'],
  returnChannel: `${eleActions.openImage}-return-Multi-${key}`,
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
export const getImagePath = () => callMain(eleActions.getImagePath);
export const checkImage = ({ pathList }) => callMain(eleActions.checkImage, { pathList });

export const exportPdf = ({ state, onProgress }) => callMain('export-pdf', { state, onProgress });

export const saveProject = ({ state }) => callMain(eleActions.saveProject, { state: mergeState(state) });

export const openProject = () => callMain(eleActions.openProject, {
    properties: [],
  });

export const loadConfig = () => callMain(eleActions.loadConfig);

export const saveConfig = ({ state }) => callMain(eleActions.saveConfig, { state: mergeState(state) });

export const setTemplate = (args) => callMain('set-template', { ...args });
export const editTemplate = (args) => callMain('edit-template', { ...args });
export const getTemplate = (args) => callMain('get-template', { ...args });
export const deleteTemplate = (args) => callMain('delete-template', { ...args });
export const version = () => callMain('version');

const callMain = (key, params = {}, transform = d => d) => new Promise((resolve) => {
  const { returnChannel, onProgress, progressChannel, ...restParams } = params;
  const returnKey = returnChannel || `${key}-done`;
  const progressKey = progressChannel || `${key}-progress`;
  ipcRenderer.send(key, {
    returnChannel: returnKey,
    progressChannel: progressKey,
    ...restParams,
  });

  const onMainProgress = ($, value) => {
    onProgress && onProgress(value);
    if (value >= 100) {
      ipcRenderer.off(progressKey, onMainProgress);
    }
  };
  if (onProgress) {
    ipcRenderer.on(progressKey, onMainProgress);
  }

  const onDone = (event, data) => {
    ipcRenderer.off(progressKey, onMainProgress);
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
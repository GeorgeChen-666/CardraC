import { ipcRenderer } from 'electron';

export const isDev = 'ELECTRON_IS_DEV' in process?.env;

export const getResourcesPath = (path) => (isDev?'':'..') + path;

export const isObject = data => typeof data === 'object' && data?.constructor === Object

export function base64ImageToBlob(base64Data, ext) {
  const contentType = 'image/' + ext
  const raw = window.atob(base64Data);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], {type: contentType});
}

export const fillByObjectValue = (source,value) => {
  if(isObject(source) && isObject(value)) {
    Object.keys(value).forEach(key => {
      const newValue = value[key];
      if(isObject(newValue)) {
        if(!isObject(source[key])) {
          source[key] = {};
        }
        fillByObjectValue(source[key], newValue);
      } else {
        source[key] = newValue;
      }
    });
  }
}

export const openImage = (key) => new Promise((resolve) => {
  const returnKey = 'open-image-return' + key;
  ipcRenderer.send('open-image', {
    returnChannel: returnKey
  });
  const onFileOpen = (event, filePaths) => {
    ipcRenderer.off(returnKey, onFileOpen);
    resolve(filePaths.map(p => ({...p, ext: p.path.split('.').pop()}))?.[0])
  }
  ipcRenderer.on(returnKey, onFileOpen);
});

export const openMultiImage = (key) => new Promise((resolve)=>{
  const returnKey = 'open-multi-image-return' + key;
  ipcRenderer.send('open-image', {
    properties: ['multiSelections'],
    returnChannel: returnKey
  });
  const onFileOpen = (event, filePaths) => {
    ipcRenderer.off(returnKey, onFileOpen);
    resolve(filePaths.map(p => ({...p, ext: p.path.split('.').pop()})))
  }
  ipcRenderer.on(returnKey, onFileOpen);
});

export const exportPdf = ({ state, onProgress }) => new Promise((resolve)=>{
  ipcRenderer.send('export-pdf', {
    state: JSON.parse(JSON.stringify(state))
  });

  if(onProgress) {
    const onMainProgress = ($,value) => {
      onProgress(value);
      if(value >= 100) {
        ipcRenderer.off('export-pdf-progress', onMainProgress);
      }
    }
    ipcRenderer.on('export-pdf-progress', onMainProgress);
  }
  const onMainDone = () => {
    resolve();
    ipcRenderer.off('export-pdf-done', onMainDone);
  }
  ipcRenderer.on('export-pdf-done', onMainDone);
});

export const saveProject = ({ state }) => new Promise((resolve)=>{
  ipcRenderer.send('save-project', {
    state: JSON.parse(JSON.stringify(state))
  });
  ipcRenderer.on('save-project-done', resolve);
  ipcRenderer.off('save-project-done', resolve);
});
export const openProject = () => new Promise((resolve)=>{
  ipcRenderer.send('open-project', {
    properties: [],
    returnChannel: 'open-project-return'
  });
  const onFileOpen = (event, data) => {
    ipcRenderer.off('open-project-return', onFileOpen);
    resolve(JSON.parse(data));
  }
  ipcRenderer.on('open-project-return', onFileOpen);
});

export const loadConfig = () => new Promise((resolve) => {
  ipcRenderer.send('load-config');
  const onDone = (event, data) => {
    ipcRenderer.off('load-config-done', onDone);
    resolve(data);
  }
  ipcRenderer.on('load-config-done', onDone);
});

export const saveConfig = ({ state }) => new Promise((resolve) => {
  ipcRenderer.send('save-config', {
    state: JSON.parse(JSON.stringify(state))
  });
  const onDone = (event, data) => {
    ipcRenderer.off('save-config-done', onDone);
    resolve(data);
  }
  ipcRenderer.on('save-config-done', onDone);
});
import { ipcRenderer } from 'electron';

export const isDev = 'ELECTRON_IS_DEV' in process?.env;

export const getResourcesPath = (path) => (isDev?'':'..') + path;

export const isObject = data => typeof data === 'object' && data?.constructor === Object

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

export const openImage = () => new Promise((resolve) => {
  ipcRenderer.send('open-image', {
    returnChannel: 'open-image-return'
  });
  const onFileOpen = (event, filePaths) => {
    ipcRenderer.off('open-image-return', onFileOpen);
    resolve(filePaths.map(p => ({...p, ext: p.path.split('.').pop()}))?.[0])
  }
  ipcRenderer.on('open-image-return', onFileOpen);
});

export const openMultiImage = () => new Promise((resolve)=>{
  ipcRenderer.send('open-image', {
    properties: ['multiSelections'],
    returnChannel: 'open-image-return'
  });
  const onFileOpen = (event, filePaths) => {
    ipcRenderer.off('open-image-return', onFileOpen);
    resolve(filePaths.map(p => ({...p, ext: p.path.split('.').pop()})))
  }
  ipcRenderer.on('open-image-return', onFileOpen);
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
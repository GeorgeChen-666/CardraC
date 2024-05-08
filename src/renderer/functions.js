import { ipcRenderer } from 'electron';

export const isDev = 'ELECTRON_IS_DEV' in process?.env;

export const getResourcesPath = (path) => (isDev?'':'..') + path;

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
    ipcRenderer.on('export-pdf-progress', onProgress);
  }

  ipcRenderer.on('export-pdf-done', resolve);
  ipcRenderer.off('export-pdf-progress', onProgress);
  ipcRenderer.off('export-pdf-done', resolve);
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
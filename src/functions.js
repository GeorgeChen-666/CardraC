import { ipcRenderer } from 'electron';

export const isDev = 'ELECTRON_IS_DEV' in process?.env;

export const getResourcesPath = (path) => (isDev?'':'..') + path;

export const openImage = () => new Promise((resolve)=>{
  ipcRenderer.send('open-image', {
    returnChannel: 'open-image-return'
  });
  const onFileOpen = (event, filePaths) => {
    ipcRenderer.off('open-image-return', onFileOpen);
    resolve(filePaths.map(p => ({path: p, ext: p.split('.').pop()}))?.[0])
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
    resolve(filePaths.map(p => ({path: p, ext: p.split('.').pop()})))
  }
  ipcRenderer.on('open-image-return', onFileOpen);
});

export const exportPdf = ({ doc, state, onProgress }) => new Promise((resolve)=>{
  ipcRenderer.send('export-pdf', {
    state: JSON.parse(JSON.stringify(state))
  });
  if(onProgress) {
    ipcRenderer.on('export-pdf-progress', onProgress);
  }

  ipcRenderer.on('export-pdf-done', () => {
    console.log('done!')
    resolve()
  });
});

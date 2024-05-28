import { ipcRenderer } from 'electron';
import Compressor  from 'compressorjs';

export const isDev = 'ELECTRON_IS_DEV' in process?.env;

export const getResourcesPath = (path) => (isDev?'':'..') + path;

export const isObject = data => typeof data === 'object' && data?.constructor === Object

export const compressImage = (data, contentType) => new Promise((resolve) => {
  base64ImageToBlob(data, contentType).then(imageBlob => {
    new Compressor(imageBlob, {
      quality: 0.6,
      maxWidth: 1600,
      convertSize: 5000000,
      success(result) {
        console.log(`from ${imageBlob.size} to ${result.size}`)
        const reader = new FileReader();
        reader.onload = function(event) {
          const base64String = event.target.result;
          resolve(base64String);
        };
        reader.readAsDataURL(result);
      },
      error(err) {
        console.log(err.message);
      },
    });
  })
});

export const base64ImageToBlob = (base64Data, ext) => new Promise((resolve) => {
  const returnKey = 'base64-to-buffer-return';
  ipcRenderer.send('base64-to-buffer', {
    base64Data,
    returnChannel: returnKey
  });
  const onEvent = (event, returnValue) => {
    ipcRenderer.off(returnKey, onEvent);
    const contentType = 'image/' + ext;
    const raw = returnValue;
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    resolve(new Blob([uInt8Array], {type: contentType}));
  }
  ipcRenderer.on(returnKey, onEvent);
});


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
ipcRenderer.on('console', (ev,...args) => console.log(...args));
export const onOpenProjectFile = (dispatch, Actions, cb) => {
  ipcRenderer.on('open-project-file', async (event, data) => {
    dispatch(Actions.StateFill(JSON.parse(data)));
    cb();
  });
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
  const newState = JSON.parse(JSON.stringify(state));
  const { ImageStorage } = newState;

  (async () => {
    for(const key of Object.keys(ImageStorage)) {
      const base64String = ImageStorage[key];
      if(base64String?.length > 1024 * 1024 * 1.3) {
        const ext = key.split('.').pop();
        const newImage = await compressImage(base64String, ext);
        ImageStorage[key] = newImage;
      }
    }

    ipcRenderer.send('export-pdf', {
      state: newState
    });
  })()



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
import React from 'react';
import { createSlice, configureStore } from '@reduxjs/toolkit';
import _ from 'lodash';
import logger from 'redux-logger';
import { Provider } from 'react-redux';
import { fillByObjectValue, loadConfig, saveConfig, base64ImageToBlob, onOpenProjectFile } from './functions';
import { readFileToData } from '../main/functions';

export const initialState = Object.freeze({
  Global: {
    availableLangs: [],
    currentLang: 'zh',
    projectPath: '',
    isInProgress: false,
    progress: 0,
    lastSelection: null,
    isBackEditing: false,
    selections: [],
    blobLinks: {},
  },
  Config: {
    pageSize: 'A4:210,297',
    pageWidth: 210,
    pageHeight: 297,
    scale: 100,
    offsetX: 0,
    offsetY: 0,
    landscape: true,
    sides: 'double sides',
    autoConfigFlip: true,
    flip: 'long-edge binding',
    cardWidth: 65,
    cardHeight: 90,
    marginX: 1,
    marginY: 1,
    bleed: 1,
    columns: 4,
    rows: 2,
    autoColumnsRows: true,
    fCutLine: '1',
    bCutLine: '1',
    lineWeight: 1.5,
    cutlineColor: '#000000',
    globalBackground: null,
    avoidDislocation: false
  },
  CardList: [],
});
window.ImageStorage = {};
export const reloadImageFromFile = async () => {
  const state = store.getState();
  const {CardList, Config} = state.pnp;
  const ImageCache = {};
  const blobLinksCache = {};
  const loadImage = async(image) => {
    if(!image) return;
    try {
      const imagePathKey = image?.path.replaceAll('\\','');
      ImageCache[imagePathKey] = await readFileToData(image?.path ,'base64');
      const newBlob = await base64ImageToBlob(ImageCache[imagePathKey], image?.ext);
      ImageCache[imagePathKey] && (blobLinksCache[imagePathKey] = URL.createObjectURL(newBlob));
    } catch (e) {
      console.log(e);
    }

  }
  for(let card of CardList) {
    const {face,back} = card;
    await loadImage(face);
    await loadImage(back);
  }
  if(Config.globalBackground?.path) {
    await loadImage(Config.globalBackground);
  }
  store.dispatch(Actions.UpdateStorage(ImageCache));
  store.dispatch(Actions.GlobalEdit({ blobLinks: blobLinksCache }));
}
//ugly code
const storeCardImage = (state) => {
  const {CardList, Config} = state;
  const { ImageStorage } = window;
  const usedImagePath = new Set();
  const storeImage = image => {
    if(!image) return;
    const imagePathKey = image?.path.replaceAll('\\','');
    if(image?.data) {
      if(!Object.keys(ImageStorage).includes(imagePathKey)) {
        ImageStorage[imagePathKey] = image?.data;
      }
      delete image?.data;
    }
  }
  CardList.forEach(card => {
    const {face,back} = card;
    const facePathKey  = face?.path.replaceAll('\\','');
    const backPathKey  = back?.path.replaceAll('\\','');
    usedImagePath.add(facePathKey);
    usedImagePath.add(backPathKey);
    storeImage(face);
    storeImage(back);
  });

  if(Config.globalBackground?.path) {
    const globalBackPathKey = Config.globalBackground?.path?.replaceAll('\\','');
    usedImagePath.add(globalBackPathKey);
    storeImage(Config.globalBackground);
  }

  Object.keys(ImageStorage).filter(key=> !usedImagePath.has(key)).forEach(key => delete ImageStorage[key]);
  //updateBlobLinks(state);
}
//ugly code
// const updateBlobLinks = async (state) => {
//   const {Global: {blobLinks}} = state;
//   const { ImageStorage } = window;
//   const _BlobLinks = JSON.parse(JSON.stringify(blobLinks));
//   Object.keys(_BlobLinks).filter(key=> !Object.keys(ImageStorage).includes(key)).forEach(key => {
//     URL.revokeObjectURL(_BlobLinks[key]);
//     delete _BlobLinks[key];
//   });
//   for(const imagePathKey of Object.keys(ImageStorage)) {
//     if(!Object.keys(_BlobLinks).includes(imagePathKey)) {
//       //
//       const ext = imagePathKey.split('.').pop();
//       const newBlob = await base64ImageToBlob(ImageStorage[imagePathKey], ext);
//       ImageStorage[imagePathKey] && (_BlobLinks[imagePathKey] = URL.createObjectURL(newBlob));
//     }
//   }
//   setTimeout(() => {
//     store.dispatch(Actions.GlobalEdit({blobLinks:_BlobLinks}));
//   }, 100)
// }
export const pnpSlice = createSlice({
  name: 'pnp',
  initialState,
  reducers: {
    StateFill: (state, action) => {
      const { ImageStorage } = action.payload;
      fillByObjectValue(window.ImageStorage, ImageStorage);
      delete action.payload.ImageStorage;
      fillByObjectValue(state, action.payload);
      storeCardImage(state);
      saveConfig({state});
    },
    GlobalEdit: (state, action) => {
      fillByObjectValue(state.Global, action.payload);
      saveConfig({state});
    },
    CardSelect: (state, action) => {
      const selectedId = action.payload;
      const selection = state.CardList.filter(c => c.selected);
      if (_.some(selection, { id: selectedId }) && selection.length === 1) {
        selection.forEach(c => c.selected = false);
        state.Global.lastSelection = null;
      } else {
        selection.forEach(c => c.selected = false);
        const selectedCard = state.CardList.find(c => c.id === selectedId);
        selectedCard && (selectedCard.selected = true);
        state.Global.lastSelection = selectedId;
      }
    },
    CardCtrlSelect: (state, action) => {
      const selectedId = action.payload;
      const selectedCard = state.CardList.find(c => c.id === selectedId);
      selectedCard.selected = !selectedCard.selected
    },
    CardShiftSelect: (state, action) => {
      const lastSelection = state.Global.lastSelection;
      const lastSelectionIndex = state.CardList.findIndex(c => c.id === lastSelection);
      const currentSelectionIndex = state.CardList.findIndex(c => c.id === action.payload);
      if (lastSelectionIndex + currentSelectionIndex > -1) {
        state.CardList.forEach((c, i) => {
          const ia = [lastSelectionIndex, currentSelectionIndex];
          c.selected = i >= Math.min(...ia) && i <= Math.max(...ia);
        });
      } else {
        state.CardList.forEach(c => c.selected = false);
      }
    },
    ConfigEdit: (state, action) => {
      fillByObjectValue(state.Config, action.payload);
      storeCardImage(state);
      saveConfig({state});
    },
    CardAddByFaces: (state, action) => {
      state.CardList = state.CardList.concat(action.payload.map(p => ({
        id: crypto.randomUUID(),
        face: p,
        back: null,
        repeat: 1,
      })));
      storeCardImage(state);
    },
    DragHoverCancel: (state) => {
      const dragTargetId = 'dragTarget';
      const targetIndex = state.CardList.findIndex(c => c.id === dragTargetId);
      if(targetIndex !== -1) {
        state.CardList.splice(targetIndex, 1);
      }
    },
    DragHoverMove: (state, action) => {
      const { to } = action.payload;
      const id = 'dragTarget';
      const from = state.CardList.findIndex(c => c.id === id);
      if(from !== -1) {
        state.CardList.splice(from, 1);
      }
      state.CardList.splice(to, 0, { id });
    },
    SelectedCardsMove: (state, action) => {
      const dragTargetId = 'dragTarget';
      const selection = state.CardList.filter(c => c.selected);
      const orderedSelection = selection.sort((a, b) => {
        return state.CardList.findIndex(c => c.id === b.id) - state.CardList.findIndex(c => c.id === a.id);
      })
      orderedSelection.forEach(c => {
        state.CardList.splice(state.CardList.findIndex(cc => cc.id === c.id), 1)
      });
      const to = state.CardList.findIndex(c => c.id === dragTargetId);
      orderedSelection.forEach((s, index) => {
        state.CardList.splice(to, 0, s);
      });
      const targetIndex = state.CardList.findIndex(c => c.id === dragTargetId);
      if(targetIndex !== -1) {
        state.CardList.splice(targetIndex, 1);
      }
    },
    SelectedCardFillBackWithEachBack: (state, action) => {
      const backImageList = action.payload;
      const selection = state.CardList.filter(c => c.selected);
      selection.forEach((c, index) => (c.back = backImageList?.[index]));
      storeCardImage(state);
    },
    CardEditById: (state, action) => {
      const card = state.CardList.find(c => c.id === action.payload.id);
      if (card) {
        fillByObjectValue(card, action.payload);
        storeCardImage(state);
      }
    },
    SelectedCardsSwap: (state) => {
      const selection = state.CardList.filter(c => c.selected);
      selection.forEach(c => ([c.face, c.back] = [c.back, c.face]));
    },
    SelectedCardsRemove: (state) => {
      const selection = state.CardList.filter(c => c.selected);
      selection.sort((a, b) => {
        return state.CardList.indexOf(c => c.id === b.id) - state.CardList.indexOf(c => c.id === a.id);
      }).forEach(c => state.CardList.splice(state.CardList.indexOf(cc => cc.id === c.id), 1));
      storeCardImage(state);
    },
    SelectedCardsEdit: (state, action) => {
      const selection = state.CardList.filter(c => c.selected);
      selection.forEach(c => {
        fillByObjectValue(c, action.payload);
      });
      storeCardImage(state);
    },
    CardRemoveByIds: (state, action) => {
      state.CardList = state.CardList.filter(c => !action.payload.includes(c.id));
      storeCardImage(state);
    },
    UpdateStorage: (state, action) => {
      const ImageCache = action.payload;
      Object.keys(ImageCache).forEach(key => {
        window.ImageStorage[key] = ImageCache[key];
      })
    }
  },
});
export const Actions = pnpSlice.actions;
export const store = configureStore({
  reducer: {
    pnp: pnpSlice.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(logger),
  devTools: true,
});

export const StoreProvider = ({ children }) => {
  return (
    <Provider store={store}>
      {children}
    </Provider>
  );
};

const config = await loadConfig();
store.dispatch(Actions.GlobalEdit({...config.Global}));
store.dispatch(Actions.ConfigEdit({...config.Config}));
onOpenProjectFile(store.dispatch, Actions, () => reloadImageFromFile())
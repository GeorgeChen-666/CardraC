import React from 'react';
import { createSlice, configureStore } from '@reduxjs/toolkit';
import _ from 'lodash';
import logger from 'redux-logger';
import { Provider } from 'react-redux';
import {
  fillByObjectValue,
  loadConfig,
  saveConfig,
  onOpenProjectFile,
  reloadLocalImage,
} from './functions';

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
window.OverviewStorage = {};
window.ImageStorage = {};
export const reloadImageFromFile = async (state) => {
  const {CardList, Config} = state;
  const loadImage = async(image) => {
    if(!image || !image?.path) return false;
    try {
      const imagePathKey = image?.path.replaceAll('\\','');
      const imageParam = {...image};
      if(!window.ImageStorage[imagePathKey] || !window.OverviewStorage[imagePathKey]) {
        delete imageParam.mtime; //force reload
      }
      const imageData = await reloadLocalImage(imageParam);
      if(imageData) {
        window.ImageStorage[imagePathKey] = imageData.data;
        window.OverviewStorage[imagePathKey] = imageData.overviewData;
        return true
      }
    } catch (e) {
      console.log(e);
    }

  }
  for(let card of CardList) {
    const {face,back, id} = card;
    const [isFaceChanged, isBackChanged] = [await loadImage(face), await loadImage(back)]
    if(isFaceChanged || isBackChanged) {
      store.dispatch(Actions.CardEditById({ id, _newId: crypto.randomUUID() }))
    }
  }
  if(Config.globalBackground?.path) {
    await loadImage(Config.globalBackground)
  }
}
//ugly code
const storeCardImage = (state) => {
  const {CardList, Config} = state;
  const { ImageStorage, OverviewStorage } = window;
  const usedImagePath = new Set();
  CardList.forEach(card => {
    const {face,back} = card;
    const facePathKey  = face?.path.replaceAll('\\','');
    const backPathKey  = back?.path.replaceAll('\\','');
    usedImagePath.add(facePathKey);
    usedImagePath.add(backPathKey);
  });

  if(Config.globalBackground?.path) {
    const globalBackPathKey = Config.globalBackground?.path?.replaceAll('\\','');
    usedImagePath.add(globalBackPathKey);
  }

  Object.keys(ImageStorage).filter(key=> !usedImagePath.has(key)).forEach(key => delete ImageStorage[key]);
  Object.keys(OverviewStorage).filter(key=> !usedImagePath.has(key)).forEach(key => delete OverviewStorage[key]);
}

export const pnpSlice = createSlice({
  name: 'pnp',
  initialState,
  reducers: {
    StateFill: (state, action) => {
      const { ImageStorage, OverviewStorage } = action.payload;
      ImageStorage && (window.ImageStorage = {}) && fillByObjectValue(window.ImageStorage, ImageStorage);
      OverviewStorage && (window.OverviewStorage = {}) && fillByObjectValue(window.OverviewStorage, OverviewStorage);
      delete action.payload.ImageStorage;
      delete action.payload.OverviewStorage;
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
      const orderedSelection = selection.toSorted((a, b) => {
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
      const { _newId } = action.payload;
      if(_newId) {
        action.payload.id = _newId;
      }
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
      selection.toSorted((a, b) => {
        return state.CardList.indexOf(c => c.id === b.id) - state.CardList.indexOf(c => c.id === a.id);
      }).forEach(c => state.CardList.splice(state.CardList.indexOf(cc => cc.id === c.id), 1));
      storeCardImage(state);
    },
    SelectedCardsDuplicate: (state) => {
      const selection = state.CardList.filter(c => c.selected);
      const orderedSelection = selection.toSorted((a, b) => {
        return state.CardList.findIndex(c => c.id === b.id) - state.CardList.findIndex(c => c.id === a.id);
      });
      const to = state.CardList.findIndex(c => c.id === orderedSelection[0].id);
      const newSelection = orderedSelection.map(c=>({...c, id: crypto.randomUUID(), selected: false}));
      newSelection.forEach((s, index) => {
        state.CardList.splice(to, 0, s);
      });
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
onOpenProjectFile(store.dispatch, Actions, reloadImageFromFile)
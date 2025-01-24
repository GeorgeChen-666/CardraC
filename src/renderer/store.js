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
} from './functions';
import { i18nInstance } from './i18n';
import { flipWay, layoutSides } from '../public/constants';
import { drawPdfBrochure } from '../main/ele_action/handlers/pdf/Brochure';

export const initialState = Object.freeze({
  Global: {
    availableLangs: [],
    currentLang: 'zh',
    projectPath: '',
    isLoading: false,
    loadingText: '',
    isInProgress: false,
    progress: 0,
    lastSelection: null,
    isBackEditing: false,
    selections: [],
  },
  Config: {
    pageSize: 'A4:210,297',
    pageWidth: 210,
    pageHeight: 297,
    scale: 100,
    offsetX: 0,
    offsetY: 0,
    landscape: true,
    sides: layoutSides.doubleSides,
    autoConfigFlip: true,
    flip: flipWay.longEdgeBinding,
    cardWidth: 63,
    cardHeight: 88,
    marginX: 3,
    marginY: 3,
    bleedX: 1,
    bleedY: 1,
    columns: 4,
    rows: 2,
    autoColumnsRows: true,
    fCutLine: '1',
    bCutLine: '1',
    lineWeight: 0.5,
    cutlineColor: '#000000',
    globalBackground: { path:'_emptyImg' },
    marginFilling: false,
    avoidDislocation: false,
    brochureRepeatPerPage: false,
  },
  CardList: [],
});
window.OverviewStorage = {};

export const pnpSlice = createSlice({
  name: 'pnp',
  initialState,
  reducers: {
    StateFill: (state, action) => {
      const { OverviewStorage } = action.payload;
      OverviewStorage && (window.OverviewStorage = {}) && fillByObjectValue(window.OverviewStorage, OverviewStorage);
      delete action.payload.OverviewStorage;
      action.payload.CardList.forEach(card=>{
        card && !card.id && (card.id = crypto.randomUUID());
      })
      fillByObjectValue(state, action.payload);
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
      saveConfig({state});
    },
    CardAddByFaces: (state, action) => {
      state.CardList = state.CardList.concat(action.payload.map(p => ({
        id: crypto.randomUUID(),
        face: p,
        back: { path:'_emptyImg' },
        repeat: 1,
      })));
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
    },
    CardEditById: (state, action) => {
      const card = state.CardList.find(c => c.id === action.payload.id);
      const { _newId } = action.payload;
      if(_newId) {
        action.payload.id = _newId;
      }
      if (card) {
        fillByObjectValue(card, action.payload);
      }
    },
    SelectedCardsSwap: (state) => {
      const selection = state.CardList.filter(c => c.selected);
      selection.forEach(c => ([c.face, c.back] = [c.back, c.face]));
    },
    SelectedCardsRemove: (state) => {
      const selection = state.CardList.filter(c => c.selected);
      selection.toSorted((a, b) => {
        return state.CardList.findIndex(c => c.id === b.id) - state.CardList.findIndex(c => c.id === a.id);
      }).forEach(c => state.CardList.splice(state.CardList.findIndex(cc => cc.id === c.id), 1));
    },
    SelectedCardsDuplicate: (state) => {
      const selection = state.CardList.filter(c => c.selected);
      const orderedSelection = selection.toSorted((a, b) => {
        return state.CardList.findIndex(c => c.id === b.id) - state.CardList.findIndex(c => c.id === a.id);
      });
      const to = state.CardList.findIndex(c => c.id === orderedSelection[0].id) + 1;
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
    },
    CardRemoveByIds: (state, action) => {
      state.CardList = state.CardList.filter(c => !action.payload.includes(c.id));
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
export const loading = async (cb,text= i18nInstance.t('util.operating')) => {
  try {
    store.dispatch(Actions.GlobalEdit({isLoading: true, loadingText: text}));
    cb && await cb();
  } finally {
    store.dispatch(Actions.GlobalEdit({isLoading: false, loadingText: ''}));
  }
}
const config = await loadConfig();
store.dispatch(Actions.GlobalEdit({...config.Global}));
store.dispatch(Actions.ConfigEdit({...config.Config}));
onOpenProjectFile(store.dispatch, Actions)
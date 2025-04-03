import React from 'react';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import _ from 'lodash';
import logger from 'redux-logger';
import { Provider } from 'react-redux';
import { fillByObjectValue, loadConfig, onOpenProjectFile, saveConfig, triggerNotification } from './functions';
import { i18nInstance } from './i18n';
import { flipWay, layoutSides } from '../public/constants';
import * as yup from 'yup';

const stateSchema = yup.object({
  Global: yup.object({
    currentLang: yup.string().required(),
    isShowOverView: yup.boolean().required(),
    availableLangs: yup.array().of(yup.string()).notRequired(),
    isLoading: yup.boolean().notRequired(),
    loadingText: yup.string().notRequired(),
    isInProgress: yup.boolean().notRequired(),
    progress: yup.number().notRequired(),
    lastSelection: yup.object().notRequired(),
    isBackEditing: yup.boolean().notRequired(),
    selections: yup.array().of(yup.object()).notRequired(),
  }).required(),
  Config: yup.object({
    pageSize: yup.string().required(), //'A4:210,297',
    pageWidth: yup.number().min(1).required(), //210,
    pageHeight: yup.number().min(1).required(), //297,
    scale: yup.number().min(1).required(), //100,
    offsetX: yup.number().required(), //0,
    offsetY: yup.number().required(), //0,
    landscape: yup.boolean().required(), //true,
    sides: yup.string().oneOf([
      layoutSides.oneSide,
      layoutSides.doubleSides,
      layoutSides.foldInHalf,
      layoutSides.brochure]).required(), //layoutSides.doubleSides,
    autoConfigFlip: yup.boolean().required(), //true,
    flip: yup.string().oneOf([
      flipWay.longEdgeBinding,
      flipWay.shortEdgeBinding]).required(), //flipWay.longEdgeBinding,
    cardWidth: yup.number().min(1).required(), //63,
    cardHeight: yup.number().min(1).required(), //88,
    compressLevel: yup.number().min(0).max(4).required(), //2,
    marginX: yup.number().min(0).required(), //3,
    marginY: yup.number().min(0).required(), //3,
    foldInHalfMargin: yup.number().min(0).required(), //0,
    bleedX: yup.number().min(0).required(), //1,
    bleedY: yup.number().min(0).required(), //1,
    columns: yup.number().min(1).required(), //4,
    rows: yup.number().min(1).required(), //2,
    autoColumnsRows: yup.boolean().required(), //true,
    fCutLine: yup.string().oneOf(['1', '2', '3']).required(), //'1',
    bCutLine: yup.string().oneOf(['1', '2', '3']).required(), //'1',
    lineWeight: yup.number().min(0).required(), //0.5,
    cutlineColor: yup.string().required(), //'#000000',
    globalBackground: yup.object().notRequired(), //null,
    marginFilling: yup.boolean().notRequired(), //false,
    avoidDislocation: yup.boolean().notRequired(), //false,
    brochureRepeatPerPage: yup.boolean().notRequired(), //false,
  }).required(),
  CardList: yup.array().of(yup.object()).notRequired()
});

export const initialState = Object.freeze({
  Global: {
    availableLangs: [],
    currentLang: 'zh',
    isLoading: false,
    loadingText: '',
    isInProgress: false,
    progress: 0,
    lastSelection: null,
    isBackEditing: false,
    isShowOverView: true,
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
    compressLevel: 2,
    marginX: 3,
    marginY: 3,
    foldInHalfMargin: 0,
    bleedX: 1,
    bleedY: 1,
    columns: 4,
    rows: 2,
    autoColumnsRows: true,
    fCutLine: '1',
    bCutLine: '1',
    lineWeight: 0.5,
    cutlineColor: '#000000',
    globalBackground: null,
    marginFilling: false,
    avoidDislocation: false,
    brochureRepeatPerPage: false,
  },
  CardList: [],
});
window.OverviewStorage = {};
window.ImageStorage = {};

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
        back: null,
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
    store.dispatch(Actions.GlobalEdit({isLoading: false, isInProgress:false, loadingText: ''}));
  }
}

let config = await loadConfig();
i18nInstance.init({
  supportedLngs: config.Global.availableLangs.length === 0 ? [config.Global.currentLang] : config.Global.availableLangs,
  lng: config.Global.currentLang,
  resources:
    config.Global.availableLangs.map(lang => ({
      [lang]: { translation: config.Global.locales[lang] }
    })).reduce((l1, l2) => Object.assign(l1, l2), {}),
});
try {
  await stateSchema.validate(config,{ abortEarly: false });
} catch (e) {
  e.inner.forEach(err => {
    _.set(config, err.path, _.get(initialState, err.path));
  })
  triggerNotification({
    description: i18nInstance.t('util.invalidConfigOptions'),
    status: 'warning',
    duration: 9000,
    isClosable: true,
  });
} finally {
  store.dispatch(Actions.GlobalEdit({...config.Global}));
  store.dispatch(Actions.ConfigEdit({...config.Config}));
}

onOpenProjectFile(store.dispatch, Actions)
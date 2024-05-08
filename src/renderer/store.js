import React from 'react';
import { createSlice, configureStore } from '@reduxjs/toolkit';
import _ from 'lodash';
import logger from 'redux-logger';
import { Provider } from 'react-redux';

export const initialState = Object.freeze({
  Global: {
    projectPath: '',
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
    fCutlineThinkness: 3,
    fCutlineColor: '#000000',
    bCutLine: '1',
    bCutlineThinkness: 3,
    bCutlineColor: '#000000',
    globalBackground: null,
  },
  CardList: [],
});

export const pnpSlice = createSlice({
  name: 'pnp',
  initialState,
  reducers: {
    StateFill: (state, action) => {
      Object.keys(action.payload).forEach(key => {
        state[key] = action.payload[key];
      });
    },
    GlobalEdit: (state, action) => {
      Object.keys(action.payload).forEach(key => {
        state.Global[key] = action.payload[key];
      });
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
    CardShiftSelect: (state, action) => {
      const lastSelection = state.Global.lastSelection;
      const lastSelectionIndex = state.CardList.findIndex(c => c.id === lastSelection);
      const currentSelectionIndex = state.CardList.findIndex(c => c.id === action.payload);
      if (lastSelectionIndex + currentSelectionIndex > -1) {
        state.CardList.forEach((c, i) => {
          const ia = [lastSelectionIndex, currentSelectionIndex];
          if (i >= Math.min(...ia) && i <= Math.max(...ia)) {
            c.selected = true;
          } else {
            c.selected = false;
          }
        });
      } else {
        state.CardList.forEach(c => c.selected = false);
      }
    },
    ConfigEdit: (state, action) => {
      Object.keys(action.payload).forEach(key => {
        state.Config[key] = action.payload[key];
      });
    },
    CardAddByFaces: (state, action) => {
      state.CardList = state.CardList.concat(action.payload.map(p => ({
        id: crypto.randomUUID(),
        face: p,
        back: null,
        repeat: 1,
      })));
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
    },
    CardEditById: (state, action) => {
      const card = state.CardList.find(c => c.id === action.payload.id);
      if (card) {
        Object.keys(action.payload).forEach(key => {
          card[key] = action.payload[key];
        });
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
    },
    SelectedCardsEdit: (state, action) => {
      const selection = state.CardList.filter(c => c.selected);
      selection.forEach(c => {
        Object.keys(action.payload).forEach(key => {
          c[key] = action.payload[key];
        });
      });
    },
    CardRemoveByIds: (state, action) => {
      state.CardList = state.CardList.filter(c => !action.payload.includes(c.id));
    },
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
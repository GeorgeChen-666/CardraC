import React, { useCallback, useReducer } from 'react';
import { createSlice, configureStore  } from '@reduxjs/toolkit';
import logger from 'redux-logger'
import { Provider } from 'react-redux'

const initialState = Object.freeze({
  Global: {
    selection: [],
    lastSelection: null,
    isBackEditing: false
  },
  Config: {
    pageSize:'A4:210,297',
    pageWidth: 210,
    pageHeight: 297,
    landscape: true,
    sides: 'double sides',
    autoConfigFlip : true,
    flip: 'long-edge binding',
    cardWidth:63,
    cardHeight: 88,
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
    globalBackground: null
  },
  CardList: [],
});
// const Actions = Object.freeze({
//   EditGlobal: 'EditGlobal',
//   EditConfig: 'EditConfig',
//   AddCardByFace: 'AddCardByFace',
//   EditCardById: 'EditCardById',
//   RemoveCardById: 'RemoveCardById',
//   FillCardList: 'FillCardList',
// });
// const reducer = (state, action) => {
//   const { type, payload } = action;
//   switch (type) {
//     case Actions.EditGlobal:
//       return {
//         ...state,
//         Global: {...state.Global, ...payload}
//       };
//     case Actions.EditConfig:
//       return {
//         ...state,
//         Config: {...state.Config, ...payload}
//       };
//     case Actions.AddCardByFace:
//       return {
//         ...state,
//         CardList: [
//           ...state.CardList,
//           ...payload.map(p => ({
//             id: crypto.randomUUID(),
//             face: p,
//             back: '',
//             repeat: 1
//           })),
//         ],
//       };
//     case Actions.EditCardById:
//       return {
//         ...state,
//         CardList: [
//           ...state.CardList.map(c => c.id === payload.id ? { ...c, ...payload } : c),
//         ],
//       };
//     case Actions.RemoveCardById:
//       return {
//         ...state,
//         CardList: [
//           ...state.CardList.filter(c => c.id !== payload),
//         ],
//       };
//     case Actions.FillCardList:
//       return {
//         ...state,
//         CardList: [ ...payload ],
//       };
//     case 'increment':
//       return state + 1;
//     case 'decrement':
//       return state - 1;
//     case 'reset':
//       return 0;
//     default:
//       throw new Error('Unexpected action');
//   }
// };
export const StoreContext = React.createContext();

export const pnpSlice = createSlice({
  name: 'pnp',
  initialState,
  reducers: {
    EditGlobal: (state, action) => {
      Object.keys(action.payload).forEach(key=> {
        state.Global[key] = action.payload[key];
      })
    },
    EditConfig: (state, action) => {
      Object.keys(action.payload).forEach(key=> {
        state.Config[key] = action.payload[key];
      })
    },
    AddCardByFaces: (state, action) => {
      state.CardList = state.CardList.concat(action.payload.map(p => ({
        id: crypto.randomUUID(),
        face: p,
        back: null,
        repeat: 1
      })));
    },
    FillCardList: (state, action) => {
      state.CardList = action.payload;
    }
  },
})
export const Actions = pnpSlice.actions;
const store = configureStore({
  reducer: {
    pnp: pnpSlice.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(logger),
  devTools: true,
})

export const StoreProvider = ({ children }) => {
  return (
    <Provider store={store}>
      {children}
    </Provider>
  );
};
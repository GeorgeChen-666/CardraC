import * as yup from 'yup';
import { eleActions, flipWay, layoutSides } from '../../public/constants';
import { create } from 'zustand';
import {
  loadConfig,
  regUpdateProgress,
  callMain,
  immutableMerge,
  fillByObjectValue,
  onOpenProjectFile,
} from '../functions';
import _ from 'lodash';
import { i18nInstance, initI18n } from '../i18n';
import { actionLogger } from './logger';
import { notificationFailed, notificationSuccess, triggerNotification } from '../Parts/Notification';
import { shallow } from 'zustand/shallow';

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
    printOffsetX: yup.number().required(), //0,
    printOffsetY: yup.number().required(), //0,
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
    foldLineType: yup.string().oneOf(['0', '1']).required(),
    globalBackground: yup.object().notRequired(), //null,
    marginFilling: yup.boolean().notRequired(), //false,
    avoidDislocation: yup.boolean().notRequired(), //false,
    brochureRepeatPerPage: yup.boolean().notRequired(), //false,
  }).required(),
  CardList: yup.array().of(yup.object()).notRequired(),
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
    printOffsetX: 0,
    printOffsetY: 0,
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
    foldLineType: '0',
    globalBackground: null,
    marginFilling: false,
    avoidDislocation: false,
    brochureRepeatPerPage: false,
  },
  CardList: [],
});
window.OverviewStorage = {};
window.ImageStorage = {};


const middlewares = (args) => actionLogger(args, ({ action, params, prev, next }) => {
  if (typeof window !== 'undefined' && window.console) {
    console.groupCollapsed(`[Zustand Action] ${action}`, ...params);
    console.log('Prev state:', prev);
    console.log('Next state:', next);
    console.groupEnd();
    const newStateData = _.pick(next, ['Config', 'Global']);
    if (['mergeState', 'mergeConfig', 'mergeGlobal'].includes(action)) {
      callMain(eleActions.saveConfig, { state: newStateData });
    }
  }
});

const mergeStateFn = (state, newState, path = '') => {
  if (path) {
    const [first, ...rest] = path.split('.');
    if (!first) return immutableMerge(state, newState);
    return {
      ...state,
      [first]: mergeStateFn(state[first], newState, rest.join('.')),
    };
  }
  return immutableMerge(state, newState);
};

export const useGlobalStore = create(middlewares((set, get) => ({
  ...initialState,
  fillState: set,
  mergeState: (newState, path = '') =>
    set((state) => mergeStateFn(state, newState, path)),
  mergeGlobal: (newState) =>
    set((state) => mergeStateFn(state, newState, 'Global')),
  mergeConfig: (newState) =>
    set((state) => mergeStateFn(state, newState, 'Config')),
  loading: async (cb, text = i18nInstance.t('util.operating')) => {
    try {
      get().mergeGlobal({ isLoading: true, loadingText: text });
      cb && await cb();
    } finally {
      setTimeout(() => get().mergeGlobal({ isLoading: false, isInProgress: false }), 1000);
      setTimeout(() => get().mergeGlobal({ loadingText: '' }), 2000);
    }
  },
  progress: (v) => {
    if (v > 0) {
      get().mergeGlobal({ isInProgress: true, progress: v });
    } else {
      get().mergeGlobal({ isInProgress: false });
    }
  },
  openProject: () => {
    get().loading(async () => {
      const projectData = await callMain(eleActions.openProject);
      if (projectData) {
        if (projectData?.OverviewStorage) {
          window.OverviewStorage = projectData.OverviewStorage;
          delete projectData.OverviewStorage;
        }
        delete projectData?.ImageStorage;
        get().mergeState(projectData);
      }
    });
  },
  saveProject: () => {
    get().loading(async () => {
      const param = { globalBackground: get().Config.globalBackground, CardList: get().CardList };
      const rs = await callMain(eleActions.saveProject, param);
      rs && notificationSuccess();
    });
  },
  exportPdf: () => {
    get().loading(async () => {
      const param = { globalBackground: get().Config.globalBackground, CardList: get().CardList };
      const isSuccess = await callMain(eleActions.exportPdf, param);
      isSuccess && notificationSuccess();
    });
  },
  reloadLocalImage: () => {
    get().loading(async () => {
      const param = { globalBackground: get().Config.globalBackground, CardList: get().CardList };
      const stateData = await callMain(eleActions.reloadLocalImage, param);
      if (stateData && !stateData.isAborted) {
        delete window.OverviewStorage;
        delete window.ImageStorage;
        window.OverviewStorage = stateData.OverviewStorage;
        get().mergeState({CardList: stateData.CardList, Config: stateData.Config});
      }
    });
  },
  cardAdd: (images) => {
    set(state => {
      state.CardList = state.CardList.concat(images.map(p => ({
        id: crypto.randomUUID(),
        face: p,
        back: null,
        repeat: 1,
      })));
      return state;
    });
  },
  cardEditById: (newState) =>
    set(state => {
      const { id, ...restNewState } = newState;
      const card = state.CardList.find(c => c.id === id);
      if (card) {
        const newCardList = state.CardList.map(c => {
          if (c.id === id) {
            return { ...c, ...restNewState };
          }
          return c;
        });
        return { ...state, CardList: newCardList };
      }
      return state;
    }),
  cardRemoveByIds: (ids) =>
    set(state => {
      state.CardList = state.CardList.filter(c => !ids.includes(c.id));
      return state;
    }),
  cardSelect: (selectedId) => {
    set(state => {
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
      state.CardList = [...state.CardList];
      return state;
    });
  },
  cardShiftSelect: (selectedId) => {
    set(state => {
      const lastSelection = state.Global.lastSelection;
      const lastSelectionIndex = state.CardList.findIndex(c => c.id === lastSelection);
      const currentSelectionIndex = state.CardList.findIndex(c => c.id === selectedId);
      if (lastSelectionIndex + currentSelectionIndex > -1) {
        state.CardList.forEach((c, i) => {
          const ia = [lastSelectionIndex, currentSelectionIndex];
          c.selected = i >= Math.min(...ia) && i <= Math.max(...ia);
        });
      } else {
        state.CardList.forEach(c => c.selected = false);
      }
      state.CardList = [...state.CardList];
      return state;
    });
  },
  cardCtrlSelect: (selectedId) => {
    set(state => {
      const selectedCard = state.CardList.find(c => c.id === selectedId);
      selectedCard.selected = !selectedCard.selected;
      return state;
    });
  },
  dragHoverMove: (to) => {
    set(state => {
      const id = 'dragTarget';
      const from = state.CardList.findIndex(c => c.id === id);
      if (from !== -1) {
        state.CardList.splice(from, 1);
      }
      state.CardList.splice(to, 0, { id });
      state.CardList = [...state.CardList];
      return state;
    });
  },
  dragHoverCancel: () => {
    set(state => {
      const dragTargetId = 'dragTarget';
      const targetIndex = state.CardList.findIndex(c => c.id === dragTargetId);
      if (targetIndex !== -1) {
        state.CardList.splice(targetIndex, 1);
        state.CardList = [...state.CardList];
      }
      return state;
    });
  },
  dragCardsMove: () => {
    set(state => {
      const dragTargetId = 'dragTarget';
      const selection = state.CardList.filter(c => c.selected);
      const orderedSelection = selection.toSorted((a, b) => {
        return state.CardList.findIndex(c => c.id === b.id) - state.CardList.findIndex(c => c.id === a.id);
      });
      orderedSelection.forEach(c => {
        state.CardList.splice(state.CardList.findIndex(cc => cc.id === c.id), 1);
      });
      const to = state.CardList.findIndex(c => c.id === dragTargetId);
      orderedSelection.forEach((s, index) => {
        state.CardList.splice(to, 0, s);
      });
      const targetIndex = state.CardList.findIndex(c => c.id === dragTargetId);
      if (targetIndex !== -1) {
        state.CardList.splice(targetIndex, 1);
      }
      state.CardList = [...state.CardList];
      return state;
    });
  },
  selectedCardsRemove: () => {
    set(state => {
      const selection = state.CardList.filter(c => c.selected);
      selection.toSorted((a, b) => {
        return state.CardList.findIndex(c => c.id === b.id) - state.CardList.findIndex(c => c.id === a.id);
      }).forEach(c => state.CardList.splice(state.CardList.findIndex(cc => cc.id === c.id), 1));
      state.CardList = [...state.CardList];
      return state;
    });
  },
  selectedCardsDuplicate: () => {
    set(state => {
      const selection = state.CardList.filter(c => c.selected);
      const orderedSelection = selection.toSorted((a, b) => {
        return state.CardList.findIndex(c => c.id === b.id) - state.CardList.findIndex(c => c.id === a.id);
      });
      const to = state.CardList.findIndex(c => c.id === orderedSelection[0].id) + 1;
      const newSelection = orderedSelection.map(c => ({ ...c, id: crypto.randomUUID(), selected: false }));
      newSelection.forEach((s, index) => {
        state.CardList.splice(to, 0, s);
      });
      state.CardList = [...state.CardList];
      return state;
    });
  },
  selectedCardsEdit: (newState) => {
    set(state => {
      const selection = state.CardList.filter(c => c.selected);
      selection.forEach(c => {
        fillByObjectValue(c, newState);
      });
      state.CardList = state.CardList.map(c => selection.includes(c) ? { ...c } : c);
      return state;
    });
  },
  selectedCardsFillBackWithEach: (backImageList) => {
    set(state => {
      const selection = state.CardList.filter(c => c.selected);
      selection.forEach((c, index) => {
        c.back = backImageList?.[index];
      });
      state.CardList = state.CardList.map(c => selection.includes(c) ? { ...c } : c);
      return state;
    });
  },
  selectedCardsSwap: () => {
    set(state => {
      const selection = state.CardList.filter(c => c.selected);
      selection.forEach(c => ([c.face, c.back] = [c.back, c.face]));
      state.CardList = state.CardList.map(c => selection.includes(c) ? { ...c } : c);
      return state;
    });
  },
  selectedCardsConfig: (config) => {
    set(state => {
      const selection = state.CardList.filter(c => c.selected);
      selection.forEach(c => {
        if(Object.values(config?.bleed || {}).filter(e => !!e).length > 0) {
          c.config = config;
        } else {
          delete c.config;
        }
      });
      state.CardList = state.CardList.map(c => selection.includes(c) ? { ...c } : c);
      return state;
    });
  }
})));

function createSelectors(storeHook) {
  const selectorCache = new Map();

  const createProxy = (path = []) => new Proxy(() => {
  }, {
    get: (target, key) => {
      const newPath = [...path, key];
      return createProxy(newPath);
    },
    apply: (target, thisArg, args) => {
      const pathKey = path.join('.');

      // 缓存 selector 函数
      if (!selectorCache.has(pathKey)) {
        const selector = (state) => {
          return path.reduce((obj, key) => {
            return (obj !== undefined && obj !== null) ? obj[key] : undefined;
          }, state);
        };
        selectorCache.set(pathKey, selector);
      }

      return storeHook(selectorCache.get(pathKey), shallow);
    },
  });
  return createProxy();
}

useGlobalStore.selectors = createSelectors(useGlobalStore);
// useGlobalStore.setState({
//   selectors: createSelectors(useGlobalStore)
// })

const state = useGlobalStore.getState();
onOpenProjectFile((data) => {
  const { OverviewStorage, ...newState } = data;
  window.OverviewStorage = OverviewStorage;
  state.fillState(newState);
});
let config = await loadConfig();
await initI18n(config.Global);

try {
  await stateSchema.validate(config, { abortEarly: false });
} catch (e) {
  e.inner.forEach(err => {
    _.set(config, err.path, _.get(initialState, err.path));
  });
  console.log('Error!', e.inner)
  triggerNotification({
    msgKey: 'util.invalidConfigOptions',
    variant: 'warning',
  });
} finally {
  const newStateData = _.pick(config, ['Global', 'Config']);
  state.fillState(newStateData);
  callMain(eleActions.saveConfig, { state: newStateData });
  regUpdateProgress(state.progress);
}
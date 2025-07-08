import * as yup from 'yup';
import { eleActions, flipWay, layoutSides } from '../../public/constants';
import { create } from 'zustand';
import { loadConfig, regUpdateProgress, callMain, immutableMerge, openMultiImage, saveConfig } from '../functions';
import _ from 'lodash';
import { i18nInstance, initI18n } from '../i18n';
import { actionLogger } from './logger';
import { triggerNotification } from '../Parts/Notification';
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


const middlewares = (args) => actionLogger(args, ({ action, params, prev, next }) => {
  if (typeof window !== 'undefined' && window.console) {
    console.groupCollapsed(`[Zustand Action] ${action}`, ...params);
    console.log('Prev state:', prev);
    console.log('Next state:', next);
    console.groupEnd();
  }
});

const mergeStateFn = (state, newState, path = '') => {
  if (path) {
    const [first, ...rest] = path.split('.');
    if (!first) return immutableMerge(state, newState);
    return {
      ...state,
      [first]: mergeStateFn(state[first], newState, rest.join('.'))
    };
  }
  return immutableMerge(state, newState);
};

export const useStore = create(middlewares((set, get) => ({
  ...initialState,
  fillState: set,
  mergeState: (newState, path = '') => {
    const newStateData = mergeStateFn(get(), newState, path);
    set(() => newStateData)
    // callMain(eleActions.saveConfig, {state: newStateData});
  },
  mergeGlobal: (newState) => {
    const newStateData = mergeStateFn(get(), newState, 'Global');
    set(() => newStateData)
    // callMain(eleActions.saveConfig, {state: newStateData});
  },
  mergeConfig: (newState) => {
    const newStateData = mergeStateFn(get(), newState, 'Config');
    set(() => newStateData)
    // callMain(eleActions.saveConfig, {state: newStateData});
  },
  loading: async (cb,text = i18nInstance.t('util.operating')) => {
    try {
      get().mergeGlobal({ isLoading: true, loadingText: text });
      cb && await cb();
    } finally {
      get().mergeGlobal({ isLoading: false, isInProgress:false, loadingText: '' });
    }
  },
  progress: (v) => {
    if(v > 0) {
      get().mergeGlobal({ isInProgress:true, progress: v });
    } else {
      get().mergeGlobal({ isInProgress:false });
    }
  },
  openProject:() => {
    get().loading(async () => {
      const projectData = await callMain(eleActions.openProject);
      if(projectData) {
        if(projectData?.OverviewStorage) {
          window.OverviewStorage = projectData.OverviewStorage;
          delete projectData.OverviewStorage;
        }
        delete projectData?.ImageStorage;
        get().mergeState(projectData);
      }
    })
  },
  openImage: (cb) => {
    get().loading(async () => {
      // const imageData = await openMultiImage('CardAddByFaces');
      // cb && cb(imageData);
    })
  },
  addCard: (images) => {
    set(state => {
      state.CardList = state.CardList.concat(images.map(p => ({
        id: crypto.randomUUID(),
        face: p,
        back: null,
        repeat: 1,
      })));
      return state;
    })
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
    })
})));

function createSelectors(storeHook) {
  const createProxy = (path = []) => new Proxy(() => {}, {
    get: (target, key) => {
      const newPath = [...path, key];
      return createProxy(newPath);
    },
    apply: (target, thisArg, args) => {
      return storeHook(state => {
        return path.reduce((obj, key) => {
          return (obj !== undefined && obj !== null) ? obj[key] : undefined;
        }, state);
      }, shallow);
    }
  });
  return createProxy();
}
useStore.setState({
  selectors: createSelectors(useStore)
})

// export const useStore = Object.assign(useStoreBase, {
//   selectors: createSelectors(useStoreBase)
// });

const state = useStore.getState();

let config = await loadConfig();
await initI18n(config.Global);

try {
  await stateSchema.validate(config,{ abortEarly: false });
} catch (e) {
  e.inner.forEach(err => {
    _.set(config, err.path, _.get(initialState, err.path));
  })
  triggerNotification({
    msgKey: 'util.invalidConfigOptions',
    variant: 'warning',
  });
} finally {
  const newStateData = _.pick(config, ['Global','Config']);
  state.fillState(newStateData);
  callMain(eleActions.saveConfig, {state: newStateData});
  regUpdateProgress(state.progress);
}
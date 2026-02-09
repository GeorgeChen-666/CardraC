import * as yup from 'yup';
import { eleActions, flipWay, initialState, layoutSides } from '../../shared/constants';
import { create } from 'zustand';
import {
  loadConfig,
  regUpdateProgress,
  callMain,
  immutableMerge,
  fillByObjectValue,
  onOpenProjectFile, isDev,
} from '../functions';
import _ from 'lodash';
import { i18nInstance, initI18n } from '../i18n';
import { actionLogger } from './logger';
import { notificationFailed, notificationSuccess, triggerNotification } from '../parts/Notification';
import { shallow } from 'zustand/shallow';
import { ipcRenderer } from 'electron';
import LZString from 'lz-string';
import { subscribeWithSelector } from 'zustand/middleware';
import { middlewares } from './middlewares';


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
    locales: yup.object().notRequired()
  }).notRequired(),
  Config: yup.object({
    pageSize: yup.string().required(),
    pageWidth: yup.number().min(1).required(),
    pageHeight: yup.number().min(1).required(),
    offsetX: yup.number().required(),
    offsetY: yup.number().required(),
    landscape: yup.boolean().required(),
    sides: yup.string().oneOf([
      layoutSides.oneSide,
      layoutSides.doubleSides,
      layoutSides.foldInHalf,
      layoutSides.brochure]).required(),
    autoConfigFlip: yup.boolean().required(),
    flip: yup.string().oneOf([
      flipWay.longEdgeBinding,
      flipWay.shortEdgeBinding]).required(),
    cardWidth: yup.number().min(1).required(),
    cardHeight: yup.number().min(1).required(),
    compressLevel: yup.number().min(0).max(4).required(),
    marginX: yup.number().min(0).required(),
    marginY: yup.number().min(0).required(),
    foldInHalfMargin: yup.number().min(0).required(),
    bleedX: yup.number().min(0).required(),
    bleedY: yup.number().min(0).required(),
    columns: yup.number().min(1).required(),
    rows: yup.number().min(1).required(),
    autoColumnsRows: yup.boolean().required(),
    fCutLine: yup.string().oneOf(['1', '2', '3']).required(),
    bCutLine: yup.string().oneOf(['1', '2', '3']).required(),
    lineWeight: yup.number().min(0).required(),
    cutlineColor: yup.string().required(),
    foldLineType: yup.string().oneOf(['0', '1']).required(),
    globalBackground: yup.object().notRequired(),
    marginFilling: yup.boolean().notRequired(),
    avoidDislocation: yup.boolean().notRequired(),
    brochureRepeatPerPage: yup.boolean().notRequired(),
    pageNumber: yup.boolean().notRequired(),
  }).required().noUnknown(),
  CardList: yup.array().of(yup.object()).notRequired(),
}).noUnknown();

//提取验证逻辑为可复用函数
const validateAndFixConfig = async (config) => {
  try {
    await stateSchema.validate(config, { abortEarly: false, strict: true });
    return { isValid: true, config };
  } catch (e) {
    if (e.inner && e.inner.length > 0) {
      e.inner.forEach(err => {
        if (err.type === 'noUnknown' && err.params?.unknown) {
          const parentPath = err.path;
          const parentObj = _.get(config, parentPath);

          if (parentObj && typeof parentObj === 'object') {
            const unknownKeys = err.params.unknown
              .split(',')
              .map(key => key.trim())
              .filter(key => key);

            unknownKeys.forEach(key => {
              const fullPath = parentPath ? `${parentPath}.${key}` : key;
              console.warn(`Removing unknown field: ${fullPath}`);
              delete parentObj[key];
            });
          }
        } else {
          console.warn(`Fixing invalid field: ${err.path}`);
          const defaultValue = _.get(initialState, err.path);
          if (defaultValue !== undefined) {
            _.set(config, err.path, defaultValue);
          } else {
            _.unset(config, err.path);
          }
        }
      });

      console.log('Validation errors fixed');
      return { isValid: false, config, errors: e.inner };
    }
  }

  return { isValid: true, config };
};

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
      setTimeout(() => get().mergeGlobal({ isLoading: false, isInProgress: false }), 0);
      setTimeout(() => get().mergeGlobal({ loadingText: '' }), 200);
    }
  },
  progress: (v) => {
    if (v > 0) {
      get().mergeGlobal({ isInProgress: true, progress: v });
    } else {
      get().mergeGlobal({ isInProgress: false });
    }
  },
  newProject: () => {
    get().mergeState({ Config: initialState.Config, CardList: [] });
    get().historyReset();
  },
  openProject: () => {
    get().loading(async () => {
      const projectData = await callMain(eleActions.openProject);
      if (projectData) {
        const { isValid, config: validatedData } = await validateAndFixConfig({
          ...projectData,
          Config: {...initialState.Config, ...projectData.Config}
        });
        get().mergeState(validatedData);
        get().historyReset();
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
  exportFile: (targetFileType) => {
    get().loading(async () => {
      const param = { globalBackground: get().Config.globalBackground, CardList: get().CardList, targetFileType };
      const isSuccess = await callMain(eleActions.exportFile, param);
      isSuccess && notificationSuccess();
    });
  },
  printPages: ({ pageList, printConfig }) => {
    get().loading(async () => {
      const param = { globalBackground: get().Config.globalBackground, CardList: get().CardList, pageList, printConfig };
      const isSuccess = await callMain(eleActions.printPages, param);
      isSuccess && notificationSuccess();
    });
  },
  reloadLocalImage: () => {
    get().loading(async () => {
      const param = { globalBackground: get().Config.globalBackground, CardList: get().CardList };
      const stateData = await callMain(eleActions.reloadLocalImage, param);
      if (stateData && !stateData.isAborted) {
        const imageVersion = Date.now();
        get().mergeState({
          CardList: stateData.CardList,
          Config: stateData.Config,
          Global: {
            ...get().Global,
            imageVersion
          }
        });
        if (!isValid) {
          triggerNotification({
            msgKey: 'util.invalidConfigOptions',
            variant: 'warning',
          });
        }
      }
    });
  },
  getExportPageCount: (targetFileType) => {
    get().loading(async () => {
      const param = { globalBackground: get().Config.globalBackground, CardList: get().CardList, targetFileType };
      const exportPageCount = await callMain(eleActions.getExportPageCount, param);
      get().mergeGlobal({exportPageCount})
    });
  },
  getExportPreview: (pageIndex, isSilence = false) => {
    const callMainGetExportPreview = async () => {
      const param = {
        globalBackground: get().Config.globalBackground,
        CardList: get().CardList,
        pageIndex
      };
      const content = await ipcRenderer.invoke(eleActions.getExportPreview, param);
      return content;
    }
    if(isSilence) {
      return new Promise((resolve, reject) => {
        try {
          callMainGetExportPreview().then(content => {
            resolve(content);
          })
        } catch (error) {
          reject(error);
        }
      })
    }
    return new Promise((resolve, reject) => {
      get().loading(async () => {
        try {
          const content = await callMainGetExportPreview();
          resolve(content);
        } catch (error) {
          reject(error);
        }
      });
    });
  },
  cardAdd: (images) => {
    get().setWithHistory(state => ({
      ...state,
      CardList: state.CardList.concat(images.map(p => ({
        id: crypto.randomUUID(),
        face: p,
        back: null,
        repeat: 1,
      })))
    }));
  },
  cardEditById: (newState) =>
    get().setWithHistory(state => {
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
    get().setWithHistory(state => ({
      ...state,
      CardList: state.CardList.filter(c => !ids.includes(c.id))
    })),
  cardSelect: (selectedId) => {
    set(state => {
      const selection = state.CardList.filter(c => c.selected);

      if (_.some(selection, { id: selectedId }) && selection.length === 1) {
        // 取消选中：只修改之前选中的对象
        return {
          ...state,
          CardList: state.CardList.map(c =>
            c.selected ? { ...c, selected: false } : c  // 只有 selected=true 的才创建新对象
          ),
          Global: { ...state.Global, lastSelection: null }
        };
      } else {
        // 选中：只修改选中状态变化的对象
        return {
          ...state,
          CardList: state.CardList.map(c => {
            if (c.id === selectedId && !c.selected) {
              // 新选中的：创建新对象
              return { ...c, selected: true };
            } else if (c.selected && c.id !== selectedId) {
              // 需要取消选中的：创建新对象
              return { ...c, selected: false };
            }
            // 状态不变的：保持原引用
            return c;
          }),
          Global: { ...state.Global, lastSelection: selectedId }
        };
      }
    });
  },

  cardCtrlSelect: (selectedId) => {
    set(state => ({
      ...state,
      CardList: state.CardList.map(c =>
        c.id === selectedId
          ? { ...c, selected: !c.selected }  // 只修改这一个
          : c  // 其他保持原引用
      )
    }));
  },

  cardShiftSelect: (selectedId) => {
    set(state => {
      const lastSelection = state.Global.lastSelection;
      const lastSelectionIndex = state.CardList.findIndex(c => c.id === lastSelection);
      const currentSelectionIndex = state.CardList.findIndex(c => c.id === selectedId);

      if (lastSelectionIndex + currentSelectionIndex > -1) {
        const minIndex = Math.min(lastSelectionIndex, currentSelectionIndex);
        const maxIndex = Math.max(lastSelectionIndex, currentSelectionIndex);

        return {
          ...state,
          CardList: state.CardList.map((c, i) => {
            const shouldBeSelected = i >= minIndex && i <= maxIndex;
            // 只有状态变化的才创建新对象
            return c.selected !== shouldBeSelected
              ? { ...c, selected: shouldBeSelected }
              : c;
          })
        };
      } else {
        return {
          ...state,
          CardList: state.CardList.map(c =>
            c.selected ? { ...c, selected: false } : c
          )
        };
      }
    });
  },

  dragHoverMove: (to) => {
    set(state => {
      const id = 'dragTarget';
      const newCardList = [...state.CardList];
      const from = newCardList.findIndex(c => c.id === id);

      if (from !== -1) {
        newCardList.splice(from, 1);
      }
      newCardList.splice(to, 0, { id });

      return { ...state, CardList: newCardList };
    });
  },
  dragHoverCancel: () => {
    set(state => {
      const dragTargetId = 'dragTarget';
      const targetIndex = state.CardList.findIndex(c => c.id === dragTargetId);
      if (targetIndex !== -1) {
        const newCardList = [...state.CardList];
        newCardList.splice(targetIndex, 1);
        return { ...state, CardList: newCardList };
      }
      return state;
    });
  },
  dragCardsMove: () => {
    get().setWithHistory(state => {
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
      return {...state};
    });
  },
  selectedCardsRemove: () => {
    get().setWithHistory(state => ({
      ...state,
      CardList: state.CardList.filter(c => !c.selected)
    }));
  },
  selectedCardsDuplicate: () => {
    get().setWithHistory(state => {
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
      return {...state};
    });
  },
  selectedCardsEdit: (newState) => {
    get().setWithHistory(state => {
      const selection = state.CardList.filter(c => c.selected);
      selection.forEach(c => {
        fillByObjectValue(c, newState);
      });
      state.CardList = state.CardList.map(c => selection.includes(c) ? { ...c } : c);
      return {...state};
    });
  },
  selectedCardsFillBackWithEach: (backImageList) => {
    get().setWithHistory(state => {
      const selection = state.CardList.filter(c => c.selected);
      selection.forEach((c, index) => {
        c.back = backImageList?.[index];
      });
      state.CardList = state.CardList.map(c => selection.includes(c) ? { ...c } : c);
      return {...state};
    });
  },
  selectedCardsSwap: () => {
    get().setWithHistory(state => {
      const selection = state.CardList.filter(c => c.selected);
      selection.forEach(c => ([c.face, c.back] = [c.back, c.face]));
      state.CardList = state.CardList.map(c => selection.includes(c) ? { ...c } : c);
      return {...state};
    });
  },
  editCardsConfig: (ids, config) => {
    get().setWithHistory(state => {
      const editedCards = state.CardList.filter(c => ids.includes(c.id));
      editedCards.forEach(c => {
        if(Object.values(config?.bleed || {}).filter(e => !!e).length > 0) {
          c.config = config;
        } else {
          delete c.config;
        }
      });
      state.CardList = state.CardList.map(c => ids.includes(c.id) ? { ...c } : c);
      return {...state};
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
useGlobalStore.subscribe(
  (state) => ({ Config: state.Config, Global: state.Global }),
  (newState, prevState) => {
    if (newState.Config !== prevState.Config || newState.Global !== prevState.Global) {
      callMain(eleActions.saveConfig, { state: newState });
    }
  },
  { equalityFn: shallow }
);
const state = useGlobalStore.getState();
onOpenProjectFile((data) => {
  state.fillState(data);
});

let config = await loadConfig();
await initI18n(config.Global);

//使用提取的验证函数
const { isValid, config: validatedConfig } = await validateAndFixConfig(config);

if (!isValid) {
  triggerNotification({
    msgKey: 'util.invalidConfigOptions',
    variant: 'warning',
  });
}

const newStateData = _.pick(validatedConfig, ['Global', 'Config']);
state.fillState(newStateData);
callMain(eleActions.saveConfig, { state: newStateData });
regUpdateProgress(state.progress);

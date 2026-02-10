// src/renderer/state/middlewares.js
import { isDev } from '../functions';
import { actionLogger } from './logger';
import { subscribeWithSelector } from 'zustand/middleware';
import LZString from 'lz-string';

const historyMiddleware = (config) => (set, get, api) => {
  const wrappedSet = (partial, replace) => {
    const prevCardList = get().CardList;
    const prevHistory = get().History;

    set(partial, replace);

    const nextCardList = get().CardList;
    const nextHistory = get().History;

    //只有在需要记录且不是撤销/重做操作时才记录
    if (prevCardList !== nextCardList &&
      !prevHistory.isUndoRedo &&
      prevHistory.recordNext) {

      let newRecent = [...prevHistory.recent];
      let newCompressed = [...prevHistory.compressed];
      let newRecentIndex = prevHistory.recentIndex;

      //清除当前位置之后的历史
      if (newRecentIndex < newRecent.length - 1) {
        newRecent = newRecent.slice(0, newRecentIndex + 1);
      }

      //添加新状态
      newRecent.push([...nextCardList]);
      newRecentIndex = newRecent.length - 1;

      //压缩旧历史
      while (newRecent.length > 10) {
        const oldest = newRecent.shift();
        newCompressed.push(LZString.compressToUTF16(JSON.stringify(oldest)));
        newRecentIndex--;

        if (newCompressed.length > 40) {
          newCompressed.shift();
        }
      }

      //更新历史状态
      set((state) => ({
        ...state,
        History: {
          recent: newRecent,
          recentIndex: newRecentIndex,
          compressed: newCompressed,
          isUndoRedo: false,
          recordNext: false,
          canUndo: newRecentIndex > 0 || newCompressed.length > 0,
          canRedo: false
        }
      }));
    } else if (prevHistory.recordNext && !prevHistory.isUndoRedo) {
      // 重置 recordNext 标志
      set((state) => ({
        ...state,
        History: {
          ...state.History,
          recordNext: false
        }
      }));
    }
  };

  const store = config(wrappedSet, get, api);

  return {
    ...store,

    //初始化历史状态
    History: {
      recent: [],
      recentIndex: -1,
      compressed: [],
      isUndoRedo: false,
      recordNext: false,
      canUndo: false,
      canRedo: false
    },

    //简化：只设置 recordNext 标志
    setWithHistory: (partial, replace) => {
      set((state) => ({
        ...state,
        History: {
          ...state.History,
          recordNext: true
        }
      }));

      wrappedSet(partial, replace);
    },

    //撤销
    historyUndo: () => {
      const history = get().History;

      if (history.recentIndex > 0) {
        const newIndex = history.recentIndex - 1;

        set((state) => ({
          ...state,
          History: {
            ...state.History,
            isUndoRedo: true
          }
        }));

        set((state) => ({
          ...state,
          CardList: [...history.recent[newIndex]]
        }));

        set((state) => ({
          ...state,
          History: {
            ...state.History,
            recentIndex: newIndex,
            isUndoRedo: false,
            canUndo: newIndex > 0 || history.compressed.length > 0,
            canRedo: true
          }
        }));

      } else if (history.compressed.length > 0) {
        const newCompressed = [...history.compressed];
        const compressedData = newCompressed.pop();
        const data = JSON.parse(LZString.decompressFromUTF16(compressedData));
        const newRecent = [data, ...history.recent];

        set((state) => ({
          ...state,
          History: {
            ...state.History,
            isUndoRedo: true
          }
        }));

        set((state) => ({
          ...state,
          CardList: [...data]
        }));

        set((state) => ({
          ...state,
          History: {
            ...state.History,
            recent: newRecent,
            recentIndex: 0,
            compressed: newCompressed,
            isUndoRedo: false,
            canUndo: newCompressed.length > 0,
            canRedo: true
          }
        }));
      }
    },

    //重做
    historyRedo: () => {
      const history = get().History;

      if (history.recentIndex < history.recent.length - 1) {
        const newIndex = history.recentIndex + 1;

        set((state) => ({
          ...state,
          History: {
            ...state.History,
            isUndoRedo: true
          }
        }));

        set((state) => ({
          ...state,
          CardList: [...history.recent[newIndex]]
        }));

        set((state) => ({
          ...state,
          History: {
            ...state.History,
            recentIndex: newIndex,
            isUndoRedo: false,
            canUndo: true,
            canRedo: newIndex < history.recent.length - 1
          }
        }));
      }
    },

    //重置历史 - 记录初始状态
    historyReset: () => {
      const currentCardList = get().CardList;

      set((state) => ({
        ...state,
        History: {
          recent: currentCardList.length > 0 ? [[...currentCardList]] : [],
          recentIndex: currentCardList.length > 0 ? 0 : -1,
          compressed: [],
          isUndoRedo: false,
          recordNext: false,
          canUndo: false,
          canRedo: false
        }
      }));
    }
  };
};

const loggerMiddleware = (config) => (set, get, api) => {
  if (!isDev) return config(set, get, api);

  return actionLogger(config, ({ action, params, prev, next }) => {
    console.groupCollapsed(`[Zustand Action] ${action}`, ...params);
    console.log('Prev state:', prev);
    console.log('Next state:', next);
    console.groupEnd();
  })(set, get, api);
};

const middlewareList = [
  subscribeWithSelector,
  historyMiddleware,
  isDev ? loggerMiddleware : null,
].filter(Boolean);

export const middlewares = (config) => {
  return middlewareList.reduceRight((acc, middleware) => middleware(acc), config);
};

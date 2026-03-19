// src/renderer/state/middlewares.js
import { isDev } from '../functions';
import { actionLogger } from './logger';
import { subscribeWithSelector } from 'zustand/middleware';
import LZString from 'lz-string';

const historyMiddleware = (config) => (set, get, api) => {
  let isUpdatingHistory = false;  // ✅ 添加标志防止递归

  const wrappedSet = (partial, replace) => {
    // ✅ 如果正在更新历史，直接调用原始 set
    if (isUpdatingHistory) {
      set(partial, replace);
      return;
    }

    const prevCardList = get().CardList;
    const prevHistory = get().History;

    set(partial, replace);

    const nextCardList = get().CardList;
    const nextHistory = get().History;

    if (prevCardList !== nextCardList &&
        !prevHistory.isUndoRedo &&
        prevHistory.recordNext) {

      let newRecent = [...prevHistory.recent];
      let newCompressed = [...prevHistory.compressed];
      let newRecentIndex = prevHistory.recentIndex;

      if (newRecentIndex < newRecent.length - 1) {
        newRecent = newRecent.slice(0, newRecentIndex + 1);
      }

      newRecent.push([...nextCardList]);
      newRecentIndex = newRecent.length - 1;

      while (newRecent.length > 10) {
        const oldest = newRecent.shift();
        newCompressed.push(LZString.compressToUTF16(JSON.stringify(oldest)));
        newRecentIndex--;

        if (newCompressed.length > 40) {
          newCompressed.shift();
        }
      }

      // ✅ 使用标志保护
      isUpdatingHistory = true;
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
      isUpdatingHistory = false;

    } else if (prevHistory.recordNext && !prevHistory.isUndoRedo) {
      isUpdatingHistory = true;
      set((state) => ({
        ...state,
        History: {
          ...state.History,
          recordNext: false
        }
      }));
      isUpdatingHistory = false;
    }
  };

  const store = config(wrappedSet, get, api);

  return {
    ...store,

    History: {
      recent: [],
      recentIndex: -1,
      compressed: [],
      isUndoRedo: false,
      recordNext: false,
      canUndo: false,
      canRedo: false
    },

    setWithHistory: (partial, replace) => {
      isUpdatingHistory = true;
      set((state) => ({
        ...state,
        History: {
          ...state.History,
          recordNext: true
        }
      }));
      isUpdatingHistory = false;

      wrappedSet(partial, replace);
    },

    historyUndo: () => {
      const history = get().History;

      if (history.recentIndex > 0) {
        const newIndex = history.recentIndex - 1;

        // ✅ 批量更新
        isUpdatingHistory = true;
        set((state) => ({
          ...state,
          CardList: [...history.recent[newIndex]],
          History: {
            ...state.History,
            recentIndex: newIndex,
            isUndoRedo: false,
            canUndo: newIndex > 0 || history.compressed.length > 0,
            canRedo: true
          }
        }));
        isUpdatingHistory = false;

      } else if (history.compressed.length > 0) {
        const newCompressed = [...history.compressed];
        const compressedData = newCompressed.pop();
        const data = JSON.parse(LZString.decompressFromUTF16(compressedData));
        const newRecent = [data, ...history.recent];

        isUpdatingHistory = true;
        set((state) => ({
          ...state,
          CardList: [...data],
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
        isUpdatingHistory = false;
      }
    },

    historyRedo: () => {
      const history = get().History;

      if (history.recentIndex < history.recent.length - 1) {
        const newIndex = history.recentIndex + 1;

        isUpdatingHistory = true;
        set((state) => ({
          ...state,
          CardList: [...history.recent[newIndex]],
          History: {
            ...state.History,
            recentIndex: newIndex,
            isUndoRedo: false,
            canUndo: true,
            canRedo: newIndex < history.recent.length - 1
          }
        }));
        isUpdatingHistory = false;
      }
    },

    historyReset: () => {
      const currentCardList = get().CardList;

      isUpdatingHistory = true;
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
      isUpdatingHistory = false;
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

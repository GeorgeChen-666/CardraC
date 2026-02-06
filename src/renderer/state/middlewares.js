import { isDev } from '../functions';
import { actionLogger } from './logger';
import { subscribeWithSelector } from 'zustand/middleware';
import LZString from 'lz-string';

const historyMiddleware = (config) => (set, get, api) => {
  const history = {
    recent: [],
    recentIndex: -1,
    compressed: [],
    isUndoRedo: false,
    recordNext: false,  // ✅ 添加标志
    reset() {
      this.recent = [];
      this.recentIndex = -1;
      this.compressed = [];
    }
  };

  const wrappedSet = (partial, replace) => {
    const prevCardList = get().CardList;
    set(partial, replace);
    const nextCardList = get().CardList;

    if (prevCardList !== nextCardList && !history.isUndoRedo && history.recordNext) {
      // ✅ 如果是第一次记录，先保存当前状态
      if (history.recent.length === 0) {
        history.recent.push([...prevCardList]);
        history.recentIndex = 0;
      }

      if (history.recent.length >= 10) {
        const oldest = history.recent.shift();
        history.compressed.push(LZString.compressToUTF16(JSON.stringify(oldest)));
        history.recentIndex--;
        if (history.compressed.length > 40) history.compressed.shift();
      }
      history.recent = history.recent.slice(0, history.recentIndex + 1);
      history.recent.push([...nextCardList]);
      history.recentIndex++;
    }

    history.recordNext = false;
  };

  const store = config(wrappedSet, get, api);

  return {
    ...store,

    // ✅ 添加辅助方法：需要记录历史时用这个
    setWithHistory: (partial, replace) => {
      history.recordNext = true;
      wrappedSet(partial, replace);
    },

    historyUndo: () => {
      if (history.recentIndex > 0) {
        history.isUndoRedo = true;
        wrappedSet({ CardList: history.recent[--history.recentIndex] });
        history.isUndoRedo = false;
      } else if (history.compressed.length > 0) {
        history.isUndoRedo = true;
        const data = JSON.parse(LZString.decompressFromUTF16(history.compressed.pop()));
        history.recent.unshift(data);
        history.recentIndex = 0;
        wrappedSet({ CardList: data });
        history.isUndoRedo = false;
      }
    },
    historyRedo: () => {
      if (history.recentIndex < history.recent.length - 1) {
        history.isUndoRedo = true;
        wrappedSet({ CardList: history.recent[++history.recentIndex] });
        history.isUndoRedo = false;
      }
    },
    historyCanUndo: () => history.recentIndex > 0 || history.compressed.length > 0,
    historyCanRedo: () => history.recentIndex < history.recent.length - 1,
    historyReset: () => history.reset(),
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
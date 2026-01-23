export const actionLogger = (config, logger = defaultLogger) => {
  let actionDepth = 0;

  return (set, get, api) => {
    const wrappedSet = (fn, replace, actionName, params) => {
      const prevState = get();
      actionDepth += 1;
      set(fn, replace);
      const nextState = get();
      if (actionName && actionDepth === 1) {
        logger({ action: actionName, params, prev: prevState, next: nextState });
      }
      actionDepth -= 1;
    };

    // 只修改这里
    function wrapActions(obj) {
      const out = {};
      for (const key in obj) {
        if (typeof obj[key] === 'function') {
          out[key] = (...args) => {
            const result = obj[key].apply({ ...obj, set: wrappedSet, get }, args);
            return result;  // ← 返回 action 的结果
          };
        } else {
          out[key] = obj[key];
        }
      }
      return out;
    }

    const state = config(wrappedSet, get, api);
    return wrapActions(state);
  };
};

function defaultLogger({ action, params, prev, next }) {
  if (typeof window !== 'undefined' && window.console) {
    console.groupCollapsed(`[Zustand Action] ${action}`, ...params);
    console.log('Prev state:', prev);
    console.log('Next state:', next);
    console.groupEnd();
  }
}

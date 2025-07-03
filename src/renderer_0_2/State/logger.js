export const actionLogger = (config, logger = defaultLogger) => {
  let actionDepth = 0; // 记录当前 action 嵌套层级

  return (set, get, api) => {
    // 包装 set，拦截 action
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

    // 自动 wrap 所有 action function
    function wrapActions(obj) {
      const out = {};
      for (const key in obj) {
        if (typeof obj[key] === 'function') {
          out[key] = (...args) =>
            wrappedSet(
              (state) => obj[key].apply({ ...state, set: wrappedSet, get }, args),
              false,
              key,
              args
            );
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
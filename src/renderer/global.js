export let globalStore = null;

export const setGlobalStore = (store) => {
  globalStore = store;
};

export const getGlobalState = () => {
  return globalStore?.getState?.() || null;
};
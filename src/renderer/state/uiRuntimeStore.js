import { create } from 'zustand';

const initialState = {
  fileBrowserApi: null,
  imageViewerApi: null,
  cardSettingApi: null,
};

export const useUiRuntimeStore = create((set) => ({
  ...initialState,
  setFileBrowserApi: (fileBrowserApi) => set({ fileBrowserApi }),
  setImageViewerApi: (imageViewerApi) => set({ imageViewerApi }),
  setCardSettingApi: (cardSettingApi) => set({ cardSettingApi }),
  resetUiRuntime: () => set(initialState),
}));

export const resetUiRuntimeStore = () => {
  useUiRuntimeStore.getState().resetUiRuntime();
};


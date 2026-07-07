import React from 'react';
import { cleanup } from '@testing-library/react';
import { vi } from 'vitest';
import zhLocale from '../../../main/locales/zh.json';
import { layoutSides } from '../../../shared/constants';
import { mergeRendererState, renderWithRendererProviders, resetRendererStore } from '../helpers/rendererTestSetup';

const { rendererCaseRuntime } = vi.hoisted(() => ({
  rendererCaseRuntime: {
    functions: {},
    components: {},
    locales: null,
  },
}));

export const rendererLocales = {
  zh: zhLocale,
};

function resetRendererCaseRuntime() {
  rendererCaseRuntime.functions = {};
  rendererCaseRuntime.components = {};
  rendererCaseRuntime.locales = structuredClone(rendererLocales);
}

function applyRendererCaseOverrides({ locales, functions, components } = {}) {
  if (locales) {
    rendererCaseRuntime.locales = structuredClone(locales);
  }

  if (functions) {
    rendererCaseRuntime.functions = {
      ...rendererCaseRuntime.functions,
      ...functions,
    };
  }

  if (components) {
    rendererCaseRuntime.components = {
      ...rendererCaseRuntime.components,
      ...components,
    };
  }
}

function resolveRuntimeFunction(name, fallback) {
  return rendererCaseRuntime.functions[name] || fallback;
}

export const createRendererState = (currentView = 'edit') => ({
  Global: {
    currentLang: 'zh',
    availableLangs: ['zh'],
    locales: structuredClone(rendererCaseRuntime.locales || rendererLocales),
    currentView,
    isBackEditing: false,
    isShowOverView: true,
    exportPageCount: 2,
    exportPreviewIndex: 1,
  },
  Config: {
    sides: layoutSides.doubleSides,
    compressLevel: 2,
    globalBackground: null,
  },
  CardList: [{ id: 'card-1', face: { path: 'face1.png' }, back: { path: 'back1.png' }, repeat: 1 }],
});

export const bootstrapRendererCase = ({ currentView = 'edit', state, mocks } = {}) => {
  resetRendererCaseRuntime();
  applyRendererCaseOverrides(mocks);
  resetRendererStore();
  mergeRendererState(createRendererState(currentView));

  if (state) {
    mergeRendererState(state);
  }
};

export const cleanupRendererCase = () => {
  cleanup();
  resetRendererCaseRuntime();
};

export const renderRendererCase = (ui) => renderWithRendererProviders(ui);

resetRendererCaseRuntime();

vi.mock('electron', () => ({
  ipcRenderer: {
    send: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
  },
}));

vi.mock('../../functions', async () => {
  const actual = await vi.importActual('../../functions');
  const { initialState: runtimeInitialState } = await vi.importActual('../../../shared/constants');
  const { default: runtimeZhLocale } = await vi.importActual('../../../main/locales/zh.json');

  const createDefaultLoadConfig = async () => {
    const config = structuredClone(runtimeInitialState);
    config.Global.currentLang = 'zh';
    config.Global.availableLangs = ['zh'];
    config.Global.locales = structuredClone(rendererCaseRuntime.locales || { zh: runtimeZhLocale });
    return config;
  };

  return {
    ...actual,
    clearPreviewCache: vi.fn(async (...args) => resolveRuntimeFunction('clearPreviewCache', async () => true)(...args)),
    getExportPageCount: vi.fn(async (...args) => resolveRuntimeFunction('getExportPageCount', async () => 3)(...args)),
    getExportPreview: vi.fn(async (...args) => resolveRuntimeFunction('getExportPreview', async () => 'preview-content')(...args)),
    loadConfig: vi.fn(async (...args) => resolveRuntimeFunction('loadConfig', createDefaultLoadConfig)(...args)),
    saveConfig: vi.fn(async (...args) => resolveRuntimeFunction('saveConfig', async () => true)(...args)),
    exportFile: vi.fn(async (...args) => resolveRuntimeFunction('exportFile', async () => true)(...args)),
    openProject: vi.fn(async (...args) => resolveRuntimeFunction('openProject', async () => null)(...args)),
    reloadLocalImage: vi.fn(async (...args) => resolveRuntimeFunction('reloadLocalImage', async () => null)(...args)),
    saveProject: vi.fn(async (...args) => resolveRuntimeFunction('saveProject', async () => true)(...args)),
    regUpdateProgress: vi.fn(),
    showFileOpenDialog: vi.fn(async (...args) => resolveRuntimeFunction('showFileOpenDialog', async () => [])(...args)),
    openImage: vi.fn(async (...args) => resolveRuntimeFunction('openImage', async () => [])(...args)),
  };
});

vi.mock('../../parts/Notification', () => ({
  notificationSuccess: vi.fn(),
  triggerNotification: vi.fn(),
  Notification: () => null,
}));

vi.mock('../../parts/LoadingModal', () => ({
  LoadingModal: () => null,
}));

vi.mock('../../parts/edit/FileBrowser/FileBrowserDialog', () => ({
  FileBrowserDialog: React.forwardRef((_props, _ref) => null),
}));

vi.mock('../../parts/ToolBar/About/AboutDialog', () => ({
  AboutDialog: React.forwardRef((_props, _ref) => null),
}));

vi.mock('../../parts/ToolBar/Setup/SetupDialog', () => ({
  SetupDialog: React.forwardRef((_props, _ref) => null),
}));

vi.mock('../../parts/ToolBar/Chat/ChatDialog', () => ({
  ChatDialog: React.forwardRef((_props, _ref) => null),
}));

vi.mock('../../parts/ToolBar/Print/PrintDrawer', () => ({
  PrintDrawer: React.forwardRef((_props, _ref) => null),
}));

vi.mock('../../parts/edit/ImageViewer', () => ({
  ImageViewer: React.forwardRef((_props, _ref) => null),
}));

vi.mock('../../componments/BackendTasksIndicator', () => ({
  BackendTasksIndicator: () => null,
}));

vi.mock('../../parts/edit/CardList', () => ({
  CardList: () => {
    if (rendererCaseRuntime.components.CardList) {
      return rendererCaseRuntime.components.CardList();
    }

    return <div data-testid="card-list">card-list</div>;
  },
}));

vi.mock('../../parts/Footer', async () => {
  const { useGlobalStore } = await vi.importActual('../../state/store');
  const { default: runtimeZhLocale } = await vi.importActual('../../../main/locales/zh.json');
  const footerLabels = runtimeZhLocale.footer;

  return {
    Footer: () => {
      const currentView = useGlobalStore(state => state.Global.currentView || 'edit');
      const fileLength = useGlobalStore(state => state.CardList.length);
      const cardLength = useGlobalStore(state => state.CardList.reduce((sum, card) => sum + (parseInt(card.repeat, 10) || 1), 0));
      const { mergeGlobal } = useGlobalStore.getState();

      if (rendererCaseRuntime.components.Footer) {
        return rendererCaseRuntime.components.Footer({
          currentView,
          fileLength,
          cardLength,
          footerLabels,
          switchView: (view) => mergeGlobal({ currentView: view }),
        });
      }

      return (
        <div data-testid="footer-view-switcher">
          <span>{`${footerLabels.files} ${fileLength} / ${footerLabels.images} ${cardLength}`}</span>
          <span data-testid="footer-current-view">{currentView === 'preview' ? footerLabels.previewView : footerLabels.editView}</span>
          <button type="button" onClick={() => mergeGlobal({ currentView: 'edit' })}>{footerLabels.editView}</button>
          <button type="button" onClick={() => mergeGlobal({ currentView: 'preview' })}>{footerLabels.previewView}</button>
        </div>
      );
    },
  };
});

vi.mock('../../parts/preview/PrintPreview', () => ({
  PrintPreview: React.forwardRef((_props, _ref) => {
    if (rendererCaseRuntime.components.PrintPreview) {
      return rendererCaseRuntime.components.PrintPreview();
    }

    return <div data-testid="print-preview">preview</div>;
  }),
}));









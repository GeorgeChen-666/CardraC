import React from 'react';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import zhLocale from '../../../main/locales/zh.json';
import { layoutSides } from '../../../shared/constants';
import { mergeRendererState, renderWithRendererProviders, resetRendererStore } from '../helpers/rendererTestSetup';
import { resetUiRuntimeStore } from '../../state/uiRuntimeStore';

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

function resolveRuntimeComponent(name, actual, fallback) {
  if (rendererCaseRuntime.components[name] === 'actual') {
    return actual;
  }

  return rendererCaseRuntime.components[name] || fallback;
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
  resetUiRuntimeStore();
  mergeRendererState(createRendererState(currentView));

  if (state) {
    mergeRendererState(state);
  }
};

export const cleanupRendererCase = () => {
  cleanup();
  resetUiRuntimeStore();
  resetRendererCaseRuntime();
};

export const renderRendererCase = (ui) => renderWithRendererProviders(ui);

resetRendererCaseRuntime();

const mutedConsoleMethods = ['debug', 'info', 'log', 'warn', 'error'];

beforeEach(() => {
  mutedConsoleMethods.forEach((method) => {
    vi.spyOn(console, method).mockImplementation(() => {});
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Polyfill: CardList 依赖 IntersectionObserver（jsdom 无此 API）
if (typeof IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class IntersectionObserver {
    constructor(callback) {
      this.callback = callback;
    }
    observe(element) {
      this.callback?.([{ target: element, isIntersecting: true }]);
    }
    unobserve() {}
    disconnect() {}
  };
}

if (typeof ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

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
  const {
    eleActions: runtimeEleActions,
    initialState: runtimeInitialState,
  } = await vi.importActual('../../../shared/constants');
  const { default: runtimeZhLocale } = await vi.importActual('../../../main/locales/zh.json');

  const defaultPrinters = [
    {
      printerName: 'Test Printer',
      isDefault: true,
      defaultWidthMm: 210,
      defaultHeightMm: 297,
      isLandscape: false,
      defaultPaperSize: 'A4',
      paperSizes: [{ name: 'A4', widthMm: 210, heightMm: 297 }],
    },
  ];

  const createDefaultLoadConfig = async () => {
    const config = structuredClone(runtimeInitialState);
    config.Global.currentLang = 'zh';
    config.Global.availableLangs = ['zh'];
    config.Global.locales = structuredClone(rendererCaseRuntime.locales || { zh: runtimeZhLocale });
    return config;
  };

  const defaultCallMain = async (key) => {
    switch (key) {
      case runtimeEleActions.loadPrintConfig:
        return { printConfig: {} };
      case runtimeEleActions.savePrintConfig:
      case runtimeEleActions.printPages:
      case runtimeEleActions.adjustGuidePrint:
      case runtimeEleActions.clearPreviewCache:
      case runtimeEleActions.version:
        return true;
      default:
        return {};
    }
  };

  return {
    ...actual,
    callMain: vi.fn(async (...args) => resolveRuntimeFunction('callMain', defaultCallMain)(...args)),
    checkImage: vi.fn(async (...args) => resolveRuntimeFunction('checkImage', async () => [])(...args)),
    clearPreviewCache: vi.fn(async (...args) => resolveRuntimeFunction('clearPreviewCache', async () => true)(...args)),
    getExportPageCount: vi.fn(async (...args) => resolveRuntimeFunction('getExportPageCount', async () => 3)(...args)),
    getExportPreview: vi.fn(async (...args) => resolveRuntimeFunction('getExportPreview', async () => 'preview-content')(...args)),
    getPrinters: vi.fn(async (...args) => resolveRuntimeFunction('getPrinters', async () => ({ printers: defaultPrinters }))(...args)),
    getTemplate: vi.fn(async (...args) => resolveRuntimeFunction('getTemplate', async () => [])(...args)),
    loadConfig: vi.fn(async (...args) => resolveRuntimeFunction('loadConfig', createDefaultLoadConfig)(...args)),
    openMultiImage: vi.fn(async (...args) => resolveRuntimeFunction('openMultiImage', async () => [])(...args)),
    saveConfig: vi.fn(async (...args) => resolveRuntimeFunction('saveConfig', async () => true)(...args)),
    exportFile: vi.fn(async (...args) => resolveRuntimeFunction('exportFile', async () => true)(...args)),
    openProject: vi.fn(async (...args) => resolveRuntimeFunction('openProject', async () => null)(...args)),
    reloadLocalImage: vi.fn(async (...args) => resolveRuntimeFunction('reloadLocalImage', async () => null)(...args)),
    saveProject: vi.fn(async (...args) => resolveRuntimeFunction('saveProject', async () => true)(...args)),
    setTemplate: vi.fn(async (...args) => resolveRuntimeFunction('setTemplate', async () => true)(...args)),
    regUpdateProgress: vi.fn(),
    showFileOpenDialog: vi.fn(async (...args) => resolveRuntimeFunction('showFileOpenDialog', async () => [])(...args)),
    openImage: vi.fn(async (...args) => resolveRuntimeFunction('openImage', async () => [])(...args)),
    editTemplate: vi.fn(async (...args) => resolveRuntimeFunction('editTemplate', async () => true)(...args)),
    deleteTemplate: vi.fn(async (...args) => resolveRuntimeFunction('deleteTemplate', async () => true)(...args)),
    version: vi.fn(async (...args) => resolveRuntimeFunction('version', async () => 'test-version')(...args)),
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

vi.mock('../../parts/edit/FileBrowser/FileBrowserDialog', async () => {
  const actual = await vi.importActual('../../parts/edit/FileBrowser/FileBrowserDialog');
  const fallback = React.forwardRef((_props, _ref) => null);
  return {
    FileBrowserDialog: resolveRuntimeComponent('FileBrowserDialog', actual.FileBrowserDialog, fallback),
  };
});

vi.mock('../../parts/ToolBar/About/AboutDialog', async () => {
  const actual = await vi.importActual('../../parts/ToolBar/About/AboutDialog');
  const fallback = React.forwardRef((_props, ref) => {
    const [open, setOpen] = React.useState(false);
    React.useImperativeHandle(ref, () => ({ openDialog: () => setOpen(true) }));
    return open ? <div data-testid="about-dialog">About Dialog</div> : null;
  });
  return {
    AboutDialog: resolveRuntimeComponent('AboutDialog', actual.AboutDialog, fallback),
  };
});

vi.mock('../../parts/ToolBar/Setup/SetupDialog', async () => {
  const actual = await vi.importActual('../../parts/ToolBar/Setup/SetupDialog');
  const fallback = React.forwardRef((_props, ref) => {
    const [open, setOpen] = React.useState(false);
    React.useImperativeHandle(ref, () => ({ openDialog: () => setOpen(true) }));
    return open ? <div data-testid="setup-dialog">Setup Dialog</div> : null;
  });
  return {
    SetupDialog: resolveRuntimeComponent('SetupDialog', actual.SetupDialog, fallback),
  };
});

vi.mock('../../parts/ToolBar/Chat/ChatDialog', async () => {
  const actual = await vi.importActual('../../parts/ToolBar/Chat/ChatDialog');
  const fallback = React.forwardRef((_props, ref) => {
    const [open, setOpen] = React.useState(false);
    React.useImperativeHandle(ref, () => ({ openDialog: () => setOpen(true) }));
    return open ? <div data-testid="chat-dialog">Chat Dialog</div> : null;
  });
  return {
    ChatDialog: resolveRuntimeComponent('ChatDialog', actual.ChatDialog, fallback),
  };
});

vi.mock('../../parts/ToolBar/Print/PrintDrawer', async () => {
  const actual = await vi.importActual('../../parts/ToolBar/Print/PrintDrawer');
  const fallback = React.forwardRef((_props, ref) => {
    const [open, setOpen] = React.useState(false);
    React.useImperativeHandle(ref, () => ({ openDrawer: () => setOpen(true) }));
    return open ? <div data-testid="print-drawer">Print Drawer</div> : null;
  });
  return {
    PrintDrawer: resolveRuntimeComponent('PrintDrawer', actual.PrintDrawer, fallback),
  };
});

vi.mock('../../parts/edit/ImageViewer', async () => {
  const actual = await vi.importActual('../../parts/edit/ImageViewer');
  const fallback = React.forwardRef((_props, _ref) => null);
  return {
    ImageViewer: resolveRuntimeComponent('ImageViewer', actual.ImageViewer, fallback),
  };
});

vi.mock('../../componments/BackendTasksIndicator', () => ({
  BackendTasksIndicator: () => null,
}));

vi.mock('../../parts/preview/PrintPreview', () => ({
  PrintPreview: React.forwardRef((_props, _ref) => (
    <div data-testid="print-preview">preview</div>
  )),
}));
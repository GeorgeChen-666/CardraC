// src/renderer/state/store.d.ts
import type { StoreApi } from 'zustand';

interface BackendJob {
  visible: boolean;
  progress: number;
}

interface GlobalState {
  currentLang: string;
  isShowOverView: boolean;
  availableLangs?: string[];
  isLoading?: number;
  loadingText?: string;
  isInProgress?: boolean;
  progress?: number;
  lastSelection?: any;
  isBackEditing?: boolean;
  selections?: any[];
  locales?: any;
  imageVersion?: number;
  exportPageCount?: number;
  exportPreviewIndex?: number;
  currentView?: string;
  backendJobs?: Record<string, BackendJob>;
}

interface ConfigState {
  pageSize: string;
  pageWidth: number;
  pageHeight: number;
  offsetX: number;
  offsetY: number;
  landscape: boolean;
  sides: string;
  autoConfigFlip: boolean;
  flip: string;
  cardWidth: number;
  cardHeight: number;
  compressLevel: number;
  marginX: number;
  marginY: number;
  foldInHalfMargin: number;
  bleedX: number;
  bleedY: number;
  columns: number;
  rows: number;
  autoColumnsRows: boolean;
  fCutLine: string;
  bCutLine: string;
  lineWeight: number;
  cutlineColor: string;
  foldLineType: string;
  globalBackground?: any;
  marginFilling?: boolean;
  avoidDislocation?: boolean;
  brochureRepeatPerPage?: boolean;
  pageNumber?: boolean;
}

interface Card {
  id: string;
  face: any;
  back: any;
  repeat: number;
  selected?: boolean;
  config?: any;
}

interface StoreState {
  Global: GlobalState;
  Config: ConfigState;
  CardList: Card[];

  // Core methods
  fillState: (state: Partial<StoreState>) => void;
  mergeState: (newState: Partial<StoreState>, path?: string) => void;
  mergeGlobal: (newState: Partial<GlobalState>) => void;
  mergeConfig: (newState: Partial<ConfigState>) => void;

  // Utility methods
  loading: <T = void>(cb?: () => Promise<T>, text?: string) => Promise<T | undefined>;
  progress: (v: number) => void;

  // Project methods
  newProject: () => Promise<void>;
  openProject: (params?: any) => void;
  saveProject: (params?: any) => void;
  exportFile: (params: { targetFileType: string; [key: string]: any }) => void;
  printPages: (params: { pageList: any[]; printConfig: any }) => Promise<boolean | undefined>;
  adjustGuidePrint: (params: { printConfig: any }) => Promise<boolean | undefined>;
  reloadLocalImage: () => void;
  getExportPageCount: () => Promise<void>;
  getExportPreview: (pageIndex: number, isSilence?: boolean) => Promise<any>;

  // Card methods
  cardAdd: (images: Array<{ face: any; back: any }>) => void;
  cardEditById: (newState: Partial<Card> & { id: string }) => void;
  cardEditByIndex: (index: number, side: 'face' | 'back', imageData: any) => void;
  cardRemoveByIds: (ids: string[]) => void;
  cardSelect: (selectedId: string) => void;
  cardCtrlSelect: (selectedId: string) => void;
  cardShiftSelect: (selectedId: string) => void;

  // Drag methods
  dragHoverMove: (to: number) => void;
  dragHoverCancel: () => void;
  dragCardsMove: () => void;

  // Selected cards methods
  selectedCardsRemove: () => void;
  selectedCardsDuplicate: () => void;
  selectedCardsEdit: (newState: Partial<Card>) => void;
  selectedCardsEditEach: (callback: (card: Card) => Card | null | undefined) => void;
  selectedCardsSwap: () => void;
  editCardsConfig: (ids: string[], config: any) => void;

  // Backend jobs methods
  updateBackendJob: (key: string, updates: Partial<BackendJob>) => void;
  clearBackendJob: (key: string) => void;

  // History methods
  historyUndo: () => void;
  historyRedo: () => void;
  historyCanUndo: () => boolean;
  historyCanRedo: () => boolean;
  historyReset: () => void;
  setWithHistory: (updater: (state: StoreState) => StoreState) => void;
}

type Selectorize<S> = {
  [K in keyof S]: () => S[K];
};

export declare const useGlobalStore: {
  (): StoreState;
  <U>(selector: (state: StoreState) => U, equalityFn?: (a: U, b: U) => boolean): U;
  getState: () => StoreState;
  setState: (state: Partial<StoreState> | ((state: StoreState) => Partial<StoreState>), replace?: boolean) => void;
  subscribe: {
    (listener: (state: StoreState, prevState: StoreState) => void): () => void;
    <U>(
      selector: (state: StoreState) => U,
      listener: (selectedState: U, previousSelectedState: U) => void,
      options?: { equalityFn?: (a: U, b: U) => boolean; fireImmediately?: boolean }
    ): () => void;
  };
  destroy: () => void;
  selectors: Selectorize<Pick<StoreState, 'Global' | 'Config' | 'CardList'>>;
};

export type { StoreState, GlobalState, ConfigState, Card, BackendJob };

import type { StoreApi } from 'zustand';

interface GlobalState {
  currentLang: string;
  isShowOverView: boolean;
  availableLangs?: string[];
  isLoading?: boolean;
  loadingText?: string;
  isInProgress?: boolean;
  progress?: number;
  lastSelection?: any;
  isBackEditing?: boolean;
  selections?: any[];
  imageVersion?: number;
  exportPageCount?: number;
  exportPreviewIndex?: number;
  currentView?: string;
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
  scale?: number;
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
  loading: (cb?: () => Promise<void>, text?: string) => Promise<void>;
  progress: (v: number) => void;

  // Project methods
  openProject: () => void;
  saveProject: () => void;
  exportFile: (targetFileType: string) => void;
  printPages: (params: { pageList: any[]; printConfig: any }) => void;
  reloadLocalImage: () => void;
  getExportPageCount: (targetFileType: string) => void;
  getExportPreview: (pageIndex: number) => Promise<any>;

  // Card methods
  cardAdd: (images: any[]) => void;
  cardEditById: (newState: Partial<Card> & { id: string }) => void;
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
  selectedCardsFillBackWithEach: (backImageList: any[]) => void;
  selectedCardsSwap: () => void;
  editCardsConfig: (ids: string[], config: any) => void;

  // History methods
  historyUndo: () => void;
  historyRedo: () => void;
  historyCanUndo: () => boolean;
  historyCanRedo: () => boolean;
  historyReset: () => void;
}

type Selectorize<S> = {
  [K in keyof S]: () => S[K];
};

export declare const useGlobalStore: {
  (): StoreState;
  <U>(selector: (state: StoreState) => U): U;
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

export type { StoreState, GlobalState, ConfigState, Card };

import { StoreApi } from 'zustand';

type Selectorize<T> = {
  [K in keyof T]: T[K] extends object
    ? Selectorize<T[K]> & ((...args: any[]) => T[K])
    : ((...args: any[]) => T[K]);
};

export interface GlobalState {
  availableLangs: string[];
  currentLang: string;
  isLoading: boolean;
  loadingText: string;
  isInProgress: boolean;
  progress: number;
  lastSelection: any;
  isBackEditing: boolean;
  isShowOverView: boolean;
  selections: any[];
}

export type LayoutSides = string; // Could be a union of allowed string values
export type FlipWay = string;    // Could be a union of allowed string values

export interface ConfigState {
  pageSize: string;
  pageWidth: number;
  pageHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  landscape: boolean;
  sides: LayoutSides;
  autoConfigFlip: boolean;
  flip: FlipWay;
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
  globalBackground: any;
  marginFilling: boolean;
  avoidDislocation: boolean;
  brochureRepeatPerPage: boolean;
}

export interface StoreState {
  Global: GlobalState;
  Config: ConfigState;
  CardList: any[];
  fillState: (newState: Partial<Omit<StoreState, 'fillState' | 'mergeState' | 'mergeGlobal' | 'mergeConfig' | 'loading' | 'progress' | 'openProject' | 'selectors'>>) => void;
  mergeState: (newState: any, path?: string) => void;
  mergeGlobal: (newState: any) => void;
  mergeConfig: (newState: any) => void;
  loading: (cb: () => Promise<void>, text?: string) => Promise<void>;
  progress: (v: number) => void;
  openProject: () => Promise<void>;
}

// For Zustand hook
export declare const useGlobalStore: {
  (): StoreState;
  getState: () => StoreState;
  setState: (state: Partial<StoreState>, replace?: boolean) => void;
  subscribe: StoreApi<StoreState>['subscribe'];
  destroy: StoreApi<StoreState>['destroy'];
  selectors: Selectorize<Pick<StoreState, 'Global' | 'Config' | 'CardList'>>;
};

// For initialState
export declare const initialState: Readonly<Pick<StoreState, 'Global' | 'Config' | 'CardList'>>;
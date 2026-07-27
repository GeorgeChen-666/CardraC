export const eleActions = Object.freeze({
  openProject: 'open-project',
  saveProject: 'save-project',
  openImage: 'open-image',
  loadConfig: 'load-config',
  saveConfig: 'save-config',
  loadPrintConfig: 'load-print-config',
  savePrintConfig: 'save-print-config',
  checkImage: 'check-image',
  loadImageList: 'load-image-list',
  getImagePath: 'get-image-path',
  getImageContent: 'get-image-content',
  getExportPageCount: 'get-export-page-count',
  getExportPreview: 'get-export-preview',
  clearPreviewCache: 'clear-preview-cache',
  reloadLocalImage: 'reload-local-image',
  exportFile: 'export-file',
  getPrinters: 'get-printers',
  adjustGuidePrint: 'adjust-guide-print',
  printPages: 'print-pages',
  getTemplate: 'get-template',
  setTemplate: 'set-template',
  editTemplate: 'edit-template',
  deleteTemplate: 'delete-template',
  version: 'version',
  getDefaultPath: 'get-default-path',
  setDefaultPath: 'set-default-path',
  listDrives: 'list-drives',
  browsePath: 'browse-path',
  getFileDetails: 'get-file-details',
  backendJobProgress: 'backend-job-progress',
  backendUiFillState: 'backend-ui-fill-state',
  backendNotification: 'backend-notification'
});

export const layoutSides = Object.freeze({
  oneSide: 'one side',
  doubleSides: 'double sides',
  brochure: 'brochure',
  foldInHalf: 'fold in half'
})

export const flipWay = Object.freeze({
  none: 'none',
  longEdgeBinding: 'long-edge binding',
  shortEdgeBinding: 'short-edge binding'
})

export const exportType = Object.freeze({
  pdf: 'pdf',
  png: 'png',
  svg: 'svg',
  zip: 'zip'
})

export const initialState = Object.freeze({
  Global: {
    availableLangs: [],
    currentLang: 'zh',
    isLoading: 0,
    loadingText: '',
    isInProgress: false,
    progress: 0,
    lastSelection: null,
    isBackEditing: false,
    isShowOverView: true,
    selections: [],
    locales: {},
    currentView: 'edit',
    exportPageCount: 0,
    exportPreviewIndex: 1,
    imageVersion: 1,
    backendJobs: {},
  },
  Config: {
    pageSize: 'A4:210,297',
    pageWidth: 210,
    pageHeight: 297,
    offsetX: 0,
    offsetY: 0,
    landscape: true,
    sides: layoutSides.doubleSides,
    autoConfigFlip: false,
    flip: flipWay.longEdgeBinding,
    cardWidth: 63,
    cardHeight: 88,
    compressLevel: 2,
    marginX: 3,
    marginY: 3,
    foldInHalfMargin: 0,
    bleedX: 1,
    bleedY: 1,
    columns: 4,
    rows: 2,
    autoColumnsRows: true,
    fCutLine: '1',
    bCutLine: '1',
    lineWeight: 0.5,
    cutlineColor: '#000000',
    foldLineType: '0',
    globalBackground: null,
    marginFilling: false,
    avoidDislocation: false,
    brochureRepeatPerPage: false,
    pageNumber: false,
  },
  CardList: [],
})

export const emptyImgPath = '_emptyImg'

export const emptyImg = {
  path: '_emptyImg',
  ext: 'png',
};

export const emptyImgContent = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEV/f3+QyhsjAAAACklEQVQI\n' +
  '12NgAAAAAgAB4iG8MwAAAABJRU5ErkJggg=='

export const imageCacheType = Object.freeze({
  thumbnails: 'thumbnails',
  highQuality: 'high-quality'
})

export const backendJobKey = Object.freeze({
  loadHighQuality: 'load-high-quality'
})
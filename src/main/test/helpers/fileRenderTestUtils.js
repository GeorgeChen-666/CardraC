import { expect } from 'vitest';
import { flipWay, layoutSides } from '../../../shared/constants';

const TEST_IMAGE_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export const DEFAULT_GLOBAL_BACKGROUND = { path: 'bg.png', ext: 'PNG' };

const createImage = (side, id, overrides = {}) => ({
  path: `${side}${id}.png`,
  ext: 'PNG',
  mtime: id,
  ...overrides,
});

export const createCard = (id, options = {}) => {
  const {
    repeat = 1,
    config = { id, marker: id },
    includeBase64 = false,
    face: faceOverride,
    back: backOverride,
    ...rest
  } = options;

  const sharedImageOverrides = includeBase64 ? { base64: TEST_IMAGE_BASE64 } : {};

  return {
    id: `card-${id}`,
    face: faceOverride ?? createImage('face', id, sharedImageOverrides),
    back: backOverride ?? createImage('back', id, sharedImageOverrides),
    config,
    repeat,
    ...rest,
  };
};

export const createState = (count, { globalBackground = null, repeatMap = {}, cardFactory } = {}) => ({
  CardList: Array.from({ length: count }, (_, index) => {
    const id = index + 1;
    if (cardFactory) return cardFactory(id, index);
    return createCard(id, { repeat: repeatMap[id] ?? 1 });
  }),
  globalBackground,
});

export const createSeededState = (cardSource, storage, options = {}) => {
  const {
    Config,
    globalBackground = null,
    includeBase64 = true,
    cardFactory,
    ...restState
  } = options;

  const CardList = Array.isArray(cardSource)
    ? cardSource
    : Array.from({ length: cardSource }, (_, index) => {
      const id = index + 1;
      if (cardFactory) return cardFactory(id, index);
      return createCard(id, { includeBase64 });
    });

  const state = {
    Config,
    CardList,
    globalBackground,
    ...restState,
  };

  if (storage) {
    seedImageStorage(CardList, storage);
  }

  return state;
};

export const createRenderConfig = (overrides = {}) => ({
  sides: layoutSides.oneSide,
  flip: flipWay.longEdgeBinding,
  landscape: true,
  cardWidth: 63,
  cardHeight: 88,
  marginX: 10,
  marginY: 10,
  bleedX: 0,
  bleedY: 0,
  columns: 2,
  rows: 2,
  offsetX: 0,
  offsetY: 0,
  foldLineType: '0',
  foldInHalfMargin: 0,
  globalBackground: null,
  marginFilling: false,
  avoidDislocation: false,
  brochureRepeatPerPage: false,
  pageNumber: false,
  ...overrides,
});

export const createDoubleSidesConfig = (overrides = {}) => createRenderConfig({
  sides: layoutSides.doubleSides,
  columns: 4,
  rows: 2,
  ...overrides,
});

export const createFoldConfig = (overrides = {}) => createRenderConfig({
  sides: layoutSides.foldInHalf,
  rows: 2,
  columns: 4,
  foldLineType: '0',
  ...overrides,
});

export const createBrochureConfig = (overrides = {}) => createRenderConfig({
  sides: layoutSides.brochure,
  flip: flipWay.none,
  rows: 2,
  columns: 2,
  ...overrides,
});

export const createPageSize = (width = 210, height = 297) => ({
  maxWidth: width,
  maxHeight: height,
});

export const range = (start, count) => Array.from({ length: count }, (_, index) => start + index);
const pathsFromIndices = (indices, side) => indices.map((index) => `${index}.${side}`);
const valuesFromIndices = (indices, realCount) => indices.map((index) => (index < realCount ? index + 1 : null));

const imageLabel = (image) => {
  if (!image) return null;
  const match = image.path?.match(/(?:face|back)(\d+)\.png$/);
  return match ? Number(match[1]) : image.path;
};

const snapshotPage = (page) => ({
  images: (page.imageList ?? []).map(imageLabel),
  paths: [...(page.pathList ?? [])],
  configs: (page.config ?? []).map((config) => config?.marker ?? config?.id ?? null),
});

export const createSnapshotExpectation = ({ images, indices, side, realCount, paths, configs }) => ({
  images: images ?? valuesFromIndices(indices, realCount),
  paths: paths ?? pathsFromIndices(indices, side),
  configs: configs ?? valuesFromIndices(indices, realCount),
});

export const expectPageSnapshot = (page, expected) => {
  expect(snapshotPage(page)).toEqual(expected);
};

export const createPageData = ({
  type = 'back',
  imageList = [],
  config = imageList.map(() => ({})),
  pathList,
} = {}) => ({
  type,
  imageList,
  config,
  ...(pathList ? { pathList } : {}),
});

export const seedImageStorage = (cards, storage) => {
  cards.forEach((card) => {
    if (card.face?.path && card.face?.base64) {
      storage[card.face.path] = card.face.base64;
    }
    if (card.back?.path && card.back?.base64) {
      storage[card.back.path] = card.back.base64;
    }
  });
};



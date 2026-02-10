import { describe, test, expect, beforeEach, vi } from 'vitest';

const mockConfigStore = {
  Config: { ...initialState.Config }
};
vi.mock('./ele_action/functions', () => ({
  getConfigStore: vi.fn(() => mockConfigStore),
  saveDataToFile: vi.fn(),
  getBorderAverageColors: vi.fn((base64) => {
    return Promise.resolve('#FF0000');
  })
}));

import { getCutRectangleList, getPagedImageListByCardList, adjustBackPageImageOrder, isNeedRotation, ImageStorage  } from '../ele_action/handlers/file_render/utils';
import { layoutSides, initialState, flipWay } from '../../shared/constants';
import { ShadowAdapter } from '../ele_action/handlers/file_render/adapter/ShadowAdapter';
import { exportFile } from '../ele_action/handlers/file_render';

const resetConfig = () => {
  mockConfigStore.Config = { ...initialState.Config };
};

const setConfig = (newConfig) => {
  Object.assign(mockConfigStore.Config, newConfig);
};

const globalBackground = { path: 'bg.png', ext: 'PNG' };

const createCard = (id, config = {}) => ({
  face: { path: `face${id}.png`, ext: 'PNG' },
  back: { path: `back${id}.png`, ext: 'PNG', mtime: Date.now() },
  config,
  repeat: 1,
});

describe('图序测试', () => {
  const testImageOrder = (State, Config, {
    expectedPageCount,
    expectedFirstPageImages,
    expectedSecondPageImages,
    expectedFaceOrder,
    expectedBackOrder,
  }) => {
    const result = getPagedImageListByCardList(State, Config);

    expect(result.length, '总页数').toBe(expectedPageCount);
    expect(result[0].imageList.length, '第一页图数').toBe(expectedFirstPageImages);
    expect(result[1].imageList.length, '第二页图数').toBe(expectedSecondPageImages);

    const faceImageList = adjustBackPageImageOrder(result[0], Config);
    expect(
      faceImageList.imageList.map(img => parseInt(img?.path?.replace(/face|back/, ''))).join(','),
      '正面图顺序'
    ).toBe(expectedFaceOrder);

    const backImageList = adjustBackPageImageOrder(result[1], Config);
    expect(
      backImageList.imageList.map(img => parseInt(img?.path?.replace(/face|back/, ''))).join(','),
      '背面图顺序'
    ).toBe(expectedBackOrder);
  };

  describe('双面', () => {
    const State = {
      CardList: Array.from({ length: 16 }, (_, i) => createCard(i + 1)),
      globalBackground,
    };
    const Config = {
      sides: layoutSides.doubleSides,
      cardWidth: 63,
      cardHeight: 88,
    };

    test('横打-长边为轴翻面', () => {
      testImageOrder(State, {
        ...Config,
        flip: flipWay.longEdgeBinding,
        landscape: true,
        rows: 2,
        columns: 4
      }, {
        expectedPageCount: 4,
        expectedFirstPageImages: 8,
        expectedSecondPageImages: 8,
        expectedFaceOrder: '1,2,3,4,5,6,7,8',
        expectedBackOrder: '5,6,7,8,1,2,3,4',
      });
    });

    test('横打-短边为轴翻面', () => {
      testImageOrder(State, {
        ...Config,
        flip: flipWay.shortEdgeBinding,
        landscape: true,
        rows: 2,
        columns: 4
      }, {
        expectedPageCount: 4,
        expectedFirstPageImages: 8,
        expectedSecondPageImages: 8,
        expectedFaceOrder: '1,2,3,4,5,6,7,8',
        expectedBackOrder: '4,3,2,1,8,7,6,5',
      });
    });

    test('竖打-长边为轴翻面', () => {
      testImageOrder(State, {
        ...Config,
        flip: flipWay.longEdgeBinding,
        landscape: false,
        rows: 3,
        columns: 3
      }, {
        expectedPageCount: 4,
        expectedFirstPageImages: 9,
        expectedSecondPageImages: 9,
        expectedFaceOrder: '1,2,3,4,5,6,7,8,9',
        expectedBackOrder: '3,2,1,6,5,4,9,8,7',
      });
    });

    test('竖打-短边为轴翻面', () => {
      testImageOrder(State, {
        ...Config,
        flip: flipWay.shortEdgeBinding,
        landscape: false,
        rows: 3,
        columns: 3
      }, {
        expectedPageCount: 4,
        expectedFirstPageImages: 9,
        expectedSecondPageImages: 9,
        expectedFaceOrder: '1,2,3,4,5,6,7,8,9',
        expectedBackOrder: '7,8,9,4,5,6,1,2,3',
      });
    });
  });

  describe('双面(两张卡)', () => {
    const State = {
      CardList: Array.from({ length: 2 }, (_, i) => createCard(i + 1)),
      globalBackground,
    };
    const Config = {
      sides: layoutSides.doubleSides,
      cardWidth: 63,
      cardHeight: 88,
    };

    test('横打-长边为轴翻面', () => {
      testImageOrder(State, {
        ...Config,
        flip: flipWay.longEdgeBinding,
        landscape: true,
        rows: 2,
        columns: 4
      }, {
        expectedPageCount: 2,
        expectedFirstPageImages: 2,
        expectedSecondPageImages: 2,
        expectedFaceOrder: '1,2',
        expectedBackOrder: 'NaN,NaN,NaN,NaN,1,2,NaN,NaN',
      });
    });

    test('横打-短边为轴翻面', () => {
      testImageOrder(State, {
        ...Config,
        flip: flipWay.shortEdgeBinding,
        landscape: true,
        rows: 2,
        columns: 4
      }, {
        expectedPageCount: 2,
        expectedFirstPageImages: 2,
        expectedSecondPageImages: 2,
        expectedFaceOrder: '1,2',
        expectedBackOrder: 'NaN,NaN,2,1,NaN,NaN,NaN,NaN',
      });
    });

    test('竖打-长边为轴翻面', () => {
      testImageOrder(State, {
        ...Config,
        flip: flipWay.longEdgeBinding,
        landscape: false,
        rows: 3,
        columns: 3
      }, {
        expectedPageCount: 2,
        expectedFirstPageImages: 2,
        expectedSecondPageImages: 2,
        expectedFaceOrder: '1,2',
        expectedBackOrder: 'NaN,2,1,NaN,NaN,NaN,NaN,NaN,NaN',
      });
    });

    test('竖打-短边为轴翻面', () => {
      testImageOrder(State, {
        ...Config,
        flip: flipWay.shortEdgeBinding,
        landscape: false,
        rows: 3,
        columns: 3
      }, {
        expectedPageCount: 2,
        expectedFirstPageImages: 2,
        expectedSecondPageImages: 2,
        expectedFaceOrder: '1,2',
        expectedBackOrder: 'NaN,NaN,NaN,NaN,NaN,NaN,1,2,NaN',
      });
    });
  });

  describe('对贴', () => {
    const State = {
      CardList: Array.from({ length: 16 }, (_, i) => createCard(i + 1)),
      globalBackground,
    };
    const Config = {
      sides: layoutSides.foldInHalf,
      cardWidth: 63,
      cardHeight: 88,
    };

    test('横打', () => {
      testImageOrder(State, {
        ...Config,
        foldLineType: '0',
        landscape: true,
        rows: 2,
        columns: 4
      }, {
        expectedPageCount: 8,
        expectedFirstPageImages: 4,
        expectedSecondPageImages: 4,
        expectedFaceOrder: '1,2,3,4',
        expectedBackOrder: '1,2,3,4',
      });

      testImageOrder(State, {
        ...Config,
        foldLineType: '1',
        landscape: true,
        rows: 2,
        columns: 4
      }, {
        expectedPageCount: 8,
        expectedFirstPageImages: 4,
        expectedSecondPageImages: 4,
        expectedFaceOrder: '1,2,3,4',
        expectedBackOrder: '2,1,4,3',
      });
    });

    test('竖打', () => {
      testImageOrder(State, {
        ...Config,
        foldLineType: '0',
        landscape: false,
        rows: 2,
        columns: 3
      }, {
        expectedPageCount: 12,
        expectedFirstPageImages: 3,
        expectedSecondPageImages: 3,
        expectedFaceOrder: '1,2,3',
        expectedBackOrder: '1,2,3',
      });

      testImageOrder(State, {
        ...Config,
        foldLineType: '1',
        landscape: false,
        rows: 3,
        columns: 2
      }, {
        expectedPageCount: 12,
        expectedFirstPageImages: 3,
        expectedSecondPageImages: 3,
        expectedFaceOrder: '1,2,3',
        expectedBackOrder: '1,2,3',
      });
    });
  });

  describe('对贴(1张图)', () => {
    const State = {
      CardList: Array.from({ length: 1 }, (_, i) => createCard(i + 1)),
      globalBackground,
    };
    const Config = {
      sides: layoutSides.foldInHalf,
      cardWidth: 63,
      cardHeight: 88,
    };

    test('横打', () => {
      testImageOrder(State, {
        ...Config,
        foldLineType: '0',
        landscape: true,
        rows: 2,
        columns: 4
      }, {
        expectedPageCount: 2,
        expectedFirstPageImages: 1,
        expectedSecondPageImages: 1,
        expectedFaceOrder: '1',
        expectedBackOrder: '1,NaN,NaN,NaN',
      });

      testImageOrder(State, {
        ...Config,
        foldLineType: '1',
        landscape: true,
        rows: 2,
        columns: 4
      }, {
        expectedPageCount: 2,
        expectedFirstPageImages: 1,
        expectedSecondPageImages: 1,
        expectedFaceOrder: '1',
        expectedBackOrder: 'NaN,1,NaN,NaN',
      });
    });

    test('竖打', () => {
      testImageOrder(State, {
        ...Config,
        foldLineType: '0',
        landscape: false,
        rows: 2,
        columns: 3
      }, {
        expectedPageCount: 2,
        expectedFirstPageImages: 1,
        expectedSecondPageImages: 1,
        expectedFaceOrder: '1',
        expectedBackOrder: '1,NaN,NaN',
      });

      testImageOrder(State, {
        ...Config,
        foldLineType: '1',
        landscape: false,
        rows: 3,
        columns: 2
      }, {
        expectedPageCount: 2,
        expectedFirstPageImages: 1,
        expectedSecondPageImages: 1,
        expectedFaceOrder: '1',
        expectedBackOrder: '1,NaN,NaN',
      });
    });
  });

  describe('小册子', () => {
    const State = {
      CardList: Array.from({ length: 16 }, (_, i) => createCard(i + 1)),
      globalBackground,
    };
    const Config = {
      sides: layoutSides.brochure,
      cardWidth: 63,
      cardHeight: 88,
    };

    test('横打-长边为轴翻面', () => {
      testImageOrder(State, {
        ...Config,
        flip: flipWay.longEdgeBinding,
        landscape: true,
        rows: 2,
        columns: 2
      }, {
        expectedPageCount: 2,
        expectedFirstPageImages: 8,
        expectedSecondPageImages: 8,
        expectedFaceOrder: '16,1,14,3,12,5,10,7',
        expectedBackOrder: '11,6,9,8,15,2,13,4',
      });
    });

    test('横打-短边为轴翻面', () => {
      testImageOrder(State, {
        ...Config,
        flip: flipWay.shortEdgeBinding,
        landscape: true,
        rows: 2,
        columns: 2
      }, {
        expectedPageCount: 2,
        expectedFirstPageImages: 8,
        expectedSecondPageImages: 8,
        expectedFaceOrder: '16,1,14,3,12,5,10,7',
        expectedBackOrder: '4,13,2,15,8,9,6,11',
      });
    });

    test('竖打-长边为轴翻面', () => {
      testImageOrder(State, {
        ...Config,
        flip: flipWay.longEdgeBinding,
        landscape: true,
        rows: 3,
        columns: 1
      }, {
        expectedPageCount: 4,
        expectedFirstPageImages: 6,
        expectedSecondPageImages: 6,
        expectedFaceOrder: '16,1,14,3,12,5',
        expectedBackOrder: '11,6,13,4,15,2',
      });
    });

    test('横打-短边为轴翻面', () => {
      testImageOrder(State, {
        ...Config,
        flip: flipWay.shortEdgeBinding,
        landscape: true,
        rows: 3,
        columns: 1
      }, {
        expectedPageCount: 4,
        expectedFirstPageImages: 6,
        expectedSecondPageImages: 6,
        expectedFaceOrder: '16,1,14,3,12,5',
        expectedBackOrder: '2,15,4,13,6,11',
      });
    });
  });

  describe('小册子(两张图)', () => {
    const State = {
      CardList: Array.from({ length: 2 }, (_, i) => createCard(i + 1)),
      globalBackground,
    };
    const Config = {
      sides: layoutSides.brochure,
      cardWidth: 63,
      cardHeight: 88,
    };

    test('横打-长边为轴翻面', () => {
      testImageOrder(State, {
        ...Config,
        flip: flipWay.longEdgeBinding,
        landscape: true,
        rows: 2,
        columns: 2
      }, {
        expectedPageCount: 2,
        expectedFirstPageImages: 2,
        expectedSecondPageImages: 2,
        expectedFaceOrder: 'NaN,1',
        expectedBackOrder: 'NaN,NaN,NaN,NaN,NaN,2,NaN,NaN',
      });
    });

    test('横打-短边为轴翻面', () => {
      testImageOrder(State, {
        ...Config,
        flip: flipWay.shortEdgeBinding,
        landscape: true,
        rows: 2,
        columns: 2
      }, {
        expectedPageCount: 2,
        expectedFirstPageImages: 2,
        expectedSecondPageImages: 2,
        expectedFaceOrder: 'NaN,1',
        expectedBackOrder: 'NaN,NaN,2,NaN,NaN,NaN,NaN,NaN',
      });
    });

    test('竖打-长边为轴翻面', () => {
      testImageOrder(State, {
        ...Config,
        flip: flipWay.longEdgeBinding,
        landscape: true,
        rows: 3,
        columns: 1
      }, {
        expectedPageCount: 2,
        expectedFirstPageImages: 2,
        expectedSecondPageImages: 2,
        expectedFaceOrder: 'NaN,1',
        expectedBackOrder: 'NaN,NaN,NaN,NaN,NaN,2',
      });
    });

    test('横打-短边为轴翻面', () => {
      testImageOrder(State, {
        ...Config,
        flip: flipWay.shortEdgeBinding,
        landscape: true,
        rows: 3,
        columns: 1
      }, {
        expectedPageCount: 2,
        expectedFirstPageImages: 2,
        expectedSecondPageImages: 2,
        expectedFaceOrder: 'NaN,1',
        expectedBackOrder: '2,NaN,NaN,NaN,NaN,NaN',
      });
    });
  });
});

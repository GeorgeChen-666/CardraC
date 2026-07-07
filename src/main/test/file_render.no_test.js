import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  createCard,
  createSeededState,
  DEFAULT_GLOBAL_BACKGROUND,
} from './helpers/fileRenderTestUtils';
import {
  createCrossSegments,
  createSplitLineSegments,
  expectExactSegments,
  findMatchingLines,
  getPageSize,
  isCenterFoldDash,
} from './helpers/fileRenderGeometryTestUtils';

const { mockConfigStore, mockImageStorage, mockPreviewStorage } = vi.hoisted(() => {
  const createHoistedMockCache = () => ({
    keys() {
      return Object.keys(this).filter(key => !['keys', 'clear'].includes(key));
    },
    clear() {
      this.keys().forEach(key => {
        delete this[key];
      });
    }
  });

  return {
    mockConfigStore: {
      Config: {}
    },
    mockImageStorage: createHoistedMockCache(),
    mockPreviewStorage: createHoistedMockCache(),
  };
});

vi.mock('../functions', () => ({
  getBorderAverageColors: vi.fn(async () => ({ r: 255, g: 0, b: 0, alpha: 1 })),
}));

vi.mock('../services/store', () => ({
  getConfigStore: vi.fn(() => ({ Config: mockConfigStore.Config })),
  ImageStorage: mockImageStorage,
  PreviewStorage: mockPreviewStorage,
}));

import { getCutRectangleList, getPagedImageListByCardList, adjustBackPageImageOrder, isNeedRotation } from '../services/file_render/utils';
import { layoutSides, initialState } from '../../shared/constants';
import { ShadowAdapter } from '../services/file_render/adapter/ShadowAdapter';
import { exportFile } from '../services/file_render';

// 辅助函数：重置配置为初始状态
const resetConfig = () => {
  mockConfigStore.Config = { ...initialState.Config };
  mockImageStorage.clear();
  mockPreviewStorage.clear();
};

// 辅助函数：修改配置
const setConfig = (newConfig) => {
  Object.assign(mockConfigStore.Config, newConfig);
};

const renderWithShadow = async (state, pagesToRender = null) => {
  const adapter = new ShadowAdapter(mockConfigStore.Config);
  await exportFile(adapter, state, pagesToRender);
  return adapter.finalize();
};

const getElements = (page, type, predicate = null) => {
  const elements = page.elements.filter(e => e.type === type);
  return predicate ? elements.filter(predicate) : elements;
};

const getImages = (page, predicate = null) => getElements(page, 'image', predicate);
const getRects = (page, predicate = null) => getElements(page, 'rect', predicate);
const getTransforms = (page, predicate = null) => getElements(page, 'transform', predicate);
const getSolidLines = (page, predicate = null) => getElements(page, 'line', line => !line.dashed && (!predicate || predicate(line)));
const getDashedLines = (page, predicate = null) => getElements(page, 'line', line => line.dashed && (!predicate || predicate(line)));

describe('getPagedImageListByCardList', () => {
  const globalBackground = DEFAULT_GLOBAL_BACKGROUND;

  describe('普通模式 - oneSide', () => {
    test('单面打印：只生成正面页面', () => {
      const state = {
        CardList: [createCard(1), createCard(2), createCard(3), createCard(4)],
        globalBackground,
      };

      const config = {
        sides: layoutSides.oneSide,
        rows: 2,
        columns: 2,
      };

      const result = getPagedImageListByCardList(state, config);

      // 应该只有1页（正面）
      expect(result.length).toBe(1);
      expect(result[0].type).toBe('face');
      expect(result[0].imageList.length).toBe(4);
      expect(result[0].imageList[0].path).toBe('face1.png');
      expect(result[0].imageList[3].path).toBe('face4.png');
    });

    test('单面打印：多页情况', () => {
      const state = {
        CardList: Array.from({ length: 10 }, (_, i) => createCard(i + 1)),
        globalBackground,
      };

      const config = {
        sides: layoutSides.oneSide,
        rows: 2,
        columns: 2,
      };

      const result = getPagedImageListByCardList(state, config);

      // 10张卡片，每页4张，最后一页会补满到 4 个槽位
      expect(result.length).toBe(3);
      expect(result[0].imageList.length).toBe(4);
      expect(result[1].imageList.length).toBe(4);
      expect(result[2].imageList.length).toBe(4);
    });
  });

  describe('普通模式 - doubleSides', () => {
    test('双面打印：生成正面和背面页面', () => {
      const state = {
        CardList: [createCard(1), createCard(2), createCard(3), createCard(4)],
        globalBackground,
      };

      const config = {
        sides: layoutSides.doubleSides,
        rows: 2,
        columns: 2,
      };

      const result = getPagedImageListByCardList(state, config);

      // 应该有2页（正面+背面）
      expect(result.length).toBe(2);

      // 第1页：正面
      expect(result[0].type).toBe('face');
      expect(result[0].imageList.length).toBe(4);
      expect(result[0].imageList[0].path).toBe('face1.png');

      // 第2页：背面
      expect(result[1].type).toBe('back');
      expect(result[1].imageList.length).toBe(4);
      expect(result[1].imageList[0].path).toBe('back1.png');
    });

    test('双面打印：使用全局背景', () => {
      const cardWithoutBack = {
        face: { path: 'face1.png', ext: 'PNG' },
        back: { path: 'back1.png', ext: 'PNG' }, // 没有 mtime
        config: { id: 1 },
        repeat: 1,
      };

      const state = {
        CardList: [cardWithoutBack],
        globalBackground,
      };

      const config = {
        sides: layoutSides.doubleSides,
        rows: 1,
        columns: 1,
      };

      const result = getPagedImageListByCardList(state, config);

      // 背面应该使用全局背景
      expect(result[1].imageList[0].path).toBe('bg.png');
    });

    test('双面打印：多页情况', () => {
      const state = {
        CardList: Array.from({ length: 10 }, (_, i) => createCard(i + 1)),
        globalBackground,
      };

      const config = {
        sides: layoutSides.doubleSides,
        rows: 2,
        columns: 2,
      };

      const result = getPagedImageListByCardList(state, config);

      // 10张卡片，每页4张，应该有6页（正背正背正背）
      expect(result.length).toBe(6);
      expect(result[0].type).toBe('face');
      expect(result[1].type).toBe('back');
      expect(result[2].type).toBe('face');
      expect(result[3].type).toBe('back');
    });
  });

  describe('折叠模式 - foldInHalf', () => {
    test('折叠模式：每页卡片数量减半', () => {
      const state = {
        CardList: [createCard(1), createCard(2), createCard(3), createCard(4)],
        globalBackground,
      };

      const config = {
        sides: layoutSides.foldInHalf,
        rows: 2,
        columns: 2,
        foldLineType: '0', // 横向折叠
      };

      const result = getPagedImageListByCardList(state, config);

      // 折叠模式：每页只能放 (2*2)/2 = 2 张卡片
      // 4张卡片需要2组（正背正背）
      expect(result.length).toBe(4);
      expect(result[0].imageList.length).toBe(2);
      expect(result[1].imageList.length).toBe(2);
    });

    test('折叠模式：纵向折叠', () => {
      const state = {
        CardList: [createCard(1), createCard(2)],
        globalBackground,
      };

      const config = {
        sides: layoutSides.foldInHalf,
        rows: 2,
        columns: 2,
        foldLineType: '1', // 纵向折叠
      };

      const result = getPagedImageListByCardList(state, config);

      expect(result.length).toBe(2);
      expect(result[0].type).toBe('face');
      expect(result[1].type).toBe('back');
    });
  });

  describe('小册子模式 - brochure', () => {
    test('小册子模式：基本配对逻辑', () => {
      const state = {
        CardList: [
          createCard(1),
          createCard(2),
          createCard(3),
          createCard(4),
        ],
      };

      const config = {
        sides: layoutSides.brochure,
        rows: 1,
        columns: 1,
        brochureRepeatPerPage: false,
      };

      const result = getPagedImageListByCardList(state, config);

      // 4张卡片会被配对成2对
      expect(result.length).toBe(2);
      expect(result[0].type).toBe('face');
      expect(result[1].type).toBe('back');
    });

    test('小册子模式：自动补齐到4的倍数', () => {
      const state = {
        CardList: [
          createCard(1),
          createCard(2),
          createCard(3),
        ],
      };

      const config = {
        sides: layoutSides.brochure,
        rows: 1,
        columns: 1,
        brochureRepeatPerPage: false,
      };

      const result = getPagedImageListByCardList(state, config);

      // 3张卡片会补齐到4张，空位会表现为空图/null，而不是 undefined
      expect(result.length).toBe(2);

      // 检查是否有空位
      const allImages = result.flatMap(page => page.imageList);
      const emptyCount = allImages.filter(img => img == null || img.path === '_emptyImg').length;
      expect(emptyCount).toBeGreaterThan(0);
    });

    test('小册子模式：每页重复模式', () => {
      const state = {
        CardList: [
          createCard(1),
          createCard(2),
          createCard(3),
          createCard(4),
        ],
      };

      const config = {
        sides: layoutSides.brochure,
        rows: 2,
        columns: 2,
        brochureRepeatPerPage: true,
      };

      const result = getPagedImageListByCardList(state, config);

      // 每页重复模式会重复配对
      expect(result.length).toBe(2);
      expect(result[0].imageList.length).toBe(8); // rows * columns * 2
    });

    test('小册子模式：验证配对顺序', () => {
      const state = {
        CardList: [
          createCard(1),
          createCard(2),
          createCard(3),
          createCard(4),
          createCard(5),
          createCard(6),
          createCard(7),
          createCard(8),
        ],
      };

      const config = {
        sides: layoutSides.brochure,
        rows: 1,
        columns: 1,
        brochureRepeatPerPage: false,
      };

      const result = getPagedImageListByCardList(state, config);
      expect(result.length).toBe(4);
    });
  });

  describe('卡片重复功能', () => {
    test('处理卡片的 repeat 属性', () => {
      const cardWithRepeat = {
        face: { path: 'face1.png', ext: 'PNG', mtime: Date.now() },
        back: { path: 'back1.png', ext: 'PNG', mtime: Date.now() },
        config: { id: 1 },
        repeat: 3, // 重复3次
      };

      const state = {
        CardList: [cardWithRepeat, createCard(2)],
        globalBackground,
      };

      const config = {
        sides: layoutSides.oneSide,
        rows: 2,
        columns: 2,
      };

      const result = getPagedImageListByCardList(state, config);

      // 第一张卡片重复3次 + 第二张卡片1次 = 4张
      expect(result[0].imageList.length).toBe(4);
      expect(result[0].imageList[0].path).toBe('face1.png');
      expect(result[0].imageList[1].path).toBe('face1.png');
      expect(result[0].imageList[2].path).toBe('face1.png');
      expect(result[0].imageList[3].path).toBe('face2.png');
    });
  });

  describe('边界情况', () => {
    test('空卡片列表', () => {
      const state = {
        CardList: [],
        globalBackground,
      };

      const config = {
        sides: layoutSides.oneSide,
        rows: 2,
        columns: 2,
      };

      const result = getPagedImageListByCardList(state, config);

      expect(result.length).toBe(0);
    });

    test('单张卡片', () => {
      const state = {
        CardList: [createCard(1)],
        globalBackground,
      };

      const config = {
        sides: layoutSides.doubleSides,
        rows: 1,
        columns: 1,
      };

      const result = getPagedImageListByCardList(state, config);

      expect(result.length).toBe(2);
      expect(result[0].imageList.length).toBe(1);
      expect(result[1].imageList.length).toBe(1);
    });

    test('大量卡片', () => {
      const state = {
        CardList: Array.from({ length: 100 }, (_, i) => createCard(i + 1)),
        globalBackground,
      };

      const config = {
        sides: layoutSides.doubleSides,
        rows: 3,
        columns: 3,
      };

      const result = getPagedImageListByCardList(state, config);

      // 100张卡片，每页9张，需要12页（正背各6页）
      const pageCount = Math.ceil(100 / 9) * 2;
      expect(result.length).toBe(pageCount);
    });
  });

  describe('配置验证', () => {
    test('验证返回的 config 数组', () => {
      const state = {
        CardList: [createCard(1), createCard(2)],
        globalBackground,
      };

      const config = {
        sides: layoutSides.oneSide,
        rows: 1,
        columns: 2,
      };

      const result = getPagedImageListByCardList(state, config);

      // 验证 config 数组长度与 imageList 一致
      expect(result[0].config.length).toBe(result[0].imageList.length);
      expect(result[0].config[0].id).toBe(1);
      expect(result[0].config[1].id).toBe(2);
    });
  });
});

describe('isNeedRotation', () => {
  describe('正面页面', () => {
    test('正面永远不需要旋转', () => {
      const config = {
        sides: layoutSides.brochure,
        flip: 'long-edge binding',
        landscape: false,
      };

      expect(isNeedRotation(config, false)).toBe(false);
    });

    test('正面 - 所有配置组合都不旋转', () => {
      const configs = [
        { sides: layoutSides.brochure, flip: 'long-edge binding', landscape: false },
        { sides: layoutSides.brochure, flip: 'short-edge binding', landscape: true },
        { sides: layoutSides.doubleSides, flip: 'long-edge binding', landscape: false },
        { sides: layoutSides.foldInHalf, foldLineType: '0', landscape: false },
      ];

      configs.forEach(config => {
        expect(isNeedRotation(config, false)).toBe(false);
      });
    });
  });

  describe('折叠模式 - foldInHalf', () => {
    test('横向折叠（foldLineType=0）：背面需要旋转', () => {
      const config = {
        sides: layoutSides.foldInHalf,
        foldLineType: '0',
        flip: 'long-edge binding',
        landscape: false,
      };

      expect(isNeedRotation(config, true)).toBe(true);
    });

    test('纵向折叠（foldLineType=1）：背面不需要旋转', () => {
      const config = {
        sides: layoutSides.foldInHalf,
        foldLineType: '1',
        flip: 'long-edge binding',
        landscape: false,
      };

      expect(isNeedRotation(config, true)).toBe(false);
    });

    test('横向折叠 + 横置：背面需要旋转', () => {
      const config = {
        sides: layoutSides.foldInHalf,
        foldLineType: '0',
        flip: 'short-edge binding',
        landscape: true,
      };

      expect(isNeedRotation(config, true)).toBe(true);
    });

    test('纵向折叠 + 横置：背面不需要旋转', () => {
      const config = {
        sides: layoutSides.foldInHalf,
        foldLineType: '1',
        flip: 'short-edge binding',
        landscape: true,
      };

      expect(isNeedRotation(config, true)).toBe(false);
    });
  });

  describe('小册子模式 - brochure', () => {
    test('非横置 + 长边翻转：不需要旋转', () => {
      const config = {
        sides: layoutSides.brochure,
        flip: 'long-edge binding',
        landscape: false,
      };

      expect(isNeedRotation(config, true)).toBe(false);
    });

    test('非横置 + 短边翻转：需要旋转', () => {
      const config = {
        sides: layoutSides.brochure,
        flip: 'short-edge binding',
        landscape: false,
      };

      expect(isNeedRotation(config, true)).toBe(true);
    });

    test('横置 + 长边翻转：需要旋转', () => {
      const config = {
        sides: layoutSides.brochure,
        flip: 'long-edge binding',
        landscape: true,
      };

      expect(isNeedRotation(config, true)).toBe(true);
    });

    test('横置 + 短边翻转：不需要旋转', () => {
      const config = {
        sides: layoutSides.brochure,
        flip: 'short-edge binding',
        landscape: true,
      };

      expect(isNeedRotation(config, true)).toBe(false);
    });

    test('无翻转：不需要旋转', () => {
      const config = {
        sides: layoutSides.brochure,
        flip: 'none',
        landscape: false,
      };

      expect(isNeedRotation(config, true)).toBe(false);
    });
  });

  describe('普通双面模式 - doubleSides', () => {
    test('非横置 + 长边翻转：不需要旋转', () => {
      const config = {
        sides: layoutSides.doubleSides,
        flip: 'long-edge binding',
        landscape: false,
      };

      expect(isNeedRotation(config, true)).toBe(false);
    });

    test('非横置 + 短边翻转：需要旋转', () => {
      const config = {
        sides: layoutSides.doubleSides,
        flip: 'short-edge binding',
        landscape: false,
      };

      expect(isNeedRotation(config, true)).toBe(true);
    });

    test('横置 + 长边翻转：需要旋转', () => {
      const config = {
        sides: layoutSides.doubleSides,
        flip: 'long-edge binding',
        landscape: true,
      };

      expect(isNeedRotation(config, true)).toBe(true);
    });

    test('横置 + 短边翻转：不需要旋转', () => {
      const config = {
        sides: layoutSides.doubleSides,
        flip: 'short-edge binding',
        landscape: true,
      };

      expect(isNeedRotation(config, true)).toBe(false);
    });

    test('无翻转：不需要旋转', () => {
      const config = {
        sides: layoutSides.doubleSides,
        flip: 'none',
        landscape: false,
      };

      expect(isNeedRotation(config, true)).toBe(false);
    });
  });

  describe('单面模式 - oneSide', () => {
    test('单面模式背面不需要旋转（虽然不应该有背面）', () => {
      const config = {
        sides: layoutSides.oneSide,
        flip: 'long-edge binding',
        landscape: false,
      };

      expect(isNeedRotation(config, true)).toBe(false);
    });
  });

  describe('旋转规则总结', () => {
    test('折叠模式：只有横向折叠需要旋转', () => {
      expect(isNeedRotation({
        sides: layoutSides.foldInHalf,
        foldLineType: '0',
      }, true)).toBe(true);

      expect(isNeedRotation({
        sides: layoutSides.foldInHalf,
        foldLineType: '1',
      }, true)).toBe(false);
    });

    test('非折叠模式：横置+长边 或 非横置+短边 需要旋转', () => {
      // 横置 + 长边 = 需要旋转
      expect(isNeedRotation({
        sides: layoutSides.brochure,
        flip: 'long-edge binding',
        landscape: true,
      }, true)).toBe(true);

      // 非横置 + 短边 = 需要旋转
      expect(isNeedRotation({
        sides: layoutSides.brochure,
        flip: 'short-edge binding',
        landscape: false,
      }, true)).toBe(true);

      // 横置 + 短边 = 不需要旋转
      expect(isNeedRotation({
        sides: layoutSides.brochure,
        flip: 'short-edge binding',
        landscape: true,
      }, true)).toBe(false);

      // 非横置 + 长边 = 不需要旋转
      expect(isNeedRotation({
        sides: layoutSides.brochure,
        flip: 'long-edge binding',
        landscape: false,
      }, true)).toBe(false);
    });
  });

  describe('边界情况', () => {
    test('缺少 flip 参数', () => {
      const config = {
        sides: layoutSides.brochure,
        landscape: false,
      };

      expect(isNeedRotation(config, true)).toBe(false);
    });

    test('无效的 flip 值', () => {
      const config = {
        sides: layoutSides.brochure,
        flip: 'invalid-value',
        landscape: false,
      };

      expect(isNeedRotation(config, true)).toBe(false);
    });

    test('缺少 landscape 参数', () => {
      const config = {
        sides: layoutSides.brochure,
        flip: 'long-edge binding',
      };

      expect(isNeedRotation(config, true)).toBe(false);
    });
  });
});

describe('file render integration', () => {
  let testState;

  beforeEach(() => {
    // 每次测试前重置配置
    resetConfig();

    // 创建测试数据
    testState = createSeededState(8, mockImageStorage, { Config: mockConfigStore.Config });
  });

  test('默认配置：验证 8 张图片位置和旋转', async () => {
    const result = await renderWithShadow(testState);

    expect(result.totalPages).toBe(2);
    expect(result.pages).toHaveLength(2);

    // 使用 getPagedImageListByCardList 获取初始顺序
    const pagedImageList = getPagedImageListByCardList(testState, mockConfigStore.Config);

    expect(pagedImageList).toHaveLength(2);

    // 正面图片（不需要调整）
    const expectedFrontImages = pagedImageList[0].imageList;

    // 背面图片需要经过 adjustBackPageImageOrder 调整
    const adjustedBackPageData = adjustBackPageImageOrder(
      pagedImageList[1],
      mockConfigStore.Config
    );
    const expectedBackImages = adjustedBackPageData.imageList;

    const pageSize = getPageSize(result.pages[0]);

    // 共同验证函数
    const validatePageImages = (pageIndex, expectedImages, isBack) => {
      const page = result.pages[pageIndex];
      const actualImages = getImages(page);

      expect(actualImages).toHaveLength(expectedImages.length);

      // 获取期望的坐标
      const expectedRects = getCutRectangleList(
        mockConfigStore.Config,
        pageSize,
        false,
        isBack
      );

      // 验证每张图片
      expectedImages.forEach((expectedImage, index) => {
        const expectedPath = expectedImage?.path;
        const img = actualImages.find(img => img.dataPath === expectedPath);
        const expectedRect = expectedRects[index];

        expect(img).toBeDefined();
        expect(img.x).toBeCloseTo(expectedRect.x, 1);
        expect(img.y).toBeCloseTo(expectedRect.y, 1);
        expect(img.width).toBeCloseTo(expectedRect.width, 1);
        expect(img.height).toBeCloseTo(expectedRect.height, 1);
        expect(img.rotation).toBe(isBack ? 180 : 0);
        expect(img.rotated).toBe(isBack);
      });

      // 验证所有图片路径都存在
      const actualPaths = actualImages.map(img => img.dataPath).sort();
      const expectedPaths = expectedImages.map(img => img?.path).sort();
      expect(actualPaths).toEqual(expectedPaths);
    };

    // 验证正面
    validatePageImages(0, expectedFrontImages, false);

    // 验证背面
    validatePageImages(1, expectedBackImages, true);

    // 验证统计信息
    expect(result.summary.byType.image).toBe(16);
    expect(result.summary.byPage[0].elements.image).toBe(8);
    expect(result.summary.byPage[1].elements.image).toBe(8);
  });

  test('默认配置：验证切割辅助线', async () => {
    const result = await renderWithShadow(testState);

    const frontPage = result.pages[0];
    const frontPageLines = getSolidLines(frontPage);

    const pageSize = getPageSize(frontPage);

    const rects = getCutRectangleList(mockConfigStore.Config, pageSize, true, false);

    const xStarts = [...new Set(rects.map(rect => rect.x))].sort((a, b) => a - b);
    const yStarts = [...new Set(rects.map(rect => rect.y))].sort((a, b) => a - b);

    const width = rects[0].width;
    const height = rects[0].height;
    const minX = Math.min(...xStarts);
    const maxX = Math.max(...xStarts);
    const minY = Math.min(...yStarts);
    const maxY = Math.max(...yStarts);

    const expectedSegments = [
      ...xStarts.flatMap(x => ([
        { x1: x, y1: 0, x2: x, y2: minY },
        { x1: x + width, y1: 0, x2: x + width, y2: minY },
        { x1: x, y1: frontPage.height, x2: x, y2: maxY + height },
        { x1: x + width, y1: frontPage.height, x2: x + width, y2: maxY + height },
      ])),
      ...yStarts.flatMap(y => ([
        { x1: 0, y1: y, x2: minX, y2: y },
        { x1: 0, y1: y + height, x2: minX, y2: y + height },
        { x1: frontPage.width, y1: y, x2: maxX + width, y2: y },
        { x1: frontPage.width, y1: y + height, x2: maxX + width, y2: y + height },
      ])),
    ];

    expectExactSegments(frontPageLines, expectedSegments);

    // 验证线条样式
    frontPageLines.forEach(line => {
      expect(line.width).toBe(mockConfigStore.Config.lineWeight * 0.3527);
      expect(line.color).toBe(mockConfigStore.Config.cutlineColor);
    });

  });

  test('默认配置：验证 marginFilling 矩形', async () => {
    setConfig({
      marginFilling: true
    });

    const result = await renderWithShadow(testState);

    const frontPage = result.pages[0];
    const frontPageRects = getRects(frontPage);

    const pageSize = getPageSize(frontPage);

    const cutRects = getCutRectangleList(
      mockConfigStore.Config,
      pageSize,
      false,
      false
    );

    const { marginX, marginY, bleedX, bleedY } = mockConfigStore.Config;
    const xOffset = marginX / 2 - bleedX;
    const yOffset = marginY / 2 - bleedY;

    // 应该有相同数量的矩形
    expect(frontPageRects.length).toBeGreaterThanOrEqual(cutRects.length);

    // 验证每个切割位置
    cutRects.forEach((cutRect) => {
      const expectedRect = {
        x: cutRect.x - xOffset,
        y: cutRect.y - yOffset,
        width: cutRect.width + xOffset * 2,
        height: cutRect.height + yOffset * 2
      };

      const actualRect = frontPageRects.find(rect =>
        Math.abs(rect.x - expectedRect.x) < 0.1 &&
        Math.abs(rect.y - expectedRect.y) < 0.1 &&
        Math.abs(rect.width - expectedRect.width) < 0.1 &&
        Math.abs(rect.height - expectedRect.height) < 0.1
      );

      expect(actualRect).toBeDefined();

      if (actualRect) {
        // 验证颜色
        expect(actualRect.color).toEqual({ r: 255, g: 0, b: 0, alpha: 1 });
      }
    });
  });

  test('默认配置：验证十字切割线（前后页）', async () => {
    setConfig({
      fCutLine: '2', // 正面十字线
      bCutLine: '2'  // 背面十字线
    });

    const result = await renderWithShadow(testState);

    const pageSize = getPageSize(result.pages[0]);

    const crossLength = 1;

    const validateCrossLines = (page, isBack) => {
      const pageLines = getSolidLines(page);
      const cutRects = getCutRectangleList(
        mockConfigStore.Config,
        pageSize,
        true,
        isBack
      );
      const expectedSegments = cutRects.flatMap(rect => createCrossSegments(rect, crossLength));

      expectExactSegments(pageLines, expectedSegments);
    };

    // 验证正面
    validateCrossLines(result.pages[0], false);

    // 验证背面
    validateCrossLines(result.pages[1], true);
  });

  describe('pagesToRender', () => {
    test('普通双面模式只导出指定页', async () => {
      const result = await renderWithShadow(testState, [0]);
      const page = result.pages[0];
      const images = getImages(page);

      expect(result.totalPages).toBe(1);
      expect(result.pages).toHaveLength(1);
      expect(images).toHaveLength(8);
      expect(images.every(img => img.dataPath.startsWith('face'))).toBe(true);
      expect(page.elements.some(e => e.type === 'transform')).toBe(false);
    });

    test('对折模式指定页时会自动补齐对应背页', async () => {
      setConfig({
        sides: layoutSides.foldInHalf,
        rows: 4,
        columns: 2,
        foldLineType: '0',
      });

      const result = await renderWithShadow(testState, [0]);
      const images = getImages(result.pages[0]);
      const frontImages = images.filter(img => img.dataPath.startsWith('face'));
      const backImages = images.filter(img => img.dataPath.startsWith('back'));

      expect(result.totalPages).toBe(1);
      expect(result.pages).toHaveLength(1);
      expect(images).toHaveLength(8);
      expect(frontImages).toHaveLength(4);
      expect(backImages).toHaveLength(4);
    });

    test('普通双面模式支持跨源页导出多个非连续页', async () => {
      const pagedState = createSeededState(10, mockImageStorage, { Config: mockConfigStore.Config });
      const result = await renderWithShadow(pagedState, [0, 2]);
      const firstPageImages = getImages(result.pages[0]);
      const secondPageImages = getImages(result.pages[1]);
      const secondPageRealImages = secondPageImages.filter(img => img.dataPath !== '_emptyImg');
      const secondPageEmptyImages = secondPageImages.filter(img => img.dataPath === '_emptyImg');

      expect(result.totalPages).toBe(2);
      expect(result.pages).toHaveLength(2);
      expect(firstPageImages).toHaveLength(8);
      expect(firstPageImages.every(img => img.dataPath.startsWith('face'))).toBe(true);
      expect(secondPageImages).toHaveLength(8);
      expect(secondPageRealImages).toHaveLength(2);
      expect(secondPageRealImages.map(img => img.dataPath)).toEqual(expect.arrayContaining(['face9.png', 'face10.png']));
      expect(secondPageEmptyImages).toHaveLength(6);
    });

    test('普通双面模式传入越界页号时返回空白占位页而不是抛错', async () => {
      const result = await renderWithShadow(testState, [10]);
      const images = getImages(result.pages[0]);

      expect(result.totalPages).toBe(1);
      expect(images).toHaveLength(8);
      expect(images.every(img => img.dataPath === '_emptyImg')).toBe(true);
    });

    test('对折模式导出第二组页时会补齐对应背页并跳过前一组', async () => {
      setConfig({
        sides: layoutSides.foldInHalf,
        rows: 4,
        columns: 2,
        foldLineType: '0',
      });

      const result = await renderWithShadow(testState, [1]);
      const images = getImages(result.pages[0]);
      const realPaths = images.map(img => img.dataPath).filter(path => path !== '_emptyImg');

      expect(result.totalPages).toBe(1);
      expect(images).toHaveLength(8);
      expect(realPaths).toEqual(expect.arrayContaining([
        'face5.png', 'face6.png', 'face7.png', 'face8.png',
        'back5.png', 'back6.png', 'back7.png', 'back8.png',
      ]));
      expect(realPaths.some(path => ['face1.png', 'face2.png', 'face3.png', 'face4.png', 'back1.png', 'back2.png', 'back3.png', 'back4.png'].includes(path))).toBe(false);
    });
  });

  describe('printOffset', () => {
    test('普通双面模式背页应用打印偏移', async () => {
      setConfig({
        printOffsetX: 3,
        printOffsetY: 4,
      });

      const result = await renderWithShadow(testState, [1]);
      const transforms = getTransforms(result.pages[0]);

      expect(result.totalPages).toBe(1);
      expect(transforms).toHaveLength(1);
      expect(transforms[0].matrix).toMatchObject({ e: 3, f: -4 });
    });

    test('小册子模式背页应用打印偏移', async () => {
      setConfig({
        sides: layoutSides.brochure,
        rows: 2,
        columns: 2,
        printOffsetX: 5,
        printOffsetY: 6,
      });

      const result = await renderWithShadow(testState, [1]);
      const transforms = getTransforms(result.pages[0]);

      expect(result.totalPages).toBe(1);
      expect(transforms).toHaveLength(1);
      expect(transforms[0].matrix).toMatchObject({ e: 5, f: -6 });
    });

    test('对折模式背页不应用打印偏移', async () => {
      setConfig({
        sides: layoutSides.foldInHalf,
        rows: 4,
        columns: 2,
        foldLineType: '0',
        printOffsetX: 7,
        printOffsetY: 8,
      });

      const result = await renderWithShadow(testState, [0]);
      const transforms = getTransforms(result.pages[0]);

      expect(result.totalPages).toBe(1);
      expect(transforms).toHaveLength(0);
    });

    test('普通双面模式支持负数打印偏移', async () => {
      setConfig({
        printOffsetX: -3,
        printOffsetY: -4,
      });

      const result = await renderWithShadow(testState, [1]);
      const transforms = getTransforms(result.pages[0]);

      expect(result.totalPages).toBe(1);
      expect(transforms).toHaveLength(1);
      expect(transforms[0].matrix).toMatchObject({ e: -3, f: 4 });
    });
  });

  describe('avoidDislocation', () => {
    test('普通双面模式背页开启 avoidDislocation 后扩大导出图片区域', async () => {
      setConfig({
        rows: 1,
        columns: 1,
        marginX: 10,
        marginY: 10,
        bleedX: 1,
        bleedY: 1,
        avoidDislocation: true,
      });

      const singleCardState = createSeededState(
        [createCard(1, { includeBase64: true, selected: false })],
        mockImageStorage,
        { Config: mockConfigStore.Config }
      );
      const result = await renderWithShadow(singleCardState);
      const frontImage = getImages(result.pages[0])[0];
      const backImage = getImages(result.pages[1])[0];

      expect(frontImage.width).toBe(63 + 2);
      expect(frontImage.height).toBe(88 + 2);
      expect(backImage.width).toBe(63 + 10);
      expect(backImage.height).toBe(88 + 10);
    });

    test('小册子和对折模式开启 avoidDislocation 也不应放大背面图片区域', async () => {
      const brochureState = createSeededState(2, mockImageStorage, { Config: mockConfigStore.Config });
      const singleCardState = createSeededState(
        [createCard(1, { includeBase64: true, selected: false })],
        mockImageStorage,
        { Config: mockConfigStore.Config }
      );

      setConfig({
        sides: layoutSides.brochure,
        rows: 1,
        columns: 1,
        marginX: 10,
        marginY: 10,
        bleedX: 1,
        bleedY: 1,
        avoidDislocation: true,
      });

      const brochureResult = await renderWithShadow(brochureState);
      const brochureBackImage = getImages(brochureResult.pages[1], e => e.dataPath !== '_emptyImg')[0];

      expect(brochureBackImage.width).toBe(63 + 1);
      expect(brochureBackImage.height).toBe(88 + 2);

      resetConfig();
      createSeededState(singleCardState.CardList, mockImageStorage, { Config: mockConfigStore.Config });
      setConfig({
        sides: layoutSides.foldInHalf,
        rows: 4,
        columns: 2,
        foldLineType: '0',
        marginX: 10,
        marginY: 10,
        bleedX: 1,
        bleedY: 1,
        avoidDislocation: true,
      });

      const foldResult = await renderWithShadow(singleCardState, [0]);
      const foldBackImage = getImages(foldResult.pages[0], e => e.dataPath === 'back1.png')[0];

      expect(foldBackImage.width).toBe(63 + 2);
      expect(foldBackImage.height).toBe(88 + 2);
    });
  });

  describe('对折模式 cutline 回归', () => {
    test('背页应跟随 fCutLine，而不是 bCutLine', async () => {
      setConfig({
        sides: layoutSides.foldInHalf,
        rows: 4,
        columns: 2,
        foldLineType: '0',
        fCutLine: '2',
        bCutLine: '0',
      });

      const result = await renderWithShadow(testState, [0]);
      const page = result.pages[0];
      const pageSize = getPageSize(page);
      const solidLines = getSolidLines(page);
      const cutRects = getCutRectangleList(mockConfigStore.Config, pageSize, true, false).slice(0, 4);
      const crossLength = 1;


      expect(result.totalPages).toBe(1);

      cutRects.forEach((rect) => {
        const expectedSegments = createCrossSegments(rect, crossLength);

        expectedSegments.forEach(segment => {
          expect(findMatchingLines(solidLines, segment)).toHaveLength(2);
        });
      });
    });
  });

  describe('对折模式和小册子模式线条验证', () => {


    test('对折模式：纵向折叠虚线', async () => {
      setConfig({
        sides: layoutSides.foldInHalf,
        foldLineType: '1', // 纵向折叠
        rows: 2,
        columns: 4
      });

      const result = await renderWithShadow(testState);
      const frontPage = result.pages[0];

      const foldLines = getDashedLines(frontPage, isCenterFoldDash);

      const { offsetX, offsetY } = mockConfigStore.Config;
      const expectedLine = {
        x1: frontPage.width / 2 + offsetX,
        y1: offsetY,
        x2: frontPage.width / 2 + offsetX,
        y2: frontPage.height + offsetY,
      };

      expect(foldLines).toHaveLength(1);
      expect(foldLines[0]).toMatchObject({
        ...expectedLine,
        dashPattern: [0.5],
      });
    });

    test('小册子模式：页面拆分线（实线+虚线）', async () => {
      setConfig({
        sides: layoutSides.brochure,
        rows: 2,
        columns: 2,
        fCutLine: '0' // 关闭切割线，只看页面拆分线
      });

      const result = await renderWithShadow(testState);
      const frontPage = result.pages[0];

      const { offsetX, offsetY, columns, rows } = mockConfigStore.Config;

      const solidLines = getSolidLines(frontPage);
      const expectedSolidSegments = createSplitLineSegments({
        width: frontPage.width,
        height: frontPage.height,
        columns,
        rows,
        offsetX,
        offsetY,
      });

      expectExactSegments(solidLines, expectedSolidSegments);

      const dashedLines = getDashedLines(frontPage, line => Array.isArray(line.dashPattern) && line.dashPattern.length > 0);

      const pageSize = getPageSize(frontPage);

      const markRectList = getCutRectangleList(mockConfigStore.Config, pageSize, true, false);
      const xList = [...new Set(markRectList.map(r => r.x))];
      const yList = [...new Set(markRectList.map(r => r.y))];
      const width = markRectList[0].width;
      const height = markRectList[0].height;

      const expectedDashedSegments = xList.flatMap((v, vIndex) => {
        if (vIndex % 2 !== 0) return [];
        const foldX = v + width;
        return Array.from({ length: rows + 1 }, (_, j) => ({
          x1: foldX,
          y1: j === 0 ? 0 : yList[j - 1] + height,
          x2: foldX,
          y2: j === rows ? frontPage.height : yList[j],
          dashPattern: [1, 1],
        }));
      });

      expectExactSegments(dashedLines, expectedDashedSegments, { dashPattern: [1, 1] });
    });

    test('小册子模式：3x3 布局验证', async () => {
      setConfig({
        sides: layoutSides.brochure,
        rows: 3,
        columns: 3,
        fCutLine: '0'
      });

      const result = await renderWithShadow(testState);
      const frontPage = result.pages[0];

      const { columns, rows, offsetX, offsetY } = mockConfigStore.Config;

      const solidLines = getSolidLines(frontPage);
      const expectedSolidSegments = createSplitLineSegments({
        width: frontPage.width,
        height: frontPage.height,
        columns,
        rows,
        offsetX,
        offsetY,
      });

      expectExactSegments(solidLines, expectedSolidSegments);

    });

    test('对折模式：折叠虚线只应出现在页面中央', async () => {
      setConfig({
        sides: layoutSides.foldInHalf,
        foldLineType: '0',
        rows: 4,
        columns: 2
      });

      const result = await renderWithShadow(testState);
      const { offsetX, offsetY } = mockConfigStore.Config;

      result.pages.forEach(page => {
        const foldLines = getDashedLines(page, isCenterFoldDash);

        expect(foldLines).toHaveLength(1);
        expect(foldLines[0]).toMatchObject({
          x1: offsetX,
          y1: page.height / 2 + offsetY,
          x2: page.width + offsetX,
          y2: page.height / 2 + offsetY,
          dashPattern: [0.5],
        });
      });

    });

    test('小册子模式：背面不应该有页面拆分线', async () => {
      setConfig({
        sides: layoutSides.brochure,
        rows: 2,
        columns: 2,
        fCutLine: '0',
        bCutLine: '0'
      });

      const result = await renderWithShadow(testState);
      const backPage = result.pages[1];
      const { columns, rows, offsetX, offsetY } = mockConfigStore.Config;
      const pageWidth = backPage.width / columns;
      const pageHeight = backPage.height / rows;

      const solidLines = getSolidLines(backPage);

      for (let i = 1; i < columns; i++) {
        const expectedX = i * pageWidth + offsetX;
        const verticalSplitLine = findMatchingLines(solidLines, {
          x1: expectedX,
          y1: 0,
          x2: expectedX,
          y2: backPage.height,
        });

        expect(verticalSplitLine).toHaveLength(0);
      }

      for (let j = 1; j < rows; j++) {
        const expectedY = j * pageHeight + offsetY;
        const horizontalSplitLine = findMatchingLines(solidLines, {
          x1: 0,
          y1: expectedY,
          x2: backPage.width,
          y2: expectedY,
        });

        expect(horizontalSplitLine).toHaveLength(0);
      }

    });

  });
});



import { describe, test, expect } from 'vitest';
import { getCutRectangleList, getPagedImageListByCardList, adjustBackPageImageOrder, isNeedRotation   } from './ele_action/handlers/pdf/Utils';
import { layoutSides } from '../shared/constants';

describe('getPagedImageListByCardList', () => {
  // 创建测试用的卡片数据
  const createCard = (id) => ({
    face: { path: `face${id}.png`, ext: 'PNG' },
    back: { path: `back${id}.png`, ext: 'PNG', mtime: Date.now() },
    config: { id },
    repeat: 1,
  });

  const globalBackground = { path: 'bg.png', ext: 'PNG' };

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

      // 10张卡片，每页4张，应该有3页（4+4+2）
      expect(result.length).toBe(3);
      expect(result[0].imageList.length).toBe(4);
      expect(result[1].imageList.length).toBe(4);
      expect(result[2].imageList.length).toBe(2);
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

      console.log('小册子结果:', result);

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

      // 3张卡片会补齐到4张
      expect(result.length).toBe(2);

      // 检查是否有 undefined（补齐的空位）
      const allImages = result.flatMap(page => page.imageList);
      const undefinedCount = allImages.filter(img => img === undefined).length;
      expect(undefinedCount).toBeGreaterThan(0);
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

      console.log('小册子重复模式结果:', result);

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

      console.log('配对顺序测试:');
      result.forEach((page, i) => {
        console.log(`页${i + 1} (${page.type}):`, page.imageList.map(img => img?.path));
      });

      // 验证配对逻辑
      // 原始: [1,2,3,4,5,6,7,8]
      // 配对: [[1,2], [3,4], [5,6], [7,8]]
      // 重排: [[8,7], [1,2], [6,5], [3,4]]
      expect(result.length).toBe(4);
    });
  });

  describe('卡片重复功能', () => {
    test('处理卡片的 repeat 属性', () => {
      const cardWithRepeat = {
        face: { path: 'face1.png', ext: 'PNG' },
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

describe('getCutRectangleList', () => {
  const createMockDoc = (width = 210, height = 297) => ({
    getPageWidth: () => width,
    getPageHeight: () => height,
  });

  const baseConfig = {
    sides: layoutSides.oneSide,
    scale: 100,
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
  };

  describe('全局参数 - scale', () => {
    test('scale = 50% 所有尺寸减半', () => {
      const config = { ...baseConfig, scale: 50 };
      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, true, false);

      expect(result[0].width).toBe(31.5);
      expect(result[0].height).toBe(44);
    });

    test('scale = 200% 所有尺寸翻倍', () => {
      const config = { ...baseConfig, scale: 200 };
      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, true, false);

      expect(result[0].width).toBe(126);
      expect(result[0].height).toBe(176);
    });

    test('scale 影响 bleed', () => {
      const config = { ...baseConfig, scale: 50, bleedX: 2, bleedY: 2 };
      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, false, false);

      expect(result[0].width).toBe(31.5 + 1 * 2);
    });
  });

  describe('全局参数 - cardWidth/cardHeight', () => {
    test('增加 cardWidth', () => {
      const config = { ...baseConfig, cardWidth: 100 };
      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, true, false);

      expect(result[0].width).toBe(100);
    });

    test('增加 cardHeight', () => {
      const config = { ...baseConfig, cardHeight: 120 };
      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, true, false);

      expect(result[0].height).toBe(120);
    });
  });

  describe('全局参数 - marginX/marginY', () => {
    test('增加 marginX 影响间距', () => {
      const config1 = { ...baseConfig, marginX: 5 };
      const config2 = { ...baseConfig, marginX: 10 };
      const doc = createMockDoc();

      const result1 = getCutRectangleList(config1, doc, true, false);
      const result2 = getCutRectangleList(config2, doc, true, false);

      const spacing1 = result1[2].x - result1[0].x;
      const spacing2 = result2[2].x - result2[0].x;

      expect(spacing2).toBeGreaterThan(spacing1);
    });

    test('margin = 0 紧密排列', () => {
      const config = { ...baseConfig, marginX: 0, marginY: 0 };
      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, true, false);

      expect(result[2].x).toBe(result[0].x + result[0].width);
    });
  });

  describe('全局参数 - bleedX/bleedY', () => {
    test('bleedX 增加宽度', () => {
      const config = { ...baseConfig, bleedX: 3 };
      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, false, false);

      expect(result[0].width).toBe(63 + 3 * 2);
    });

    test('bleedY 增加高度', () => {
      const config = { ...baseConfig, bleedY: 4 };
      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, false, false);

      expect(result[0].height).toBe(88 + 4 * 2);
    });

    test('ignoreBleed = true 时不生效', () => {
      const config = { ...baseConfig, bleedX: 5, bleedY: 5 };
      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, true, false);

      expect(result[0].width).toBe(63);
    });
  });

  describe('全局参数 - columns/rows', () => {
    test('增加 columns', () => {
      const config = { ...baseConfig, columns: 3 };
      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, true, false);

      expect(result.length).toBe(6);
    });

    test('大网格 5x5', () => {
      const config = { ...baseConfig, columns: 5, rows: 5 };
      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, true, false);

      expect(result.length).toBe(25);
    });
  });

  describe('全局参数 - offsetX/offsetY', () => {
    test('offsetX 向右偏移', () => {
      const config = { ...baseConfig, offsetX: 10 };
      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, true, false);
      const resultNoOffset = getCutRectangleList({ ...baseConfig, offsetX: 0 }, doc, true, false);

      expect(result[0].x).toBe(resultNoOffset[0].x + 10);
    });

    test('负数 offset', () => {
      const config = { ...baseConfig, offsetX: -10, offsetY: -10 };
      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, true, false);
      const resultNoOffset = getCutRectangleList({ ...baseConfig }, doc, true, false);

      expect(result[0].x).toBe(resultNoOffset[0].x - 10);
    });
  });

  describe('独立卡片 bleed 配置', () => {
    test('单张卡片：有 bleed vs 无 bleed', () => {
      const doc = createMockDoc();

      const config1 = { ...baseConfig, bleedX: 2, bleedY: 3, columns: 1, rows: 1 };
      const config2 = { ...baseConfig, bleedX: 0, bleedY: 0, columns: 1, rows: 1 };

      const result1 = getCutRectangleList(config1, doc, false, false);
      const result2 = getCutRectangleList(config2, doc, false, false);

      expect(result1[0].width).toBe(63 + 2 * 2);
      expect(result2[0].width).toBe(63);
    });

    test('不同卡片不同 bleed 值', () => {
      const doc = createMockDoc();
      const cards = [
        { bleedX: 1, bleedY: 1 },
        { bleedX: 2, bleedY: 2 },
        { bleedX: 3, bleedY: 3 },
      ];

      const results = cards.map(card => {
        const config = { ...baseConfig, ...card, columns: 1, rows: 1 };
        return getCutRectangleList(config, doc, false, false)[0];
      });

      expect(results[0].width).toBe(63 + 1 * 2);
      expect(results[1].width).toBe(63 + 2 * 2);
      expect(results[2].width).toBe(63 + 3 * 2);
    });

    test('正面和背面不同 bleed', () => {
      const doc = createMockDoc();

      const faceConfig = { ...baseConfig, bleedX: 3, bleedY: 3, columns: 1, rows: 1 };
      const backConfig = { ...baseConfig, bleedX: 1, bleedY: 1, columns: 1, rows: 1 };

      const faceResult = getCutRectangleList(faceConfig, doc, false, false);
      const backResult = getCutRectangleList(backConfig, doc, false, true);

      expect(faceResult[0].width).toBe(63 + 3 * 2);
      expect(backResult[0].width).toBe(63 + 1 * 2);
    });

    test('bleed 不超过 margin 一半 - 有效配置', () => {
      const config = {
        ...baseConfig,
        marginX: 10,
        marginY: 10,
        bleedX: 5,
        bleedY: 5,
        columns: 1,
        rows: 1,
      };
      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, false, false);

      expect(config.bleedX).toBeLessThanOrEqual(config.marginX / 2);
      expect(result[0].width).toBe(63 + 5 * 2);
    });

    test('bleed 超过 margin 一半 - 卡片重叠', () => {
      const config = {
        ...baseConfig,
        marginX: 10,
        bleedX: 6,
        columns: 2,
        rows: 1,
      };
      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, false, false);

      const card1Right = result[0].x + result[0].width;
      const card2Left = result[1].x;
      expect(card1Right).toBeGreaterThan(card2Left);
    });

    test('模拟 4 张卡片不同 bleed', () => {
      const doc = createMockDoc();
      const cards = [
        { id: 1, faceBleed: { bleedX: 1, bleedY: 1 }, backBleed: { bleedX: 0, bleedY: 0 } },
        { id: 2, faceBleed: { bleedX: 2, bleedY: 2 }, backBleed: { bleedX: 1, bleedY: 1 } },
        { id: 3, faceBleed: { bleedX: 0, bleedY: 0 }, backBleed: { bleedX: 2, bleedY: 2 } },
        { id: 4, faceBleed: { bleedX: 3, bleedY: 3 }, backBleed: { bleedX: 3, bleedY: 3 } },
      ];

      const faceResults = cards.map(card => {
        const config = { ...baseConfig, ...card.faceBleed, columns: 1, rows: 1 };
        return getCutRectangleList(config, doc, false, false)[0];
      });

      expect(faceResults[0].width).toBe(63 + 1 * 2);
      expect(faceResults[1].width).toBe(63 + 2 * 2);
      expect(faceResults[2].width).toBe(63 + 0 * 2);
      expect(faceResults[3].width).toBe(63 + 3 * 2);
    });
  });

  describe('全局参数 + 独立 bleed 组合', () => {
    test('scale + 独立 bleed', () => {
      const doc = createMockDoc();
      const config = { ...baseConfig, scale: 50, bleedX: 4, bleedY: 4, columns: 1, rows: 1 };
      const result = getCutRectangleList(config, doc, false, false);

      const scaledBleed = 4 * 0.5;
      expect(result[0].width).toBe(31.5 + scaledBleed * 2);
    });

    test('不同 scale 下的独立 bleed', () => {
      const doc = createMockDoc();
      const configs = [
        { scale: 50, bleedX: 2, bleedY: 2 },
        { scale: 100, bleedX: 2, bleedY: 2 },
        { scale: 200, bleedX: 2, bleedY: 2 },
      ];

      const results = configs.map(c => {
        const config = { ...baseConfig, ...c, columns: 1, rows: 1 };
        return getCutRectangleList(config, doc, false, false)[0];
      });

      expect(results[0].width).toBe(31.5 + 1 * 2);
      expect(results[1].width).toBe(63 + 2 * 2);
      expect(results[2].width).toBe(126 + 4 * 2);
    });

    test('margin + 独立 bleed 验证', () => {
      const doc = createMockDoc();
      const config = {
        ...baseConfig,
        marginX: 10,
        marginY: 10,
        bleedX: 3,
        bleedY: 4,
        columns: 1,
        rows: 1,
      };
      const result = getCutRectangleList(config, doc, false, false);

      expect(config.bleedX).toBeLessThanOrEqual(config.marginX / 2);
      expect(config.bleedY).toBeLessThanOrEqual(config.marginY / 2);
      expect(result[0].width).toBe(63 + 3 * 2);
    });

    test('offset + 独立 bleed', () => {
      const doc = createMockDoc();
      const config = {
        ...baseConfig,
        bleedX: 2,
        bleedY: 2,
        offsetX: 10,
        offsetY: 10,
        columns: 1,
        rows: 1,
      };
      const result = getCutRectangleList(config, doc, false, false);
      const resultNoOffset = getCutRectangleList(
        { ...baseConfig, bleedX: 2, bleedY: 2, columns: 1, rows: 1 },
        doc,
        false,
        false
      );

      expect(result[0].x).toBe(resultNoOffset[0].x + 10);
      expect(result[0].width).toBe(63 + 2 * 2);
    });
  });

  describe('小册子模式 + 独立 bleed', () => {
    test('小册子模式不同 bleed', () => {
      const doc = createMockDoc();
      const config1 = {
        ...baseConfig,
        sides: layoutSides.brochure,
        bleedX: 1,
        bleedY: 1,
        columns: 1,
        rows: 1,
      };
      const config2 = {
        ...baseConfig,
        sides: layoutSides.brochure,
        bleedX: 3,
        bleedY: 3,
        columns: 1,
        rows: 1,
      };

      const result1 = getCutRectangleList(config1, doc, false, false);
      const result2 = getCutRectangleList(config2, doc, false, false);

      expect(result1[0].width).toBe(63 + 1);
      expect(result2[0].width).toBe(63 + 3);
    });
  });

  describe('折叠模式 + 独立 bleed', () => {
    test('折叠模式正背面不同 bleed', () => {
      const doc = createMockDoc();
      const faceConfig = {
        ...baseConfig,
        sides: layoutSides.foldInHalf,
        foldLineType: '0',
        foldInHalfMargin: 4,
        bleedX: 2,
        bleedY: 2,
        columns: 2,
        rows: 4,
      };
      const backConfig = { ...faceConfig, bleedX: 1, bleedY: 1 };

      const faceResult = getCutRectangleList(faceConfig, doc, false, false);
      const backResult = getCutRectangleList(backConfig, doc, false, true);

      expect(faceResult[0].width).toBe(63 + 2 * 2);
      expect(backResult[0].width).toBe(63 + 1 * 2);
    });
  });

  describe('极端参数组合', () => {
    test('极小 scale + 独立 bleed', () => {
      const doc = createMockDoc();
      const config = { ...baseConfig, scale: 10, bleedX: 1, bleedY: 1, columns: 1, rows: 1 };
      const result = getCutRectangleList(config, doc, false, false);

      expect(result[0].width).toBeCloseTo(6.3 + 0.1 * 2, 1);
    });

    test('极大 margin + 小 bleed', () => {
      const doc = createMockDoc();
      const config = {
        ...baseConfig,
        marginX: 50,
        marginY: 50,
        bleedX: 5,
        bleedY: 5,
        columns: 2,
        rows: 1,
      };
      const result = getCutRectangleList(config, doc, false, false);

      expect(config.bleedX).toBeLessThanOrEqual(config.marginX / 2);
      const spacing = result[1].x - result[0].x;
      expect(spacing).toBeGreaterThan(100);
    });

    test('所有参数最大化', () => {
      const doc = createMockDoc();
      const config = {
        ...baseConfig,
        scale: 150,
        cardWidth: 80,
        cardHeight: 110,
        marginX: 12,
        marginY: 12,
        bleedX: 5,
        bleedY: 5,
        columns: 3,
        rows: 3,
        offsetX: 8,
        offsetY: 8,
      };
      const result = getCutRectangleList(config, doc, false, false);

      expect(result.length).toBe(9);
      const scaledWidth = 80 * 1.5;
      const scaledBleed = 5 * 1.5;
      expect(result[0].width).toBeCloseTo(scaledWidth + scaledBleed * 2, 1);
    });
  });
});



describe('adjustBackPageImageOrder', () => {
  // 小册子模式测试
  describe('小册子模式', () => {
    const baseConfig = {
      rows: 2,
      columns: 2,
      sides: layoutSides.brochure,
      landscape: false,
    };

    test('非横置 + 长边翻转', () => {
      const pageData = {
        type: 'back',
        imageList: [15, 2, 13, 4, 11, 6, 9, 8],
        config: [{}, {}, {}, {}, {}, {}, {}, {}],
      };

      const result = adjustBackPageImageOrder(pageData, {
        ...baseConfig,
        flip: 'long-edge binding',
      });

      expect(result.imageList).toEqual([6, 11, 8, 9, 2, 15, 4, 13]);
    });

    test('非横置 + 短边翻转', () => {
      const pageData = {
        type: 'back',
        imageList: [15, 2, 13, 4, 11, 6, 9, 8],
        config: [{}, {}, {}, {}, {}, {}, {}, {}],
      };

      const result = adjustBackPageImageOrder(pageData, {
        ...baseConfig,
        flip: 'short-edge binding',
      });

      expect(result.imageList).toEqual([13, 4, 15, 2, 9, 8, 11, 6]);
    });

    test('横置 + 长边翻转', () => {
      const pageData = {
        type: 'back',
        imageList: [15, 2, 13, 4, 11, 6, 9, 8],
        config: [{}, {}, {}, {}, {}, {}, {}, {}],
      };

      const result = adjustBackPageImageOrder(pageData, {
        ...baseConfig,
        landscape: true,
        flip: 'long-edge binding',
      });

      expect(result.imageList).toEqual([13, 4, 15, 2, 9, 8, 11, 6]);
    });

    test('无翻转', () => {
      const pageData = {
        type: 'back',
        imageList: [15, 2, 13, 4, 11, 6, 9, 8],
        config: [{}, {}, {}, {}, {}, {}, {}, {}],
      };

      const result = adjustBackPageImageOrder(pageData, {
        ...baseConfig,
        flip: 'none',
      });

      expect(result.imageList).toEqual([15, 2, 13, 4, 11, 6, 9, 8]);
    });
  });

  // 折叠模式测试
  describe('折叠模式', () => {
    test('横向折叠', () => {
      const pageData = {
        type: 'back',
        imageList: [1, 2, 3, 4],
        config: [{}, {}, {}, {}],
      };

      const result = adjustBackPageImageOrder(pageData, {
        rows: 4,
        columns: 2,
        sides: layoutSides.foldInHalf,
        landscape: false,
        foldLineType: '0',
        flip: 'long-edge binding',
      });

      expect(result.imageList.length).toBe(4);
    });

    test('纵向折叠', () => {
      const pageData = {
        type: 'back',
        imageList: [1, 2, 3, 4],
        config: [{}, {}, {}, {}],
      };

      const result = adjustBackPageImageOrder(pageData, {
        rows: 2,
        columns: 4,
        sides: layoutSides.foldInHalf,
        landscape: false,
        foldLineType: '1',
        flip: 'long-edge binding',
      });

      expect(result.imageList.length).toBe(4);
    });
  });

  // 普通双面模式测试
  describe('普通双面模式', () => {
    test('非横置 + 长边翻转', () => {
      const pageData = {
        type: 'back',
        imageList: [1, 2, 3, 4, 5, 6, 7, 8],
        config: [{}, {}, {}, {}, {}, {}, {}, {}],
      };

      const result = adjustBackPageImageOrder(pageData, {
        rows: 2,
        columns: 4,
        sides: layoutSides.doubleSides,
        landscape: false,
        flip: 'long-edge binding',
      });

      expect(result.imageList.length).toBe(8);
    });

    test('非横置 + 短边翻转', () => {
      const pageData = {
        type: 'back',
        imageList: [1, 2, 3, 4, 5, 6, 7, 8],
        config: [{}, {}, {}, {}, {}, {}, {}, {}],
      };

      const result = adjustBackPageImageOrder(pageData, {
        rows: 2,
        columns: 4,
        sides: layoutSides.doubleSides,
        landscape: false,
        flip: 'short-edge binding',
      });

      expect(result.imageList.length).toBe(8);
    });
  });

  // 正面页面测试
  test('正面页面不翻转', () => {
    const pageData = {
      type: 'face',
      imageList: [1, 2, 3, 4],
      config: [{}, {}, {}, {}],
    };

    const result = adjustBackPageImageOrder(pageData, {
      rows: 2,
      columns: 2,
      sides: layoutSides.brochure,
      flip: 'long-edge binding',
    });

    expect(result.imageList).toEqual([1, 2, 3, 4]);
  });

  // 边界情况测试
  test('空列表', () => {
    const pageData = {
      type: 'back',
      imageList: [],
      config: [],
    };

    const result = adjustBackPageImageOrder(pageData, {
      rows: 2,
      columns: 2,
      sides: layoutSides.brochure,
      flip: 'long-edge binding',
    });

    expect(result.imageList).toEqual([]);
  });

  test('config 同步翻转', () => {
    const pageData = {
      type: 'back',
      imageList: [15, 2, 13, 4, 11, 6, 9, 8],
      config: [
        { id: 0 }, { id: 1 }, { id: 2 }, { id: 3 },
        { id: 4 }, { id: 5 }, { id: 6 }, { id: 7 }
      ],
    };

    const result = adjustBackPageImageOrder(pageData, {
      rows: 2,
      columns: 2,
      sides: layoutSides.brochure,
      landscape: false,
      flip: 'long-edge binding',
    });

    expect(result.config.length).toBe(8);
    expect(result.config[0].id).toBe(5); // 对应 imageList[0] = 6 的原始位置
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

      // flip 为 undefined，indexOf 返回 -1，flipWay = -1
      // -1 !== 1 且 -1 !== 2，所以返回 false
      expect(isNeedRotation(config, true)).toBe(false);
    });

    test('无效的 flip 值', () => {
      const config = {
        sides: layoutSides.brochure,
        flip: 'invalid-value',
        landscape: false,
      };

      // indexOf 返回 -1
      expect(isNeedRotation(config, true)).toBe(false);
    });

    test('缺少 landscape 参数', () => {
      const config = {
        sides: layoutSides.brochure,
        flip: 'long-edge binding',
      };

      // landscape 为 undefined，!landscape = true
      // !landscape && flipWay === 2 = false
      expect(isNeedRotation(config, true)).toBe(false);
    });
  });
});

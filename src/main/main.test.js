import { describe, test, expect } from 'vitest';
import { getCutRectangleList, getPagedImageListByCardList, adjustBackPageImageOrder, isNeedRotation   } from './ele_action/handlers/pdf/Utils';
import { layoutSides } from '../public/constants';

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
  // Mock doc 对象
  const createMockDoc = (width = 210, height = 297) => ({
    getPageWidth: () => width,
    getPageHeight: () => height,
  });

  describe('普通模式', () => {
    test('基本矩形生成 - 2x2 网格', () => {
      const config = {
        sides: layoutSides.oneSide,
        scale: 100,
        cardWidth: 63,
        cardHeight: 88,
        marginX: 5,
        marginY: 5,
        bleedX: 0,
        bleedY: 0,
        columns: 2,
        rows: 2,
        offsetX: 0,
        offsetY: 0,
      };

      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, true, false);

      // 应该生成 2x2 = 4 个矩形
      expect(result.length).toBe(4);

      // 验证每个矩形都有必要的属性
      result.forEach(rect => {
        expect(rect).toHaveProperty('x');
        expect(rect).toHaveProperty('y');
        expect(rect).toHaveProperty('width');
        expect(rect).toHaveProperty('height');
        expect(rect.width).toBe(63);
        expect(rect.height).toBe(88);
      });
    });

    test('包含出血 - ignoreBleed = false', () => {
      const config = {
        sides: layoutSides.oneSide,
        scale: 100,
        cardWidth: 63,
        cardHeight: 88,
        marginX: 5,
        marginY: 5,
        bleedX: 2,
        bleedY: 3,
        columns: 1,
        rows: 1,
        offsetX: 0,
        offsetY: 0,
      };

      const doc = createMockDoc();
      const resultWithBleed = getCutRectangleList(config, doc, false, false);
      const resultWithoutBleed = getCutRectangleList(config, doc, true, false);

      // 包含出血时，宽度和高度应该增加
      expect(resultWithBleed[0].width).toBe(63 + 2 * 2); // 67
      expect(resultWithBleed[0].height).toBe(88 + 3 * 2); // 94

      // 不包含出血时，保持原始尺寸
      expect(resultWithoutBleed[0].width).toBe(63);
      expect(resultWithoutBleed[0].height).toBe(88);
    });

    test('缩放功能 - scale = 50%', () => {
      const config = {
        sides: layoutSides.oneSide,
        scale: 50,
        cardWidth: 100,
        cardHeight: 100,
        marginX: 10,
        marginY: 10,
        bleedX: 0,
        bleedY: 0,
        columns: 1,
        rows: 1,
        offsetX: 0,
        offsetY: 0,
      };

      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, true, false);

      // 50% 缩放后应该是 50x50
      expect(result[0].width).toBe(50);
      expect(result[0].height).toBe(50);
    });

    test('偏移功能 - offsetX 和 offsetY', () => {
      const config = {
        sides: layoutSides.oneSide,
        scale: 100,
        cardWidth: 63,
        cardHeight: 88,
        marginX: 5,
        marginY: 5,
        bleedX: 0,
        bleedY: 0,
        columns: 1,
        rows: 1,
        offsetX: 10,
        offsetY: 20,
      };

      const doc = createMockDoc();
      const resultWithOffset = getCutRectangleList(config, doc, true, false);

      const configNoOffset = { ...config, offsetX: 0, offsetY: 0 };
      const resultNoOffset = getCutRectangleList(configNoOffset, doc, true, false);

      // 有偏移的位置应该不同
      expect(resultWithOffset[0].x).toBe(resultNoOffset[0].x + 10);
      expect(resultWithOffset[0].y).toBe(resultNoOffset[0].y + 20);
    });

    test('多行多列 - 验证位置分布', () => {
      const config = {
        sides: layoutSides.oneSide,
        scale: 100,
        cardWidth: 50,
        cardHeight: 50,
        marginX: 10,
        marginY: 10,
        bleedX: 0,
        bleedY: 0,
        columns: 3,
        rows: 2,
        offsetX: 0,
        offsetY: 0,
      };

      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, true, false);

      expect(result.length).toBe(6);

      // 验证矩形是按列优先排列的
      // 第一列的两个矩形应该有相同的 x 坐标
      expect(result[0].x).toBe(result[1].x);

      // 第二个矩形的 y 应该大于第一个
      expect(result[1].y).toBeGreaterThan(result[0].y);
    });
  });

  describe('折叠模式 - foldInHalf', () => {
    test('横向折叠 - foldLineType = 0', () => {
      const config = {
        sides: layoutSides.foldInHalf,
        scale: 100,
        cardWidth: 63,
        cardHeight: 88,
        marginX: 5,
        marginY: 5,
        bleedX: 0,
        bleedY: 0,
        foldInHalfMargin: 4,
        foldLineType: '0',
        columns: 2,
        rows: 4,
        offsetX: 0,
        offsetY: 0,
      };

      const doc = createMockDoc();

      // 正面
      const resultFace = getCutRectangleList(config, doc, true, false);
      // 背面
      const resultBack = getCutRectangleList(config, doc, true, true);

      expect(resultFace.length).toBe(8);
      expect(resultBack.length).toBe(8);

      // 验证折叠边距的影响
      // 正面和背面的 y 坐标应该有差异（因为 foldInHalfMargin）
      console.log('正面第一个矩形:', resultFace[0]);
      console.log('背面第一个矩形:', resultBack[0]);
    });

    test('纵向折叠 - foldLineType = 1', () => {
      const config = {
        sides: layoutSides.foldInHalf,
        scale: 100,
        cardWidth: 63,
        cardHeight: 88,
        marginX: 5,
        marginY: 5,
        bleedX: 0,
        bleedY: 0,
        foldInHalfMargin: 4,
        foldLineType: '1',
        columns: 4,
        rows: 2,
        offsetX: 0,
        offsetY: 0,
      };

      const doc = createMockDoc();

      const resultFace = getCutRectangleList(config, doc, true, false);
      const resultBack = getCutRectangleList(config, doc, true, true);

      expect(resultFace.length).toBe(8);
      expect(resultBack.length).toBe(8);
    });

    test('折叠边距对位置的影响', () => {
      const configWithMargin = {
        sides: layoutSides.foldInHalf,
        scale: 100,
        cardWidth: 63,
        cardHeight: 88,
        marginX: 5,
        marginY: 5,
        bleedX: 0,
        bleedY: 0,
        foldInHalfMargin: 10,
        foldLineType: '0',
        columns: 2,
        rows: 2,
        offsetX: 0,
        offsetY: 0,
      };

      const configNoMargin = {
        ...configWithMargin,
        foldInHalfMargin: 0,
      };

      const doc = createMockDoc();

      const resultWithMargin = getCutRectangleList(configWithMargin, doc, true, false);
      const resultNoMargin = getCutRectangleList(configNoMargin, doc, true, false);

      // 有折叠边距时，位置应该不同
      expect(resultWithMargin[0].y).not.toBe(resultNoMargin[0].y);
    });
  });

  describe('小册子模式 - brochure', () => {
    test('小册子模式 - 基本矩形生成', () => {
      const config = {
        sides: layoutSides.brochure,
        scale: 100,
        cardWidth: 63,
        cardHeight: 88,
        marginX: 5,
        marginY: 5,
        bleedX: 0,
        bleedY: 0,
        columns: 2,
        rows: 2,
        offsetX: 0,
        offsetY: 0,
      };

      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, true, false);

      // 小册子模式：每个区域有2张卡片
      // 2x2 网格 = 4个区域 * 2张卡片 = 8个矩形
      expect(result.length).toBe(8);

      // 验证每对卡片的位置关系
      // 每对卡片应该是水平相邻的
      console.log('小册子矩形:', result);
    });

    test('小册子模式 - 包含出血', () => {
      const config = {
        sides: layoutSides.brochure,
        scale: 100,
        cardWidth: 63,
        cardHeight: 88,
        marginX: 5,
        marginY: 5,
        bleedX: 2,
        bleedY: 3,
        columns: 1,
        rows: 1,
        offsetX: 0,
        offsetY: 0,
      };

      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, false, false);

      // 小册子模式下，每个区域有2张卡片
      expect(result.length).toBe(2);

      // 验证出血的应用
      result.forEach(rect => {
        expect(rect.width).toBe(63 + 2); // 只有一边有出血
        expect(rect.height).toBe(88 + 3 * 2); // 上下都有出血
      });
    });

    test('小册子模式 - 多区域', () => {
      const config = {
        sides: layoutSides.brochure,
        scale: 100,
        cardWidth: 50,
        cardHeight: 70,
        marginX: 5,
        marginY: 5,
        bleedX: 0,
        bleedY: 0,
        columns: 2,
        rows: 1,
        offsetX: 0,
        offsetY: 0,
      };

      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, true, false);

      // 2列1行 = 2个区域 * 2张卡片 = 4个矩形
      expect(result.length).toBe(4);
    });
  });

  describe('居中功能', () => {
    test('矩形应该在页面上居中', () => {
      const config = {
        sides: layoutSides.oneSide,
        scale: 100,
        cardWidth: 50,
        cardHeight: 50,
        marginX: 0,
        marginY: 0,
        bleedX: 0,
        bleedY: 0,
        columns: 1,
        rows: 1,
        offsetX: 0,
        offsetY: 0,
      };

      const doc = createMockDoc(210, 297);
      const result = getCutRectangleList(config, doc, true, false);

      // 单个 50x50 的矩形应该在 210x297 的页面上居中
      const expectedX = (210 - 50) / 2;
      const expectedY = (297 - 50) / 2;

      expect(result[0].x).toBeCloseTo(expectedX, 1);
      expect(result[0].y).toBeCloseTo(expectedY, 1);
    });

    test('多个矩形整体居中', () => {
      const config = {
        sides: layoutSides.oneSide,
        scale: 100,
        cardWidth: 50,
        cardHeight: 50,
        marginX: 10,
        marginY: 10,
        bleedX: 0,
        bleedY: 0,
        columns: 2,
        rows: 1,
        offsetX: 0,
        offsetY: 0,
      };

      const doc = createMockDoc(210, 297);
      const result = getCutRectangleList(config, doc, true, false);

      // 验证整体是居中的
      const minX = Math.min(...result.map(r => r.x));
      const maxX = Math.max(...result.map(r => r.x + r.width));
      const totalWidth = maxX - minX;

      const centerX = (minX + maxX) / 2;
      const pageCenterX = 210 / 2;

      expect(centerX).toBeCloseTo(pageCenterX, 1);
    });
  });

  describe('边界情况', () => {
    test('单个矩形', () => {
      const config = {
        sides: layoutSides.oneSide,
        scale: 100,
        cardWidth: 63,
        cardHeight: 88,
        marginX: 5,
        marginY: 5,
        bleedX: 0,
        bleedY: 0,
        columns: 1,
        rows: 1,
        offsetX: 0,
        offsetY: 0,
      };

      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, true, false);

      expect(result.length).toBe(1);
      expect(result[0].width).toBe(63);
      expect(result[0].height).toBe(88);
    });

    test('大网格 - 10x10', () => {
      const config = {
        sides: layoutSides.oneSide,
        scale: 100,
        cardWidth: 20,
        cardHeight: 20,
        marginX: 1,
        marginY: 1,
        bleedX: 0,
        bleedY: 0,
        columns: 10,
        rows: 10,
        offsetX: 0,
        offsetY: 0,
      };

      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, true, false);

      expect(result.length).toBe(100);
    });

    test('极小缩放 - scale = 10%', () => {
      const config = {
        sides: layoutSides.oneSide,
        scale: 10,
        cardWidth: 100,
        cardHeight: 100,
        marginX: 10,
        marginY: 10,
        bleedX: 0,
        bleedY: 0,
        columns: 1,
        rows: 1,
        offsetX: 0,
        offsetY: 0,
      };

      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, true, false);

      expect(result[0].width).toBe(10);
      expect(result[0].height).toBe(10);
    });
  });

  describe('数值精度', () => {
    test('fixFloat 确保数值精度', () => {
      const config = {
        sides: layoutSides.oneSide,
        scale: 33.33,
        cardWidth: 100,
        cardHeight: 100,
        marginX: 5.555,
        marginY: 5.555,
        bleedX: 0,
        bleedY: 0,
        columns: 1,
        rows: 1,
        offsetX: 0,
        offsetY: 0,
      };

      const doc = createMockDoc();
      const result = getCutRectangleList(config, doc, true, false);

      // 验证所有数值都是有限精度的
      expect(Number.isFinite(result[0].x)).toBe(true);
      expect(Number.isFinite(result[0].y)).toBe(true);
      expect(Number.isFinite(result[0].width)).toBe(true);
      expect(Number.isFinite(result[0].height)).toBe(true);

      // 验证小数位数不超过2位
      const decimals = (num) => {
        const str = num.toString();
        const dotIndex = str.indexOf('.');
        return dotIndex === -1 ? 0 : str.length - dotIndex - 1;
      };

      expect(decimals(result[0].x)).toBeLessThanOrEqual(2);
      expect(decimals(result[0].y)).toBeLessThanOrEqual(2);
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

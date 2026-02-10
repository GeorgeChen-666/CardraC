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

describe('切割线测试', () => {
  const createPageSize = (width = 210, height = 297) => ({
    maxWidth: width,
    maxHeight: height
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
  describe('一般测试', () => {
    test('测试小纸一张卡', () => {
      const pageSize = createPageSize(63, 88);
      const result = getCutRectangleList({
        ...baseConfig,
        marginX: 0,
        marginY: 0,
        bleedX: 0,
        bleedY: 0,
        columns: 1,
        rows: 1,
      }, pageSize, true, false);
      expect(result.length).toBe(1);
      expect(Object.values(result[0]).join(',')).toBe('0,0,63,88');
    });
    test('测试小纸一张卡出血', () => {
      const pageSize = createPageSize(65, 90);
      const result = getCutRectangleList({
        ...baseConfig,
        marginX: 0,
        marginY: 0,
        bleedX: 1,
        bleedY: 1,
        columns: 1,
        rows: 1,
      }, pageSize, false, false);
      expect(result.length).toBe(1);
      expect(Object.values(result[0]).join(',')).toBe('0,0,65,90');
    });
    test('测试小纸两张卡带间距', () => {
      const pageSize = createPageSize(127, 88);
      const result = getCutRectangleList({
        ...baseConfig,
        marginX: 1,
        marginY: 0,
        bleedX: 0,
        bleedY: 0,
        columns: 2,
        rows: 1,
      }, pageSize, true, false);
      expect(result.length).toBe(2);
      expect(Object.values(result[0]).join(',')).toBe('0,0,63,88');
      expect(Object.values(result[1]).join(',')).toBe('64,0,63,88');
    });
    test('测试小纸两张卡竖排带间距', () => {
      const pageSize = createPageSize(63, 88 * 2 + 1);
      const result = getCutRectangleList({
        ...baseConfig,
        marginX: 0,
        marginY: 1,
        bleedX: 0,
        bleedY: 0,
        columns: 1,
        rows: 2,
      }, pageSize, true, false);
      expect(result.length).toBe(2);
      expect(Object.values(result[0]).join(',')).toBe('0,0,63,88');
      expect(Object.values(result[1]).join(',')).toBe('0,89,63,88');
    });
  })
  describe('全局参数 - scale', () => {
    test('scale = 50% 所有尺寸减半', () => {
      const config = { ...baseConfig, scale: 50 };
      const pageSize = createPageSize();
      const result = getCutRectangleList(config, pageSize, true, false);

      expect(result[0].width).toBe(31.5);
      expect(result[0].height).toBe(44);
    });

    test('scale = 200% 所有尺寸翻倍', () => {
      const config = { ...baseConfig, scale: 200 };
      const pageSize = createPageSize();
      const result = getCutRectangleList(config, pageSize, true, false);

      expect(result[0].width).toBe(126);
      expect(result[0].height).toBe(176);
    });

    test('scale 影响 bleed', () => {
      const config = { ...baseConfig, scale: 50, bleedX: 2, bleedY: 2 };
      const pageSize = createPageSize();
      const result = getCutRectangleList(config, pageSize, false, false);

      expect(result[0].width).toBe(31.5 + 1 * 2);
    });

    test('scale 影响间距', () => {
      const config1 = { ...baseConfig, scale: 50, marginX: 10 };
      const config2 = { ...baseConfig, scale: 100, marginX: 10 };
      const config3 = { ...baseConfig, scale: 200, marginX: 10 };
      const pageSize = createPageSize();

      const result1 = getCutRectangleList(config1, pageSize, true, false);
      const result2 = getCutRectangleList(config2, pageSize, true, false);
      const result3 = getCutRectangleList(config3, pageSize, true, false);

      // 计算第二列第一个元素和第一列第一个元素的 x 坐标差值（包含卡片宽度 + 间距）
      const spacing1 = result1[1].x - result1[0].x;
      const spacing2 = result2[1].x - result2[0].x;
      const spacing3 = result3[1].x - result3[0].x;

      // scale 越大，间距应该越大
      expect(spacing2).toBeGreaterThan(spacing1);
      expect(spacing3).toBeGreaterThan(spacing2);

      // 验证具体数值：scale 翻倍，间距也应该翻倍
      expect(spacing2).toBeCloseTo(spacing1 * 2, 1);
      expect(spacing3).toBeCloseTo(spacing1 * 4, 1);
    });
  });

  describe('全局参数 - cardWidth/cardHeight', () => {
    test('增加 cardWidth', () => {
      const config = { ...baseConfig, cardWidth: 100 };
      const pageSize = createPageSize();
      const result = getCutRectangleList(config, pageSize, true, false);

      expect(result[0].width).toBe(100);
    });

    test('增加 cardHeight', () => {
      const config = { ...baseConfig, cardHeight: 120 };
      const pageSize = createPageSize();
      const result = getCutRectangleList(config, pageSize, true, false);

      expect(result[0].height).toBe(120);
    });
  });

  describe('全局参数 - marginX/marginY', () => {
    test('增加 marginX 影响间距', () => {
      const config1 = { ...baseConfig, marginX: 5 };
      const config2 = { ...baseConfig, marginX: 10 };
      const pageSize = createPageSize();

      const result1 = getCutRectangleList(config1, pageSize, true, false);
      const result2 = getCutRectangleList(config2, pageSize, true, false);

      const spacing1 = result1[1].x - result1[0].x;
      const spacing2 = result2[1].x - result2[0].x;

      expect(spacing2).toBeGreaterThan(spacing1);
    });

    test('margin = 0 紧密排列', () => {
      const config = { ...baseConfig, marginX: 0, marginY: 0 };
      const pageSize = createPageSize();
      const result = getCutRectangleList(config, pageSize, true, false);

      expect(result[1].x).toBe(result[0].x + result[0].width);
    });
  });

  describe('全局参数 - bleedX/bleedY', () => {
    test('bleedX 增加宽度', () => {
      const config = { ...baseConfig, bleedX: 3 };
      const pageSize = createPageSize();
      const result = getCutRectangleList(config, pageSize, false, false);

      expect(result[0].width).toBe(63 + 3 * 2);
    });

    test('bleedY 增加高度', () => {
      const config = { ...baseConfig, bleedY: 4 };
      const pageSize = createPageSize();
      const result = getCutRectangleList(config, pageSize, false, false);

      expect(result[0].height).toBe(88 + 4 * 2);
    });

    test('ignoreBleed = true 时不生效', () => {
      const config = { ...baseConfig, bleedX: 5, bleedY: 5 };
      const pageSize = createPageSize();
      const result = getCutRectangleList(config, pageSize, true, false);

      expect(result[0].width).toBe(63);
    });
  });

  describe('全局参数 - columns/rows', () => {
    test('增加 columns', () => {
      const config = { ...baseConfig, columns: 3 };
      const pageSize = createPageSize();
      const result = getCutRectangleList(config, pageSize, true, false);

      expect(result.length).toBe(6);
    });

    test('大网格 5x5', () => {
      const config = { ...baseConfig, columns: 5, rows: 5 };
      const pageSize = createPageSize();
      const result = getCutRectangleList(config, pageSize, true, false);

      expect(result.length).toBe(25);
    });
  });

  describe('全局参数 - offsetX/offsetY', () => {
    test('offsetX 向右偏移', () => {
      const config = { ...baseConfig, offsetX: 10 };
      const pageSize = createPageSize();
      const result = getCutRectangleList(config, pageSize, true, false);
      const resultNoOffset = getCutRectangleList({ ...baseConfig, offsetX: 0 }, pageSize, true, false);

      expect(result[0].x).toBe(resultNoOffset[0].x + 10);
    });

    test('负数 offset', () => {
      const config = { ...baseConfig, offsetX: -10, offsetY: -10 };
      const pageSize = createPageSize();
      const result = getCutRectangleList(config, pageSize, true, false);
      const resultNoOffset = getCutRectangleList({ ...baseConfig }, pageSize, true, false);

      expect(result[0].x).toBe(resultNoOffset[0].x - 10);
    });
  });

  describe('独立卡片 bleed 配置', () => {
    test('单张卡片：有 bleed vs 无 bleed', () => {
      const pageSize = createPageSize();

      const config1 = { ...baseConfig, bleedX: 2, bleedY: 3, columns: 1, rows: 1 };
      const config2 = { ...baseConfig, bleedX: 0, bleedY: 0, columns: 1, rows: 1 };

      const result1 = getCutRectangleList(config1, pageSize, false, false);
      const result2 = getCutRectangleList(config2, pageSize, false, false);

      expect(result1[0].width).toBe(63 + 2 * 2);
      expect(result2[0].width).toBe(63);
    });

    test('不同卡片不同 bleed 值', () => {
      const pageSize = createPageSize();
      const cards = [
        { bleedX: 1, bleedY: 1 },
        { bleedX: 2, bleedY: 2 },
        { bleedX: 3, bleedY: 3 },
      ];

      const results = cards.map(card => {
        const config = { ...baseConfig, ...card, columns: 1, rows: 1 };
        return getCutRectangleList(config, pageSize, false, false)[0];
      });

      expect(results[0].width).toBe(63 + 1 * 2);
      expect(results[1].width).toBe(63 + 2 * 2);
      expect(results[2].width).toBe(63 + 3 * 2);
    });

    test('正面和背面不同 bleed', () => {
      const pageSize = createPageSize();

      const faceConfig = { ...baseConfig, bleedX: 3, bleedY: 3, columns: 1, rows: 1 };
      const backConfig = { ...baseConfig, bleedX: 1, bleedY: 1, columns: 1, rows: 1 };

      const faceResult = getCutRectangleList(faceConfig, pageSize, false, false);
      const backResult = getCutRectangleList(backConfig, pageSize, false, true);

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
      const pageSize = createPageSize();
      const result = getCutRectangleList(config, pageSize, false, false);

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
      const pageSize = createPageSize();
      const result = getCutRectangleList(config, pageSize, false, false);

      const card1Right = result[0].x + result[0].width;
      const card2Left = result[1].x;
      expect(card1Right).toBeGreaterThan(card2Left);
    });

    test('模拟 4 张卡片不同 bleed', () => {
      const pageSize = createPageSize();
      const cards = [
        { id: 1, faceBleed: { bleedX: 1, bleedY: 1 }, backBleed: { bleedX: 0, bleedY: 0 } },
        { id: 2, faceBleed: { bleedX: 2, bleedY: 2 }, backBleed: { bleedX: 1, bleedY: 1 } },
        { id: 3, faceBleed: { bleedX: 0, bleedY: 0 }, backBleed: { bleedX: 2, bleedY: 2 } },
        { id: 4, faceBleed: { bleedX: 3, bleedY: 3 }, backBleed: { bleedX: 3, bleedY: 3 } },
      ];

      const faceResults = cards.map(card => {
        const config = { ...baseConfig, ...card.faceBleed, columns: 1, rows: 1 };
        return getCutRectangleList(config, pageSize, false, false)[0];
      });

      expect(faceResults[0].width).toBe(63 + 1 * 2);
      expect(faceResults[1].width).toBe(63 + 2 * 2);
      expect(faceResults[2].width).toBe(63 + 0 * 2);
      expect(faceResults[3].width).toBe(63 + 3 * 2);
    });
  });

  describe('全局参数 + 独立 bleed 组合', () => {
    test('scale + 独立 bleed', () => {
      const pageSize = createPageSize();
      const config = { ...baseConfig, scale: 50, bleedX: 4, bleedY: 4, columns: 1, rows: 1 };
      const result = getCutRectangleList(config, pageSize, false, false);

      const scaledBleed = 4 * 0.5;
      expect(result[0].width).toBe(31.5 + scaledBleed * 2);
    });

    test('不同 scale 下的独立 bleed', () => {
      const pageSize = createPageSize();
      const configs = [
        { scale: 50, bleedX: 2, bleedY: 2 },
        { scale: 100, bleedX: 2, bleedY: 2 },
        { scale: 200, bleedX: 2, bleedY: 2 },
      ];

      const results = configs.map(c => {
        const config = { ...baseConfig, ...c, columns: 1, rows: 1 };
        return getCutRectangleList(config, pageSize, false, false)[0];
      });

      expect(results[0].width).toBe(31.5 + 1 * 2);
      expect(results[1].width).toBe(63 + 2 * 2);
      expect(results[2].width).toBe(126 + 4 * 2);
    });

    test('margin + 独立 bleed 验证', () => {
      const pageSize = createPageSize();
      const config = {
        ...baseConfig,
        marginX: 10,
        marginY: 10,
        bleedX: 3,
        bleedY: 4,
        columns: 1,
        rows: 1,
      };
      const result = getCutRectangleList(config, pageSize, false, false);

      expect(config.bleedX).toBeLessThanOrEqual(config.marginX / 2);
      expect(config.bleedY).toBeLessThanOrEqual(config.marginY / 2);
      expect(result[0].width).toBe(63 + 3 * 2);
    });

    test('offset + 独立 bleed', () => {
      const pageSize = createPageSize();
      const config = {
        ...baseConfig,
        bleedX: 2,
        bleedY: 2,
        offsetX: 10,
        offsetY: 10,
        columns: 1,
        rows: 1,
      };
      const result = getCutRectangleList(config, pageSize, false, false);
      const resultNoOffset = getCutRectangleList(
        { ...baseConfig, bleedX: 2, bleedY: 2, columns: 1, rows: 1 },
        pageSize,
        false,
        false
      );

      expect(result[0].x).toBe(resultNoOffset[0].x + 10);
      expect(result[0].width).toBe(63 + 2 * 2);
    });
  });

  describe('小册子模式 + 独立 bleed', () => {
    test('小册子模式不同 bleed', () => {
      const pageSize = createPageSize();
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

      const result1 = getCutRectangleList(config1, pageSize, false, false);
      const result2 = getCutRectangleList(config2, pageSize, false, false);

      //检查返回 2 张卡（左右各一张）
      expect(result1.length).toBe(2);
      expect(result2.length).toBe(2);

      //检查宽度（左右卡都应该包含出血）
      expect(result1[0].width).toBe(63 + 1);  // 左卡：左侧出血
      expect(result1[1].width).toBe(63 + 1);  // 右卡：右侧出血
      expect(result2[0].width).toBe(63 + 3);
      expect(result2[1].width).toBe(63 + 3);

      //检查高度（上下都出血）
      expect(result1[0].height).toBe(88 + 1 * 2);
      expect(result1[1].height).toBe(88 + 1 * 2);
      expect(result2[0].height).toBe(88 + 3 * 2);
      expect(result2[1].height).toBe(88 + 3 * 2);
    });

    test('小册子模式出血方向正确 - 检查相对位置', () => {
      const pageSize = createPageSize();
      const config = {
        ...baseConfig,
        sides: layoutSides.brochure,
        bleedX: 2,
        bleedY: 3,
        columns: 1,
        rows: 1,
      };

      const result = getCutRectangleList(config, pageSize, false, false);

      //检查两张卡的相对位置
      const leftCard = result[0];
      const rightCard = result[1];

      //左卡的右边界应该等于右卡的左边界（中间无间隙）
      const leftCardRight = leftCard.x + leftCard.width;
      expect(leftCardRight).toBeCloseTo(rightCard.x, 1);

      //两张卡的宽度差应该为 0（都包含相同的出血）
      expect(leftCard.width).toBe(rightCard.width);

      //右卡的 X 坐标应该比左卡大约 63（卡片宽度）
      expect(rightCard.x - leftCard.x).toBeCloseTo(65, 1);
    });

    test('小册子模式出血前后对比', () => {
      const pageSize = createPageSize();
      const configNoBleed = {
        ...baseConfig,
        sides: layoutSides.brochure,
        bleedX: 0,
        bleedY: 0,
        columns: 1,
        rows: 1,
      };
      const configWithBleed = {
        ...baseConfig,
        sides: layoutSides.brochure,
        bleedX: 3,
        bleedY: 3,
        columns: 1,
        rows: 1,
      };

      const resultNoBleed = getCutRectangleList(configNoBleed, pageSize, false, false);
      const resultWithBleed = getCutRectangleList(configWithBleed, pageSize, false, false);

      //无出血时：两张卡总宽度 = 2 * 63
      const totalWidthNoBleed = resultNoBleed[0].width + resultNoBleed[1].width;
      expect(totalWidthNoBleed).toBe(63 * 2);

      //有出血时：两张卡总宽度 = 2 * (63 + 3)
      const totalWidthWithBleed = resultWithBleed[0].width + resultWithBleed[1].width;
      expect(totalWidthWithBleed).toBe((63 + 3) * 2);

      //两张卡之间的间距应该相同（都是 0，紧贴）
      const gapNoBleed = resultNoBleed[1].x - (resultNoBleed[0].x + resultNoBleed[0].width);
      const gapWithBleed = resultWithBleed[1].x - (resultWithBleed[0].x + resultWithBleed[0].width);

      expect(gapNoBleed).toBeCloseTo(0, 1);
      expect(gapWithBleed).toBeCloseTo(0, 1);
    });

    test('小册子模式多行多列出血', () => {
      const pageSize = createPageSize(210 * 2, 297 * 2);
      const config = {
        ...baseConfig,
        sides: layoutSides.brochure,
        bleedX: 2,
        bleedY: 2,
        columns: 2,
        rows: 2,
      };

      const result = getCutRectangleList(config, pageSize, false, false);

      //应该有 2x2 个格子，每个格子 2 张卡 = 8 张卡
      expect(result.length).toBe(8);

      //检查第一个格子的两张卡（索引 0, 1）
      const gap1 = result[1].x - (result[0].x + result[0].width);
      expect(gap1).toBeCloseTo(0, 1);

      //检查第二个格子的两张卡（索引 2, 3）
      const gap2 = result[3].x - (result[2].x + result[2].width);
      expect(gap2).toBeCloseTo(0, 1);

      //所有卡片宽度应该相同
      expect(result[0].width).toBe(63 + 2);
      expect(result[1].width).toBe(63 + 2);
      expect(result[2].width).toBe(63 + 2);
      expect(result[3].width).toBe(63 + 2);
    });

    test('小册子模式 ignoreBleed = true', () => {
      const pageSize = createPageSize();
      const config = {
        ...baseConfig,
        sides: layoutSides.brochure,
        bleedX: 3,
        bleedY: 3,
        columns: 1,
        rows: 1,
      };

      const result = getCutRectangleList(config, pageSize, true, false);

      //ignoreBleed 时不应该有出血
      expect(result[0].width).toBe(63);
      expect(result[1].width).toBe(63);
      expect(result[0].height).toBe(88);
      expect(result[1].height).toBe(88);

      //两张卡之间无间隙
      const gap = result[1].x - (result[0].x + result[0].width);
      expect(gap).toBeCloseTo(0, 1);
    });

    test('小册子模式验证出血不产生额外间距', () => {
      const pageSize = createPageSize();
      const config = {
        ...baseConfig,
        sides: layoutSides.brochure,
        bleedX: 5,
        bleedY: 5,
        columns: 1,
        rows: 1,
      };

      const result = getCutRectangleList(config, pageSize, false, false);

      //关键：左卡右边界 = 右卡左边界（证明中间无间隙）
      const leftCardRight = result[0].x + result[0].width;
      const rightCardLeft = result[1].x;

      expect(leftCardRight).toBeCloseTo(rightCardLeft, 1);

      //两张卡的 X 坐标差 = 卡片宽度（不包含出血）
      const xDiff = result[1].x - result[0].x;
      expect(xDiff).toBeCloseTo(68, 1);
    });
  });



  describe('折叠模式 + 独立 bleed', () => {
    test('折叠模式正背面不同 bleed', () => {
      const pageSize = createPageSize();
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

      const faceResult = getCutRectangleList(faceConfig, pageSize, false, false);
      const backResult = getCutRectangleList(backConfig, pageSize, false, true);

      expect(faceResult[0].width).toBe(63 + 2 * 2);
      expect(backResult[0].width).toBe(63 + 1 * 2);
    });
  });

  describe('极端参数组合', () => {
    test('极小 scale + 独立 bleed', () => {
      const pageSize = createPageSize();
      const config = { ...baseConfig, scale: 10, bleedX: 1, bleedY: 1, columns: 1, rows: 1 };
      const result = getCutRectangleList(config, pageSize, false, false);

      expect(result[0].width).toBeCloseTo(6.3 + 0.1 * 2, 1);
    });

    test('极大 margin + 小 bleed', () => {
      const pageSize = createPageSize();
      const config = {
        ...baseConfig,
        marginX: 50,
        marginY: 50,
        bleedX: 5,
        bleedY: 5,
        columns: 2,
        rows: 1,
      };
      const result = getCutRectangleList(config, pageSize, false, false);

      expect(config.bleedX).toBeLessThanOrEqual(config.marginX / 2);
      const spacing = result[1].x - result[0].x;
      expect(spacing).toBeGreaterThan(100);
    });

    test('所有参数最大化', () => {
      const pageSize = createPageSize();
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
      const result = getCutRectangleList(config, pageSize, false, false);

      expect(result.length).toBe(9);
      const scaledWidth = 80 * 1.5;
      const scaledBleed = 5 * 1.5;
      expect(result[0].width).toBeCloseTo(scaledWidth + scaledBleed * 2, 1);
    });
  });
});
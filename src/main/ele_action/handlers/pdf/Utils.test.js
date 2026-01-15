import { describe, expect, test, vi, beforeEach } from 'vitest';
import {
  fixFloat,
  getCutRectangleList,
  getPagedImageListByCardList,
  ImageStorage,
  defaultImageStorage
} from './Utils.js';

// Mock dependencies
vi.mock('../../functions', () => ({
  getConfigStore: vi.fn()
}));

vi.mock('../../../../public/constants', () => ({
  layoutSides: {
    oneSide: 'oneSide',
    doubleSides: 'doubleSides',
    foldInHalf: 'foldInHalf',
    brochure: 'brochure'
  }
}));

// Mock jsPDF
const mockDoc = {
  getPageWidth: vi.fn(() => 210),
  getPageHeight: vi.fn(() => 297)
};

describe('Utils.js', () => {

  describe('fixFloat', () => {
    test('should round to 2 decimal places', () => {
      expect(fixFloat(3.14159)).toBe(3.14);
      expect(fixFloat(2.999)).toBe(3.00);
      expect(fixFloat(1.006)).toBe(1.01);
    });

    test('should handle integers', () => {
      expect(fixFloat(5)).toBe(5.00);
      expect(fixFloat(0)).toBe(0.00);
    });

    test('should handle negative numbers', () => {
      expect(fixFloat(-2.567)).toBe(-2.57);
    });

    test('should handle very small numbers', () => {
      expect(fixFloat(0.001)).toBe(0.00);
      expect(fixFloat(0.006)).toBe(0.01);
    });

    test('should handle edge cases for rounding', () => {
      expect(fixFloat(1.004)).toBe(1.00); // 向下舍入
      expect(fixFloat(1.006)).toBe(1.01); // 向上舍入
      expect(fixFloat(2.995)).toBe(3.00); // 向上舍入
      expect(fixFloat(2.994)).toBe(2.99); // 向下舍入
    });
  });

  describe('ImageStorage', () => {
    test('should have default empty image', () => {
      expect(ImageStorage).toHaveProperty('_emptyImg');
      expect(ImageStorage._emptyImg).toContain('data:image/png;base64');
    });

    test('should be extensible', () => {
      ImageStorage.testImage = 'test-data';
      expect(ImageStorage.testImage).toBe('test-data');
      delete ImageStorage.testImage;
    });

    test('should contain default image storage', () => {
      expect(ImageStorage._emptyImg).toBe(defaultImageStorage._emptyImg);
    });
  });

  describe('getCutRectangleList - Enhanced Tests', () => {
    const baseConfig = {
      sides: 'oneSide',
      scale: 100,
      cardWidth: 85,
      cardHeight: 55,
      marginX: 10,
      marginY: 10,
      foldInHalfMargin: 5,
      columns: 2,
      rows: 2,
      bleedX: 2,
      bleedY: 2,
      foldLineType: '0',
      offsetX: 0,
      offsetY: 0
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe('Normal Mode Tests', () => {
      test('should generate correct number of rectangles for different grid sizes', () => {
        const testCases = [
          { rows: 1, columns: 1, expected: 1 },
          { rows: 2, columns: 2, expected: 4 },
          { rows: 3, columns: 3, expected: 9 },
          { rows: 1, columns: 5, expected: 5 },
          { rows: 5, columns: 1, expected: 5 }
        ];

        testCases.forEach(({ rows, columns, expected }) => {
          const config = { ...baseConfig, rows, columns };
          const result = getCutRectangleList(config, mockDoc, true, false);
          expect(result).toHaveLength(expected);
        });
      });

      test('should handle different scale values correctly', () => {
        const scales = [50, 100, 150, 200];
        const baseResult = getCutRectangleList(baseConfig, mockDoc, true, false);

        scales.forEach(scale => {
          const config = { ...baseConfig, scale };
          const result = getCutRectangleList(config, mockDoc, true, false);

          expect(result).toHaveLength(baseResult.length);

          if (scale !== 100) {
            // 不同缩放应该产生不同的尺寸
            expect(result[0].width).not.toBe(baseResult[0].width);
            expect(result[0].height).not.toBe(baseResult[0].height);
          }
        });
      });

      test('should apply margins correctly', () => {
        const marginConfigs = [
          { marginX: 0, marginY: 0 },
          { marginX: 5, marginY: 5 },
          { marginX: 20, marginY: 10 },
          { marginX: 10, marginY: 20 }
        ];

        marginConfigs.forEach(margins => {
          const config = { ...baseConfig, ...margins };
          const result = getCutRectangleList(config, mockDoc, true, false);

          expect(result).toHaveLength(4);
          expect(result[0]).toHaveProperty('x');
          expect(result[0]).toHaveProperty('y');
          expect(typeof result[0].x).toBe('number');
          expect(typeof result[0].y).toBe('number');
        });
      });

      test('should handle bleed parameters correctly', () => {
        const config = { ...baseConfig, bleedX: 5, bleedY: 3 };

        const withBleed = getCutRectangleList(config, mockDoc, false, false);
        const withoutBleed = getCutRectangleList(config, mockDoc, true, false);

        expect(withBleed[0].width).toBeGreaterThan(withoutBleed[0].width);
        expect(withBleed[0].height).toBeGreaterThan(withoutBleed[0].height);

        // 验证bleed的具体数值
        const expectedWidthDiff = 5 * 2; // bleedX * 2
        const expectedHeightDiff = 3 * 2; // bleedY * 2
        expect(withBleed[0].width - withoutBleed[0].width).toBe(expectedWidthDiff);
        expect(withBleed[0].height - withoutBleed[0].height).toBe(expectedHeightDiff);
      });

      test('should apply offset correctly', () => {
        const offsetConfigs = [
          { offsetX: 0, offsetY: 0 },
          { offsetX: 10, offsetY: 0 },
          { offsetX: 0, offsetY: 15 },
          { offsetX: -5, offsetY: -10 },
          { offsetX: 20, offsetY: 25 }
        ];

        const baseResult = getCutRectangleList(baseConfig, mockDoc, true, false);

        offsetConfigs.forEach(({ offsetX, offsetY }) => {
          const config = { ...baseConfig, offsetX, offsetY };
          const result = getCutRectangleList(config, mockDoc, true, false);

          if (offsetX !== 0 || offsetY !== 0) {
            expect(result[0].x).toBe(baseResult[0].x + offsetX);
            expect(result[0].y).toBe(baseResult[0].y + offsetY);
          }
        });
      });
    });

    describe('Fold In Half Mode Tests', () => {
      test('should handle horizontal fold (foldLineType: "0")', () => {
        const foldConfig = {
          ...baseConfig,
          sides: 'foldInHalf',
          foldLineType: '0',
          rows: 4,
          columns: 2
        };

        const frontResult = getCutRectangleList(foldConfig, mockDoc, true, false);
        const backResult = getCutRectangleList(foldConfig, mockDoc, true, true);

        // 折叠模式应该产生特定数量的矩形
        expect(frontResult.length).toBeGreaterThan(0);
        expect(backResult.length).toBeGreaterThan(0);

        // 正面和背面应该有相同数量的矩形
        expect(frontResult.length).toBe(backResult.length);

        // 检查是否有任何矩形的Y坐标不同
        const hasYDifference = frontResult.some((frontRect, index) =>
          frontRect.y !== backResult[index].y
        );
        expect(hasYDifference).toBe(true);
      });

      test('should handle vertical fold (foldLineType: "1")', () => {
        const foldConfig = {
          ...baseConfig,
          sides: 'foldInHalf',
          foldLineType: '1',
          rows: 2,
          columns: 4
        };

        const frontResult = getCutRectangleList(foldConfig, mockDoc, true, false);
        const backResult = getCutRectangleList(foldConfig, mockDoc, true, true);

        expect(frontResult.length).toBeGreaterThan(0);
        expect(backResult.length).toBeGreaterThan(0);
        expect(frontResult.length).toBe(backResult.length);

        // 检查是否有任何矩形的X坐标不同
        const hasXDifference = frontResult.some((frontRect, index) =>
          frontRect.x !== backResult[index].x
        );
        expect(hasXDifference).toBe(true);
      });

      test('should apply foldInHalfMargin correctly', () => {
        const marginValues = [0, 2, 5, 10];

        marginValues.forEach(foldInHalfMargin => {
          const config = {
            ...baseConfig,
            sides: 'foldInHalf',
            foldInHalfMargin,
            rows: 4
          };

          const result = getCutRectangleList(config, mockDoc, true, false);
          expect(result.length).toBeGreaterThan(0);
          expect(Array.isArray(result)).toBe(true);
        });
      });

      test('should handle different effective rows/columns in fold mode', () => {
        const testCases = [
          { rows: 2, columns: 2, foldLineType: '0' }, // 横向折叠
          { rows: 4, columns: 2, foldLineType: '0' },
          { rows: 2, columns: 4, foldLineType: '1' }, // 纵向折叠
          { rows: 2, columns: 6, foldLineType: '1' }
        ];

        testCases.forEach(({ rows, columns, foldLineType }) => {
          const config = {
            ...baseConfig,
            sides: 'foldInHalf',
            rows,
            columns,
            foldLineType
          };

          const frontResult = getCutRectangleList(config, mockDoc, true, false);
          const backResult = getCutRectangleList(config, mockDoc, true, true);

          expect(frontResult.length).toBeGreaterThan(0);
          expect(backResult.length).toBeGreaterThan(0);
          expect(frontResult.length).toBe(backResult.length);
        });
      });
    });

    describe('Edge Cases and Boundary Tests', () => {
      test('should handle zero dimensions', () => {
        const zeroConfigs = [
          { cardWidth: 0, cardHeight: 55 },
          { cardWidth: 85, cardHeight: 0 },
          { cardWidth: 0, cardHeight: 0 }
        ];

        zeroConfigs.forEach(dimensions => {
          const config = { ...baseConfig, ...dimensions };
          const result = getCutRectangleList(config, mockDoc, true, false);

          expect(result).toHaveLength(4);
          expect(Array.isArray(result)).toBe(true);
        });
      });

      test('should handle very large scale values', () => {
        const largeScales = [500, 1000, 2000];

        largeScales.forEach(scale => {
          const config = { ...baseConfig, scale };
          const result = getCutRectangleList(config, mockDoc, true, false);

          expect(result).toHaveLength(4);
          expect(result[0].width).toBeGreaterThan(0);
          expect(result[0].height).toBeGreaterThan(0);
        });
      });

      test('should handle very small scale values', () => {
        const smallScales = [1, 5, 10];

        smallScales.forEach(scale => {
          const config = { ...baseConfig, scale };
          const result = getCutRectangleList(config, mockDoc, true, false);

          expect(result).toHaveLength(4);
          expect(result[0].width).toBeGreaterThan(0);
          expect(result[0].height).toBeGreaterThan(0);
        });
      });

      test('should handle single cell grid', () => {
        const config = { ...baseConfig, rows: 1, columns: 1 };
        const result = getCutRectangleList(config, mockDoc, true, false);

        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('x');
        expect(result[0]).toHaveProperty('y');
        expect(result[0]).toHaveProperty('width');
        expect(result[0]).toHaveProperty('height');
      });
    });

    describe('Brochure Mode Tests', () => {
      test('should generate correct rectangles for brochure mode', () => {
        const brochureConfig = {
          ...baseConfig,
          sides: 'brochure',
          rows: 2,
          columns: 2
        };

        const result = getCutRectangleList(brochureConfig, mockDoc, true, false);

        // 小册子模式每个格子应该有2个矩形
        expect(result).toHaveLength(8); // 2x2x2
        expect(Array.isArray(result)).toBe(true);
      });

      test('should handle different grid sizes in brochure mode', () => {
        const testCases = [
          { rows: 1, columns: 1, expected: 2 },
          { rows: 1, columns: 2, expected: 4 },
          { rows: 2, columns: 1, expected: 4 },
          { rows: 3, columns: 3, expected: 18 }
        ];

        testCases.forEach(({ rows, columns, expected }) => {
          const config = { ...baseConfig, sides: 'brochure', rows, columns };
          const result = getCutRectangleList(config, mockDoc, true, false);
          expect(result).toHaveLength(expected);
        });
      });

      test('should apply bleed correctly in brochure mode', () => {
        const brochureConfig = {
          ...baseConfig,
          sides: 'brochure',
          bleedX: 3,
          bleedY: 4
        };

        const withBleed = getCutRectangleList(brochureConfig, mockDoc, false, false);
        const withoutBleed = getCutRectangleList(brochureConfig, mockDoc, true, false);

        expect(withBleed[0].width).toBeGreaterThan(withoutBleed[0].width);
        expect(withBleed[0].height).toBeGreaterThan(withoutBleed[0].height);
      });

      test('should handle brochure mode with different page dimensions', () => {
        const mockDocLarge = {
          getPageWidth: vi.fn(() => 420), // A3 width
          getPageHeight: vi.fn(() => 594)  // A3 height
        };

        const config = { ...baseConfig, sides: 'brochure' };
        const result = getCutRectangleList(config, mockDocLarge, true, false);

        expect(result).toHaveLength(8);
        expect(result[0].x).toBeGreaterThanOrEqual(0);
        expect(result[0].y).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Complex Parameter Combinations', () => {
      test('should handle fold mode with bleed and offset', () => {
        const complexConfig = {
          ...baseConfig,
          sides: 'foldInHalf',
          foldLineType: '0',
          rows: 4,
          bleedX: 3,
          bleedY: 2,
          offsetX: 5,
          offsetY: 10,
          foldInHalfMargin: 8
        };

        const frontWithBleed = getCutRectangleList(complexConfig, mockDoc, false, false);
        const frontWithoutBleed = getCutRectangleList(complexConfig, mockDoc, true, false);
        const backWithBleed = getCutRectangleList(complexConfig, mockDoc, false, true);

        expect(frontWithBleed.length).toBe(frontWithoutBleed.length);
        expect(frontWithBleed.length).toBe(backWithBleed.length);

        // 验证bleed效果
        expect(frontWithBleed[0].width).toBeGreaterThan(frontWithoutBleed[0].width);
        expect(frontWithBleed[0].height).toBeGreaterThan(frontWithoutBleed[0].height);
      });

      test('should handle extreme margin values', () => {
        const extremeConfigs = [
          { marginX: 0, marginY: 0 },
          { marginX: 100, marginY: 100 },
          { marginX: 1, marginY: 200 },
          { marginX: 200, marginY: 1 }
        ];

        extremeConfigs.forEach(margins => {
          const config = { ...baseConfig, ...margins };
          const result = getCutRectangleList(config, mockDoc, true, false);

          expect(result).toHaveLength(4);
          expect(Array.isArray(result)).toBe(true);
          result.forEach(rect => {
            expect(typeof rect.x).toBe('number');
            expect(typeof rect.y).toBe('number');
            expect(typeof rect.width).toBe('number');
            expect(typeof rect.height).toBe('number');
          });
        });
      });

      test('should handle all sides types with same parameters', () => {
        const sidesTypes = ['oneSide', 'doubleSides', 'foldInHalf', 'brochure'];
        const testConfig = {
          ...baseConfig,
          rows: 2,
          columns: 2,
          scale: 150,
          offsetX: 5,
          offsetY: 5
        };

        sidesTypes.forEach(sides => {
          const config = { ...testConfig, sides };
          const result = getCutRectangleList(config, mockDoc, true, false);

          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBeGreaterThan(0);
        });
      });
    });

    describe('Precision and Calculation Tests', () => {
      test('should return precise floating point values', () => {
        const config = {
          ...baseConfig,
          cardWidth: 85.333,
          cardHeight: 54.777,
          scale: 123.456
        };

        const result = getCutRectangleList(config, mockDoc, true, false);

        result.forEach(rect => {
          // 验证所有值都是有限的数字
          expect(Number.isFinite(rect.x)).toBe(true);
          expect(Number.isFinite(rect.y)).toBe(true);
          expect(Number.isFinite(rect.width)).toBe(true);
          expect(Number.isFinite(rect.height)).toBe(true);

          // 验证精度（应该是2位小数）
          expect(rect.x).toBe(fixFloat(rect.x));
          expect(rect.y).toBe(fixFloat(rect.y));
          expect(rect.width).toBe(fixFloat(rect.width));
          expect(rect.height).toBe(fixFloat(rect.height));
        });
      });

      test('should maintain consistent spacing between rectangles', () => {
        const config = { ...baseConfig, rows: 3, columns: 3 };
        const result = getCutRectangleList(config, mockDoc, true, false);

        // 验证水平间距一致性
        const horizontalSpacings = [];
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 2; j++) {
            const current = result[i * 3 + j];
            const next = result[i * 3 + j + 1];
            const spacing = next.x - (current.x + current.width);
            horizontalSpacings.push(spacing);
          }
        }

        // 所有水平间距应该相等
        const firstSpacing = horizontalSpacings[0];
        horizontalSpacings.forEach(spacing => {
          expect(Math.abs(spacing - firstSpacing)).toBeLessThan(0.01);
        });
      });
    });

    describe('Stress and Performance Tests', () => {
      test('should handle large grid sizes', () => {
        const largeGridConfig = {
          ...baseConfig,
          rows: 10,
          columns: 10
        };

        const result = getCutRectangleList(largeGridConfig, mockDoc, true, false);

        expect(result).toHaveLength(100);
        expect(Array.isArray(result)).toBe(true);

        // 验证所有矩形都有有效的属性
        result.forEach(rect => {
          expect(rect).toHaveProperty('x');
          expect(rect).toHaveProperty('y');
          expect(rect).toHaveProperty('width');
          expect(rect).toHaveProperty('height');
        });
      });

      test('should handle very small card dimensions', () => {
        const smallCardConfig = {
          ...baseConfig,
          cardWidth: 0.1,
          cardHeight: 0.1,
          scale: 10
        };

        const result = getCutRectangleList(smallCardConfig, mockDoc, true, false);

        expect(result).toHaveLength(4);
        result.forEach(rect => {
          expect(rect.width).toBeGreaterThan(0);
          expect(rect.height).toBeGreaterThan(0);
        });
      });

      test('should handle rapid successive calls', () => {
        const configs = Array(50).fill().map((_, i) => ({
          ...baseConfig,
          scale: 100 + i,
          offsetX: i,
          offsetY: i
        }));

        configs.forEach(config => {
          const result = getCutRectangleList(config, mockDoc, true, false);
          expect(result).toHaveLength(4);
        });
      });
    });

    describe('Integration and Consistency Tests', () => {
      test('should produce consistent results with same parameters', () => {
        const config = { ...baseConfig, scale: 125, offsetX: 7, offsetY: 13 };

        const result1 = getCutRectangleList(config, mockDoc, true, false);
        const result2 = getCutRectangleList(config, mockDoc, true, false);

        expect(result1).toEqual(result2);
      });

      test('should handle all foldLineType and isBack combinations', () => {
        const combinations = [
          { foldLineType: '0', isBack: false },
          { foldLineType: '0', isBack: true },
          { foldLineType: '1', isBack: false },
          { foldLineType: '1', isBack: true }
        ];

        combinations.forEach(({ foldLineType, isBack }) => {
          const config = {
            ...baseConfig,
            sides: 'foldInHalf',
            foldLineType,
            rows: 4,
            columns: 4
          };

          const result = getCutRectangleList(config, mockDoc, true, isBack);
          expect(result.length).toBeGreaterThan(0);
          expect(Array.isArray(result)).toBe(true);
        });
      });

      test('should validate rectangle properties are within page bounds', () => {
        const config = { ...baseConfig, rows: 2, columns: 2 };
        const result = getCutRectangleList(config, mockDoc, true, false);

        const pageWidth = mockDoc.getPageWidth();
        const pageHeight = mockDoc.getPageHeight();

        result.forEach(rect => {
          // 矩形应该在页面范围内（考虑到居中可能有负值）
          expect(rect.x + rect.width).toBeLessThanOrEqual(pageWidth + 50); // 允许一些容差
          expect(rect.y + rect.height).toBeLessThanOrEqual(pageHeight + 50);
          expect(rect.width).toBeGreaterThan(0);
          expect(rect.height).toBeGreaterThan(0);
        });
      });

      test('should handle mock document with different return values', () => {
        const mockDocSmall = {
          getPageWidth: vi.fn(() => 100),
          getPageHeight: vi.fn(() => 150)
        };

        const result = getCutRectangleList(baseConfig, mockDocSmall, true, false);

        expect(result).toHaveLength(4);
        expect(Array.isArray(result)).toBe(true);
      });
    });

  });


  describe('getPagedImageListByCardList', () => {
    const mockState = {
      CardList: [
        {
          face: { path: 'face1.jpg' },
          back: { path: 'back1.jpg', mtime: 123456 },
          repeat: 1,
          config: { bleed: { faceBleedX: 1, faceBleedY: 1 } }
        },
        {
          face: { path: 'face2.jpg' },
          back: { path: 'back2.jpg', mtime: 123456 },
          repeat: 1,
          config: { bleed: { faceBleedX: 1, faceBleedY: 1 } }
        }
      ],
      globalBackground: { path: 'bg.jpg' }
    };

    const mockConfig = {
      sides: 'oneSide',
      rows: 2,
      columns: 1
    };

    test('should generate pages for one-side layout', () => {
      const result = getPagedImageListByCardList(mockState, mockConfig);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('face');
      expect(result[0].imageList).toHaveLength(2);
      expect(result[0]).toHaveProperty('config');
    });

    test('should generate pages for double-sides layout', () => {
      const doubleSidesConfig = {
        ...mockConfig,
        sides: 'doubleSides'
      };

      const result = getPagedImageListByCardList(mockState, doubleSidesConfig);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('face');
      expect(result[1].type).toBe('back');
    });

    test('should handle fold in half layout', () => {
      const foldConfig = {
        ...mockConfig,
        sides: 'foldInHalf'
      };

      const result = getPagedImageListByCardList(mockState, foldConfig);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('face');
    });

    test('should handle brochure layout', () => {
      const brochureConfig = {
        ...mockConfig,
        sides: 'brochure',
        brochureRepeatPerPage: false
      };

      const result = getPagedImageListByCardList(mockState, brochureConfig);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('face');
    });

    test('should handle card repeat', () => {
      const stateWithRepeat = {
        ...mockState,
        CardList: [
          {
            face: { path: 'face1.jpg' },
            back: { path: 'back1.jpg', mtime: 123456 },
            repeat: 3,
            config: { bleed: { faceBleedX: 1, faceBleedY: 1 } }
          }
        ]
      };

      const result = getPagedImageListByCardList(stateWithRepeat, {
        sides: 'oneSide',
        rows: 2,
        columns: 2
      });

      expect(result[0].imageList).toHaveLength(3);
    });

    test('should use global background when card back has no mtime', () => {
      const stateWithoutBackMtime = {
        ...mockState,
        CardList: [
          {
            face: { path: 'face1.jpg' },
            back: { path: 'back1.jpg' }, // no mtime
            repeat: 1,
            config: { bleed: { faceBleedX: 1, faceBleedY: 1 } }
          }
        ]
      };

      const result = getPagedImageListByCardList(stateWithoutBackMtime, {
        sides: 'doubleSides',
        rows: 1,
        columns: 1
      });

      expect(result[1].imageList[0]).toBe(mockState.globalBackground);
    });
  });

  describe('Edge cases', () => {
    test('getCutRectangleList should handle zero dimensions', () => {
      const zeroConfig = {
        sides: 'oneSide',
        scale: 100,
        cardWidth: 0,
        cardHeight: 0,
        marginX: 10,
        marginY: 10,
        foldInHalfMargin: 5,
        columns: 1,
        rows: 1,
        bleedX: 0,
        bleedY: 0,
        foldLineType: '0',
        offsetX: 0,
        offsetY: 0
      };

      const result = getCutRectangleList(zeroConfig, mockDoc, true, false);
      expect(result).toHaveLength(1);
      expect(result[0].width).toBe(0);
      expect(result[0].height).toBe(0);
    });

    test('getPagedImageListByCardList should handle empty card list', () => {
      const emptyState = {
        CardList: [],
        globalBackground: { path: 'bg.jpg' }
      };

      const result = getPagedImageListByCardList(emptyState, {
        sides: 'oneSide',
        rows: 2,
        columns: 1
      });

      expect(result).toHaveLength(0);
    });

    test('should handle very large scale values', () => {
      const largeScaleConfig = {
        sides: 'oneSide',
        scale: 1000,
        cardWidth: 85,
        cardHeight: 55,
        marginX: 10,
        marginY: 10,
        foldInHalfMargin: 5,
        columns: 1,
        rows: 1,
        bleedX: 2,
        bleedY: 2,
        foldLineType: '0',
        offsetX: 0,
        offsetY: 0
      };

      const result = getCutRectangleList(largeScaleConfig, mockDoc, true, false);
      expect(result[0].width).toBe(850); // 85 * 10
      expect(result[0].height).toBe(550); // 55 * 10
    });
  });
});

import { describe, expect, test } from 'vitest';
import { adjustBackPageImageOrder, getPagedImageListByCardList } from '../services/file_render/utils';
import { flipWay } from '../../shared/constants';
import {
  createBrochureConfig,
  createDoubleSidesConfig,
  createFoldConfig,
  createPageData,
  createSnapshotExpectation,
  createState,
  expectPageSnapshot,
  range,
} from './helpers/fileRenderTestUtils';

describe('图序测试', () => {
  test('空列表会保留为空槽位结果', () => {
    const result = adjustBackPageImageOrder(
      createPageData({ type: 'back', imageList: [], config: [] }),
      createBrochureConfig({ flip: flipWay.longEdgeBinding })
    );

    expect(result.imageList.every(item => item === undefined)).toBe(true);
    expect(result.config.every(item => item === undefined)).toBe(true);
  });

  describe('双面', () => {
    const fullState = createState(16);

    test('正面页保持原顺序，并保留 padding/pathList/config', () => {
      const config = createDoubleSidesConfig();
      const pages = getPagedImageListByCardList(createState(2), config);
      expect(pages).toHaveLength(2);
      expect(pages[0].imageList).toHaveLength(8);

      expectPageSnapshot(adjustBackPageImageOrder(pages[0], config), createSnapshotExpectation({
        indices: range(0, 8),
        side: 'face',
        realCount: 2,
      }));
    });

    test.each([
      {
        title: '横打-长边为轴翻面',
        config: createDoubleSidesConfig(),
        faceIndices: range(0, 8),
        backIndices: [4, 5, 6, 7, 0, 1, 2, 3],
      },
      {
        title: '横打-短边为轴翻面',
        config: createDoubleSidesConfig({ flip: flipWay.shortEdgeBinding }),
        faceIndices: range(0, 8),
        backIndices: [3, 2, 1, 0, 7, 6, 5, 4],
      },
      {
        title: '竖打-长边为轴翻面',
        config: createDoubleSidesConfig({ landscape: false, rows: 3, columns: 3 }),
        faceIndices: range(0, 9),
        backIndices: [2, 1, 0, 5, 4, 3, 8, 7, 6],
      },
      {
        title: '竖打-短边为轴翻面',
        config: createDoubleSidesConfig({ flip: flipWay.shortEdgeBinding, landscape: false, rows: 3, columns: 3 }),
        faceIndices: range(0, 9),
        backIndices: [6, 7, 8, 3, 4, 5, 0, 1, 2],
      },
    ])('$title', ({ config, faceIndices, backIndices }) => {
      const pages = getPagedImageListByCardList(fullState, config);
      expect(pages).toHaveLength(4);

      expectPageSnapshot(adjustBackPageImageOrder(pages[0], config), createSnapshotExpectation({
        indices: faceIndices,
        side: 'face',
        realCount: 16,
      }));

      expectPageSnapshot(adjustBackPageImageOrder(pages[1], config), createSnapshotExpectation({
        indices: backIndices,
        side: 'back',
        realCount: 16,
      }));
    });

    test('partial page 会先补满槽位，再按翻面规则重排背面', () => {
      const config = createDoubleSidesConfig();
      const pages = getPagedImageListByCardList(createState(2), config);
      expect(pages).toHaveLength(2);
      expect(pages[1].imageList).toHaveLength(8);

      expectPageSnapshot(adjustBackPageImageOrder(pages[1], config), {
        images: [null, null, null, null, 1, 2, null, null],
        paths: ['4.back', '5.back', '6.back', '7.back', '0.back', '1.back', '2.back', '3.back'],
        configs: [null, null, null, null, 1, 2, null, null],
      });
    });
  });

  describe('对贴', () => {
    test('横向对折保持原列顺序', () => {
      const config = createFoldConfig();
      const pages = getPagedImageListByCardList(createState(4), config);
      expect(pages).toHaveLength(2);

      expectPageSnapshot(adjustBackPageImageOrder(pages[1], config), {
        images: [1, 2, 3, 4],
        paths: ['0.back', '1.back', '2.back', '3.back'],
        configs: [1, 2, 3, 4],
      });
    });

    test('纵向对折会在每一行内做镜像交换', () => {
      const config = createFoldConfig({ foldLineType: '1' });
      const pages = getPagedImageListByCardList(createState(4), config);
      expect(pages).toHaveLength(2);

      expectPageSnapshot(adjustBackPageImageOrder(pages[1], config), {
        images: [2, 1, 4, 3],
        paths: ['1.back', '0.back', '3.back', '2.back'],
        configs: [2, 1, 4, 3],
      });
    });

    test('partial page 同样会先补满半页槽位后再重排', () => {
      const config = createFoldConfig({ foldLineType: '1' });
      const pages = getPagedImageListByCardList(createState(1), config);
      expect(pages).toHaveLength(2);
      expect(pages[1].imageList).toHaveLength(4);

      expectPageSnapshot(adjustBackPageImageOrder(pages[1], config), {
        images: [null, 1, null, null],
        paths: ['1.back', '0.back', '3.back', '2.back'],
        configs: [null, 1, null, null],
      });
    });
  });

  describe('小册子', () => {
    const state = createState(16);

    test('横打-不翻面：背面保持分页函数生成的原顺序', () => {
      const config = createBrochureConfig();
      const pages = getPagedImageListByCardList(state, config);
      expect(pages).toHaveLength(2);

      expectPageSnapshot(adjustBackPageImageOrder(pages[0], config), {
        images: [16, 1, 14, 3, 12, 5, 10, 7],
        paths: ['15.face', '0.face', '13.face', '2.face', '11.face', '4.face', '9.face', '6.face'],
        configs: [16, 1, 14, 3, 12, 5, 10, 7],
      });

      expectPageSnapshot(adjustBackPageImageOrder(pages[1], config), {
        images: [15, 2, 13, 4, 11, 6, 9, 8],
        paths: ['14.back', '1.back', '12.back', '3.back', '10.back', '5.back', '8.back', '7.back'],
        configs: [15, 2, 13, 4, 11, 6, 9, 8],
      });
    });

    test('横打-长边为轴翻面：背面按行逆序', () => {
      const config = createBrochureConfig({ flip: flipWay.longEdgeBinding });
      const pages = getPagedImageListByCardList(state, config);

      expectPageSnapshot(adjustBackPageImageOrder(pages[1], config), {
        images: [11, 6, 9, 8, 15, 2, 13, 4],
        paths: ['10.back', '5.back', '8.back', '7.back', '14.back', '1.back', '12.back', '3.back'],
        configs: [11, 6, 9, 8, 15, 2, 13, 4],
      });
    });

    test('横打-短边为轴翻面：对内交换并反转列顺序', () => {
      const config = createBrochureConfig({ flip: flipWay.shortEdgeBinding });
      const pages = getPagedImageListByCardList(state, config);

      expectPageSnapshot(adjustBackPageImageOrder(pages[1], config), {
        images: [4, 13, 2, 15, 8, 9, 6, 11],
        paths: ['3.back', '12.back', '1.back', '14.back', '7.back', '8.back', '5.back', '10.back'],
        configs: [4, 13, 2, 15, 8, 9, 6, 11],
      });
    });

    test('竖打-长边为轴翻面：走 reversePairsAndColumns 分支', () => {
      const config = createBrochureConfig({ flip: flipWay.longEdgeBinding, landscape: false, rows: 3, columns: 1 });
      const pages = getPagedImageListByCardList(state, config);
      expect(pages).toHaveLength(4);

      expectPageSnapshot(adjustBackPageImageOrder(pages[0], config), {
        images: [16, 1, 14, 3, 12, 5],
        paths: ['15.face', '0.face', '13.face', '2.face', '11.face', '4.face'],
        configs: [16, 1, 14, 3, 12, 5],
      });

      expectPageSnapshot(adjustBackPageImageOrder(pages[1], config), {
        images: [2, 15, 4, 13, 6, 11],
        paths: ['1.back', '14.back', '3.back', '12.back', '5.back', '10.back'],
        configs: [2, 15, 4, 13, 6, 11],
      });
    });

    test('竖打-短边为轴翻面：走 reverseRows 分支', () => {
      const config = createBrochureConfig({ flip: flipWay.shortEdgeBinding, landscape: false, rows: 3, columns: 1 });
      const pages = getPagedImageListByCardList(state, config);

      expectPageSnapshot(adjustBackPageImageOrder(pages[1], config), {
        images: [11, 6, 13, 4, 15, 2],
        paths: ['10.back', '5.back', '12.back', '3.back', '14.back', '1.back'],
        configs: [11, 6, 13, 4, 15, 2],
      });
    });

    test('brochureRepeatPerPage 会复制同一组小册子配对以铺满整页', () => {
      const config = createBrochureConfig({ columns: 1, brochureRepeatPerPage: true });
      const pages = getPagedImageListByCardList(createState(4), config);
      expect(pages).toHaveLength(2);

      expectPageSnapshot(adjustBackPageImageOrder(pages[0], config), {
        images: [4, 1, 4, 1],
        paths: ['3.face', '0.face', '3.face', '0.face'],
        configs: [4, 1, 4, 1],
      });

      expectPageSnapshot(adjustBackPageImageOrder(pages[1], config), {
        images: [3, 2, 3, 2],
        paths: ['2.back', '1.back', '2.back', '1.back'],
        configs: [3, 2, 3, 2],
      });
    });
  });
});

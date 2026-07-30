// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import zhLocale from '../../../../main/locales/zh.json';
import { layoutSides } from '../../../../shared/constants';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../../setup/rendererCaseBootstrap';
import { createOpenImageResult, createOpenMultiImageResult, getNumericImagePath } from '../../../../../e2e/fixtures/images/numericImageFixtures';
import { useGlobalStore } from '../../../state/store';

describe('卡牌列表图片填充', () => {
  const { cardEditor: t } = zhLocale;

  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  const renderCardList = async (options = {}) => {
    bootstrapRendererCase({ currentView: 'edit', ...options });
    const { CardList } = await import('../../../parts/edit/CardList');
    renderRendererCase(<CardList />);
    return userEvent.setup();
  };

  const normalizePath = (value) => value.replace(/\\/g, '/');

  const getFirstCard = () => screen.getAllByRole('button', { name: t.btnRemove })[0].closest('.Card');

  test('应支持填充单张卡面图片', async () => {
    const facePath = getNumericImagePath(1);
    const user = await renderCardList({
      mocks: {
        functions: {
          openImage: async () => createOpenImageResult(1),
        },
      },
    });

    await user.click(await screen.findByTestId('card-menu-button-0'));
    await user.click(await screen.findByRole('menuitem', { name: t.face }));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList[0].face?.path).toBe(facePath);
    });
    const firstCard = getFirstCard();
    expect(normalizePath(within(firstCard).getByTestId('card-face-image').getAttribute('src'))).toContain(normalizePath(facePath));
  });

  test('应支持填充单张卡背图片', async () => {
    const backPath = getNumericImagePath(2);
    const user = await renderCardList({
      mocks: {
        functions: {
          openImage: async () => createOpenImageResult(2),
        },
      },
    });

    await user.click(await screen.findByTestId('card-menu-button-0'));
    await user.click(await screen.findByRole('menuitem', { name: t.back }));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList[0].back?.path).toBe(backPath);
    });
    const firstCard = getFirstCard();
    expect(normalizePath(within(firstCard).getByTestId('card-back-image').getAttribute('src'))).toContain(normalizePath(backPath));
  });

  test('应支持使用数字图片进行多图填充', async () => {
    const expectedPaths = [getNumericImagePath(3), getNumericImagePath(4), getNumericImagePath(5)];
    const user = await renderCardList({
      mocks: {
        functions: {
          openMultiImage: async () => createOpenMultiImageResult(3, 4, 5),
        },
      },
    });

    await user.click(await screen.findByTestId('add-card-image-button'));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList).toHaveLength(4);
    });
    expect(useGlobalStore.getState().CardList.slice(1).map((card) => card.face?.path)).toEqual(expectedPaths);
    expect(useGlobalStore.getState().CardList.every((card) => card.repeat === 1)).toBe(true);
  });

  test('双面模式下添加图片应同时填充卡面和卡背', async () => {
    const user = await renderCardList({
      state: {
        Config: {
          sides: layoutSides.doubleSides,
        },
      },
      mocks: {
        functions: {
          openMultiImage: async () => [{
            face: { path: getNumericImagePath(12), mtime: 1700000000012, ext: 'png' },
            back: { path: getNumericImagePath(13), mtime: 1700000000013, ext: 'png' },
          }],
        },
      },
    });

    await user.click(await screen.findByTestId('add-card-image-button'));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList).toHaveLength(2);
    });
    expect(useGlobalStore.getState().CardList[1].face?.path).toBe(getNumericImagePath(12));
    expect(useGlobalStore.getState().CardList[1].back?.path).toBe(getNumericImagePath(13));
  });

  test('应支持清除单张卡面的图片', async () => {
    const user = await renderCardList({
      state: {
        CardList: [{
          id: 'card-1',
          face: { path: getNumericImagePath(6), mtime: 1700000000006, ext: 'png' },
          back: { path: getNumericImagePath(7), mtime: 1700000000007, ext: 'png' },
          repeat: 1,
        }],
      },
    });

    await user.click(await screen.findByTestId('card-menu-button-0'));
    await user.click(await screen.findByRole('menuitem', { name: t.clearFace }));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList[0].face).toBeNull();
    });
  });

  test('应支持清除单张卡背的图片', async () => {
    const user = await renderCardList({
      state: {
        CardList: [{
          id: 'card-1',
          face: { path: getNumericImagePath(8), mtime: 1700000000008, ext: 'png' },
          back: { path: getNumericImagePath(9), mtime: 1700000000009, ext: 'png' },
          repeat: 1,
        }],
      },
    });

    await user.click(await screen.findByTestId('card-menu-button-0'));
    await user.click(await screen.findByRole('menuitem', { name: t.clearBack }));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList[0].back).toBeNull();
    });
  });

  test('应支持交换单张卡牌的卡面和卡背', async () => {
    const facePath = getNumericImagePath(10);
    const backPath = getNumericImagePath(11);
    const user = await renderCardList({
      state: {
        CardList: [{
          id: 'card-1',
          face: { path: facePath, mtime: 1700000000010, ext: 'png' },
          back: { path: backPath, mtime: 1700000000011, ext: 'png' },
          repeat: 1,
        }],
      },
    });

    await user.click(await screen.findByTestId('card-swap-button-0'));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList[0].face?.path).toBe(backPath);
      expect(useGlobalStore.getState().CardList[0].back?.path).toBe(facePath);
    });
  });
});

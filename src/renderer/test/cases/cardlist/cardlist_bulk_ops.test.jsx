// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, test, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import zhLocale from '../../../../main/locales/zh.json';
import { emptyImgPath } from '../../../../shared/constants';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../../setup/rendererCaseBootstrap';
import { createOpenMultiImageResult } from '../../fixtures/images/numericImageFixtures';
import { useGlobalStore } from '../../../state/store';
import { spyOnCardSettingDialogOpen } from '../../helpers/uiRuntimeTestHelpers';

const { cardEditor, toolbar, button } = zhLocale;

const createCard = (id, facePath, backPath) => ({
  id,
  face: facePath ? { path: facePath, mtime: 1700000000000, ext: 'png' } : null,
  back: backPath ? { path: backPath, mtime: 1700000000001, ext: 'png' } : null,
  repeat: 1,
  selected: false,
});

const createDefaultCardList = () => ([
  createCard('card-1', 'face-1.png', 'back-1.png'),
  createCard('card-2', 'face-2.png', 'back-2.png'),
  createCard('card-3', 'face-3.png', 'back-3.png'),
]);

describe('卡牌列表批量操作', () => {
  beforeEach(() => {
    bootstrapRendererCase({
      currentView: 'edit',
      state: {
        CardList: createDefaultCardList(),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  const renderBulkScene = async (options = {}) => {
    if (Object.keys(options).length > 0) {
      const { state, mocks } = options;
      bootstrapRendererCase({
        currentView: 'edit',
        state: {
          CardList: createDefaultCardList(),
          ...state,
        },
        mocks,
      });
    }
    const { EditToolbar } = await import('../../../parts/edit/Toolbar');
    const { CardList } = await import('../../../parts/edit/CardList');
    renderRendererCase(<><EditToolbar /><CardList /></>);
    return userEvent.setup();
  };

  const selectCard = async (user, index) => {
    const checkbox = (await screen.findAllByRole('checkbox'))[index];
    await user.click(checkbox);
  };

  const selectCards = async (user, ...indexes) => {
    for (const index of indexes) {
      await selectCard(user, index);
    }
  };

  const openBulkMenu = async (user, count) => {
    const label = toolbar.bulkMenu.labelSelection.replace('{{count}}', count);
    await user.click(await screen.findByRole('button', { name: label }));
  };

  const openBulkSubMenu = async (label) => {
    const menuItem = await screen.findByRole('menuitem', { name: label });
    fireEvent.mouseEnter(menuItem);
  };

  const getSelectionButton = (count) => screen.queryByRole('button', {
    name: toolbar.bulkMenu.labelSelection.replace('{{count}}', String(count)),
  });

  test('应根据选择数量显示批量按钮文案', async () => {
    const user = await renderBulkScene();

    await selectCards(user, 0, 1);

    expect(await screen.findByRole('button', { name: toolbar.bulkMenu.labelSelection.replace('{{count}}', '2') })).toBeTruthy();
    expect(useGlobalStore.getState().CardList[0].selected).toBe(true);
    expect(useGlobalStore.getState().CardList[1].selected).toBe(true);
  });

  test('取消选中后批量按钮数量应递减直到隐藏', async () => {
    const user = await renderBulkScene();

    await selectCards(user, 0, 1);
    expect(getSelectionButton(2)).toBeTruthy();

    await selectCard(user, 0);
    expect(getSelectionButton(1)).toBeTruthy();

    await selectCard(user, 1);
    expect(getSelectionButton(1)).toBeNull();
  });

  test('应支持批量删除选中的卡牌', async () => {
    const user = await renderBulkScene();

    await selectCards(user, 0, 1);
    await openBulkMenu(user, '2');
    await user.click(await screen.findByRole('menuitem', { name: toolbar.bulkMenu.menuRemove }));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList).toHaveLength(1);
    });
    expect(useGlobalStore.getState().CardList[0].id).toBe('card-3');
  });

  test('应支持批量复制选中的卡牌', async () => {
    const user = await renderBulkScene();

    await selectCards(user, 0, 1);
    await openBulkMenu(user, '2');
    await user.click(await screen.findByRole('menuitem', { name: toolbar.bulkMenu.duplidate }));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList).toHaveLength(5);
    });
    expect(useGlobalStore.getState().CardList.slice(2, 4).every((card) => card.selected === false)).toBe(true);
  });

  test('应支持批量交换选中卡牌的卡面和卡背', async () => {
    const user = await renderBulkScene();

    await selectCards(user, 0, 1);
    await openBulkMenu(user, '2');
    await user.click(await screen.findByRole('menuitem', { name: toolbar.bulkMenu.menuSwap }));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList[0].face?.path).toBe('back-1.png');
      expect(useGlobalStore.getState().CardList[0].back?.path).toBe('face-1.png');
      expect(useGlobalStore.getState().CardList[1].face?.path).toBe('back-2.png');
      expect(useGlobalStore.getState().CardList[1].back?.path).toBe('face-2.png');
    });
  });

  test('应支持批量清除选中卡牌的卡面', async () => {
    const user = await renderBulkScene();

    await selectCards(user, 0, 1);
    await openBulkMenu(user, '2');
    await openBulkSubMenu(cardEditor.face);
    await user.click(await screen.findByRole('menuitem', { name: cardEditor.clearFace }));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList[0].face).toBe(emptyImgPath);
      expect(useGlobalStore.getState().CardList[1].face).toBe(emptyImgPath);
    });
  });

  test('应支持批量清除选中卡牌的卡背', async () => {
    const user = await renderBulkScene();

    await selectCards(user, 0, 1);
    await openBulkMenu(user, '2');
    await openBulkSubMenu(cardEditor.back);
    await user.click(await screen.findByRole('menuitem', { name: cardEditor.clearBack }));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList[0].back).toBe(emptyImgPath);
      expect(useGlobalStore.getState().CardList[1].back).toBe(emptyImgPath);
    });
  });

  test('应支持批量单图填充卡面', async () => {
    const user = await renderBulkScene({
      mocks: {
        functions: {
          openImage: async () => [{ face: { path: 'shared-face.png', mtime: 1700000000100, ext: 'png' } }],
        },
      },
    });

    await selectCards(user, 0, 1);
    await openBulkMenu(user, '2');
    await openBulkSubMenu(cardEditor.face);
    await user.click(await screen.findByRole('menuitem', { name: toolbar.bulkMenu.menuFillFace }));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList[0].face?.path).toBe('shared-face.png');
      expect(useGlobalStore.getState().CardList[1].face?.path).toBe('shared-face.png');
    });
  });

  test('应支持批量单图填充卡背', async () => {
    const user = await renderBulkScene({
      mocks: {
        functions: {
          openImage: async () => [{ face: { path: 'shared-back.png', mtime: 1700000000200, ext: 'png' } }],
        },
      },
    });

    await selectCards(user, 0, 1);
    await openBulkMenu(user, '2');
    await openBulkSubMenu(cardEditor.back);
    await user.click(await screen.findByRole('menuitem', { name: toolbar.bulkMenu.menuFillBack }));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList[0].back?.path).toBe('shared-back.png');
      expect(useGlobalStore.getState().CardList[1].back?.path).toBe('shared-back.png');
    });
  });

  test('应支持批量设置选中卡牌的数量', async () => {
    const user = await renderBulkScene();

    await selectCards(user, 0, 1);
    await openBulkMenu(user, '2');

    const repeatInput = await screen.findByRole('spinbutton');
    await user.clear(repeatInput);
    await user.type(repeatInput, '4');
    await user.click(await screen.findByRole('link', { name: button.ok }));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList[0].repeat).toBe(4);
      expect(useGlobalStore.getState().CardList[1].repeat).toBe(4);
    });
  });

  test('应支持从选择项菜单打开独立设置并传入全部选中卡牌', async () => {
    const user = await renderBulkScene();
    const openDialogSpy = spyOnCardSettingDialogOpen();

    await selectCards(user, 0, 2);
    await openBulkMenu(user, '2');
    await user.click(await screen.findByRole('menuitem', { name: cardEditor.spicalConfig }));

    expect(openDialogSpy).toHaveBeenCalledWith(['card-1', 'card-3']);
  });

  test('应支持批量多图填充卡面', async () => {
    const user = await renderBulkScene({
      mocks: {
        functions: {
          openMultiImage: async () => createOpenMultiImageResult(21, 22),
        },
      },
    });

    await selectCards(user, 0, 1);
    await openBulkMenu(user, '2');
    await openBulkSubMenu(cardEditor.face);
    await user.click(await screen.findByRole('menuitem', { name: toolbar.bulkMenu.menuFillMultiFace }));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList[0].face?.path).toContain('21.png');
      expect(useGlobalStore.getState().CardList[1].face?.path).toContain('22.png');
    });
  });

  test('应支持批量多图填充卡背', async () => {
    const user = await renderBulkScene({
      mocks: {
        functions: {
          openMultiImage: async () => createOpenMultiImageResult(23, 24),
        },
      },
    });

    await selectCards(user, 0, 1);
    await openBulkMenu(user, '2');
    await openBulkSubMenu(cardEditor.back);
    await user.click(await screen.findByRole('menuitem', { name: toolbar.bulkMenu.menuFillMultiBack }));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList[0].back?.path).toContain('23.png');
      expect(useGlobalStore.getState().CardList[1].back?.path).toContain('24.png');
    });
  });
});



// @vitest-environment jsdom

import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import zhLocale from '../../../../main/locales/zh.json';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../../setup/rendererCaseBootstrap';
import { spyOnCardSettingDialogOpen } from '../../helpers/uiRuntimeTestHelpers';
import { createOpenImageResult } from '../../../../../e2e/fixtures/images/numericImageFixtures';
import { emptyImgPath } from '../../../../shared/constants';
import { useGlobalStore } from '../../../state/store';

const { toolbar, cardEditor, button } = zhLocale;

const createCard = (id, { selected = false } = {}) => ({
  id,
  face: { path: `${id}-face.png`, mtime: 1700000000000, ext: 'png' },
  back: { path: `${id}-back.png`, mtime: 1700000000001, ext: 'png' },
  repeat: 1,
  selected,
});

let visibleDisplayIndexes = new Set();
const originalIntersectionObserver = globalThis.IntersectionObserver;

class VirtualRangeIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }

  observe(element) {
    const rawIndex = element.getAttribute('data-card-display-index');
    const displayIndex = rawIndex === null ? Number.NaN : Number(rawIndex);
    const isIntersecting = visibleDisplayIndexes.has(displayIndex);
    this.callback?.([{ target: element, isIntersecting }]);
  }

  unobserve() {}

  disconnect() {}
}

describe('卡牌列表虚拟滚动下的跨范围选择', () => {
  beforeAll(() => {
    globalThis.IntersectionObserver = VirtualRangeIntersectionObserver;
  });

  afterAll(() => {
    globalThis.IntersectionObserver = originalIntersectionObserver;
  });

  beforeEach(() => {
    visibleDisplayIndexes = new Set([0, 1, 2, 8]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  const createCardListState = () => ({
    CardList: [
      createCard('card-1'),
      createCard('card-2', { selected: true }),
      createCard('card-3'),
      createCard('card-4'),
      createCard('card-5'),
      createCard('card-6', { selected: true }),
      createCard('card-7'),
      createCard('card-8'),
    ],
  });

  const renderVirtualSelectionScene = async (options = {}) => {
    bootstrapRendererCase({
      currentView: 'edit',
      state: createCardListState(),
      ...options,
    });

    const { EditToolbar } = await import('../../../parts/edit/Toolbar');
    const { CardList } = await import('../../../parts/edit/CardList');
    renderRendererCase(<><EditToolbar /><CardList /></>);
    return userEvent.setup();
  };

  const openBulkMenu = async (user, count = '2') => {
    await user.click(await screen.findByRole('button', {
      name: toolbar.bulkMenu.labelSelection.replace('{{count}}', count),
    }));
  };

  const getCardById = (id) => useGlobalStore.getState().CardList.find((card) => card.id === id);

  test('跨可视范围选择时批量按钮文案应反映全部选中项', async () => {
    await renderVirtualSelectionScene();

    expect(await screen.findByRole('button', {
      name: toolbar.bulkMenu.labelSelection.replace('{{count}}', '2'),
    })).toBeTruthy();
    expect(getCardById('card-2').selected).toBe(true);
    expect(getCardById('card-6').selected).toBe(true);
  });

  test('撤销可视范围内的选中项后，隐藏选中项仍应保持可操作', async () => {
    const user = await renderVirtualSelectionScene();

    const visibleCheckboxes = await screen.findAllByRole('checkbox');
    await user.click(visibleCheckboxes[1]);

    await waitFor(() => {
      expect(getCardById('card-2').selected).toBe(false);
      expect(getCardById('card-6').selected).toBe(true);
    });
    expect(await screen.findByRole('button', {
      name: toolbar.bulkMenu.labelSelection.replace('{{count}}', '1'),
    })).toBeTruthy();
  });

  test('跨可视范围选择时批量填充卡面应作用于可视和不可视选中项', async () => {
    const user = await renderVirtualSelectionScene({
      mocks: {
        functions: {
          openImage: async () => createOpenImageResult(31),
        },
      },
    });

    await openBulkMenu(user);
    fireEvent.mouseEnter(await screen.findByRole('menuitem', { name: cardEditor.face }));
    await user.click(await screen.findByRole('menuitem', { name: toolbar.bulkMenu.menuFillFace }));

    await waitFor(() => {
      expect(getCardById('card-2').face?.path).toContain('31.png');
      expect(getCardById('card-6').face?.path).toContain('31.png');
    });
  });

  test('跨可视范围选择时批量填充卡背应作用于可视和不可视选中项', async () => {
    const user = await renderVirtualSelectionScene({
      mocks: {
        functions: {
          openImage: async () => createOpenImageResult(32),
        },
      },
    });

    await openBulkMenu(user);
    fireEvent.mouseEnter(await screen.findByRole('menuitem', { name: cardEditor.back }));
    await user.click(await screen.findByRole('menuitem', { name: toolbar.bulkMenu.menuFillBack }));

    await waitFor(() => {
      expect(getCardById('card-2').back?.path).toContain('32.png');
      expect(getCardById('card-6').back?.path).toContain('32.png');
    });
  });

  test('跨可视范围选择时批量清除卡背应作用于可视和不可视选中项', async () => {
    const user = await renderVirtualSelectionScene();

    await openBulkMenu(user);
    fireEvent.mouseEnter(await screen.findByRole('menuitem', { name: cardEditor.back }));
    await user.click(await screen.findByRole('menuitem', { name: cardEditor.clearBack }));

    await waitFor(() => {
      expect(getCardById('card-2').back).toBe(emptyImgPath);
      expect(getCardById('card-6').back).toBe(emptyImgPath);
    });
  });

  test('跨可视范围选择时批量设置数量应作用于全部选中项', async () => {
    const user = await renderVirtualSelectionScene();

    await openBulkMenu(user);
    const repeatInput = await screen.findByRole('spinbutton');
    await user.clear(repeatInput);
    await user.type(repeatInput, '5');
    await user.click(await screen.findByRole('link', { name: button.ok }));

    await waitFor(() => {
      expect(getCardById('card-2').repeat).toBe(5);
      expect(getCardById('card-6').repeat).toBe(5);
    });
  });

  test('跨可视范围选择时批量独立设置应传入可视和不可视的全部选中项', async () => {
    const user = await renderVirtualSelectionScene();
    const openDialogSpy = spyOnCardSettingDialogOpen();

    await openBulkMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: cardEditor.spicalConfig }));

    expect(openDialogSpy).toHaveBeenCalledWith(['card-2', 'card-6']);
  });

  test('跨可视范围选择时批量删除应移除所有选中项', async () => {
    const user = await renderVirtualSelectionScene();

    await openBulkMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: toolbar.bulkMenu.menuRemove }));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList.map((card) => card.id)).toEqual([
        'card-1',
        'card-3',
        'card-4',
        'card-5',
        'card-7',
        'card-8',
      ]);
    });
  });

  test('跨可视范围选择时拖拽排序应保持全部选中项正常工作', async () => {
    await renderVirtualSelectionScene();

    const beforeIdSet = [...useGlobalStore.getState().CardList.map((card) => card.id)].sort();

    useGlobalStore.getState().dragHoverMove(0);
    useGlobalStore.getState().dragCardsMove();

    expect(useGlobalStore.getState().CardList.map((card) => card.id)).toEqual([
      'card-2',
      'card-6',
      'card-1',
      'card-3',
      'card-4',
      'card-5',
      'card-7',
      'card-8',
    ]);
    expect(useGlobalStore.getState().CardList.filter((card) => card.selected).map((card) => card.id)).toEqual([
      'card-2',
      'card-6',
    ]);
    expect([...useGlobalStore.getState().CardList.map((card) => card.id)].sort()).toEqual(beforeIdSet);
  });
});




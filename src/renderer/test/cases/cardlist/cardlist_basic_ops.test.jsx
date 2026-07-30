// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import zhLocale from '../../../../main/locales/zh.json';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../../setup/rendererCaseBootstrap';
import { useGlobalStore } from '../../../state/store';

describe('卡牌列表基础操作', () => {
  const { cardEditor: t, toolbar } = zhLocale;

  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  const renderCardListScene = async ({ state, mocks, withToolbar = false } = {}) => {
    bootstrapRendererCase({ currentView: 'edit', state, mocks });

    const { CardList } = await import('../../../parts/edit/CardList');

    if (!withToolbar) {
      renderRendererCase(<CardList />);
      return userEvent.setup();
    }

    const { EditToolbar } = await import('../../../parts/edit/Toolbar');
    renderRendererCase(<><EditToolbar /><CardList /></>);
    return userEvent.setup();
  };

  const renderSelectionScene = (state) => renderCardListScene({ state, withToolbar: true });

  const getSelectionStates = () => useGlobalStore.getState().CardList.map((card) => !!card.selected);

  const getSelectionButton = (count) => screen.queryByRole('button', {
    name: toolbar.bulkMenu.labelSelection.replace('{{count}}', String(count)),
  });

  const selectCardByCheckbox = async (user, index) => {
    const checkbox = (await screen.findAllByRole('checkbox'))[index];
    await user.click(checkbox);
  };

  test('应渲染默认卡牌列表', async () => {
    await renderCardListScene();

    expect(screen.getByTestId('card-list')).toBeTruthy();
    expect(await screen.findByRole('button', { name: t.btnRemove })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: t.btnRemove })).toHaveLength(1);
    expect(await screen.findByTestId('card-menu-button-0')).toBeTruthy();
    expect(useGlobalStore.getState().CardList).toHaveLength(1);
  });

  test('应支持添加空卡', async () => {
    const user = await renderCardListScene();

    await user.click(await screen.findByRole('button', { name: t.addEmpty }));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList).toHaveLength(2);
    });
    expect(useGlobalStore.getState().CardList.every((card) => card.repeat === 1)).toBe(true);
  });

  test('应支持删除单张卡牌', async () => {
    const user = await renderCardListScene();

    await user.click(await screen.findByRole('button', { name: t.btnRemove }));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList).toHaveLength(0);
    });
    expect(screen.queryAllByRole('button', { name: t.btnRemove })).toHaveLength(0);
  });

  test('应支持修改单张卡牌数量', async () => {
    const user = await renderCardListScene();

    const firstCard = (await screen.findByRole('button', { name: t.btnRemove })).closest('.Card');
    const repeatInput = within(firstCard).getByRole('spinbutton');

    await user.clear(repeatInput);
    await user.type(repeatInput, '3');
    await user.tab();

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList[0].repeat).toBe(3);
    });
  });

  test('再次点击同一张卡的勾选框时应撤销选中状态', async () => {
    const user = await renderSelectionScene();

    await selectCardByCheckbox(user, 0);
    await waitFor(() => {
      expect(getSelectionStates()[0]).toBe(true);
      expect(getSelectionButton(1)).toBeTruthy();
    });

    await selectCardByCheckbox(user, 0);

    await waitFor(() => {
      expect(getSelectionStates()[0]).toBe(false);
    });
    expect(getSelectionButton(1)).toBeNull();
  });

  test('勾选不同卡牌时应保留多选状态', async () => {
    const user = await renderSelectionScene({
      CardList: [
        { id: 'card-1', face: { path: 'face-1.png' }, back: { path: 'back-1.png' }, repeat: 1 },
        { id: 'card-2', face: { path: 'face-2.png' }, back: { path: 'back-2.png' }, repeat: 1 },
      ],
    });

    await selectCardByCheckbox(user, 0);
    await selectCardByCheckbox(user, 1);

    await waitFor(() => {
      expect(getSelectionStates()).toEqual([true, true]);
    });
    expect(getSelectionButton(2)).toBeTruthy();
  });

  test('shift 选择时应按最近选中项扩展连续范围', async () => {
    await renderSelectionScene({
      CardList: [
        { id: 'card-1', face: { path: 'face-1.png' }, back: { path: 'back-1.png' }, repeat: 1 },
        { id: 'card-2', face: { path: 'face-2.png' }, back: { path: 'back-2.png' }, repeat: 1 },
        { id: 'card-3', face: { path: 'face-3.png' }, back: { path: 'back-3.png' }, repeat: 1 },
        { id: 'card-4', face: { path: 'face-4.png' }, back: { path: 'back-4.png' }, repeat: 1 },
      ],
    });

    useGlobalStore.getState().cardSelect('card-1');
    useGlobalStore.getState().cardShiftSelect('card-4');

    await waitFor(() => {
      expect(getSelectionStates()).toEqual([true, true, true, true]);
      expect(getSelectionButton(4)).toBeTruthy();
    });
  });

  test('打开卡片菜单时应自动选中该卡片', async () => {
    const user = await renderSelectionScene({
      CardList: [
        { id: 'card-1', face: { path: 'face-1.png' }, back: { path: 'back-1.png' }, repeat: 1 },
        { id: 'card-2', face: { path: 'face-2.png' }, back: { path: 'back-2.png' }, repeat: 1 },
      ],
    });

    await selectCardByCheckbox(user, 0);
    await user.click(await screen.findByTestId('card-menu-button-1'));

    await waitFor(() => {
      expect(getSelectionStates()).toEqual([false, true]);
    });
    expect(await screen.findByRole('menuitem', { name: t.face })).toBeTruthy();
  });
});

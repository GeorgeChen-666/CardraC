// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../../setup/rendererCaseBootstrap';
import { useGlobalStore } from '../../../state/store';

const createCard = (id, selected = false) => ({
  id,
  face: { path: `${id}-face.png`, mtime: 1700000000000, ext: 'png' },
  back: { path: `${id}-back.png`, mtime: 1700000000001, ext: 'png' },
  repeat: 1,
  selected,
});

describe('卡牌列表拖拽排序', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  const renderCardList = async (state = {}) => {
    bootstrapRendererCase({
      currentView: 'edit',
      state: {
        CardList: [
          createCard('card-1'),
          createCard('card-2', true),
          createCard('card-3', true),
          createCard('card-4'),
        ],
        ...state,
      },
    });

    const { CardList } = await import('../../../parts/edit/CardList');
    renderRendererCase(<CardList />);
  };

  const getCardIds = () => useGlobalStore.getState().CardList.map((card) => card.id);

  const getSelectedIds = () => useGlobalStore.getState().CardList
    .filter((card) => card.selected)
    .map((card) => card.id);

  const getSortedIds = () => [...getCardIds()].sort();

  test('拖拽悬停时应插入 dragTarget 占位项', async () => {
    bootstrapRendererCase({
      currentView: 'edit',
      state: {
        CardList: [createCard('card-1'), createCard('card-2'), createCard('card-3')],
      },
    });

    useGlobalStore.getState().dragHoverMove(1);

    expect(useGlobalStore.getState().CardList.map((card) => card.id)).toEqual([
      'card-1',
      'dragTarget',
      'card-2',
      'card-3',
    ]);
  });

  test('取消拖拽时应移除 dragTarget 占位项', async () => {
    bootstrapRendererCase({
      currentView: 'edit',
      state: {
        CardList: [createCard('card-1'), createCard('card-2'), createCard('card-3')],
      },
    });

    useGlobalStore.getState().dragHoverMove(2);
    expect(useGlobalStore.getState().CardList.some((card) => card.id === 'dragTarget')).toBe(true);

    useGlobalStore.getState().dragHoverCancel();

    expect(useGlobalStore.getState().CardList.some((card) => card.id === 'dragTarget')).toBe(false);
    expect(useGlobalStore.getState().CardList.map((card) => card.id)).toEqual([
      'card-1',
      'card-2',
      'card-3',
    ]);
  });

  test('拖拽放下后应按占位位置重排选中的卡牌', async () => {
    bootstrapRendererCase({
      currentView: 'edit',
      state: {
        CardList: [
          createCard('card-1'),
          createCard('card-2', true),
          createCard('card-3', true),
          createCard('card-4'),
        ],
      },
    });

    useGlobalStore.getState().dragHoverMove(0);
    useGlobalStore.getState().dragCardsMove();

    expect(getCardIds()).toEqual([
      'card-2',
      'card-3',
      'card-1',
      'card-4',
    ]);
    expect(useGlobalStore.getState().CardList.some((card) => card.id === 'dragTarget')).toBe(false);
    expect(getSelectedIds()).toEqual(['card-2', 'card-3']);
  });

  test('拖拽到中间位置时应保持选中块内部顺序', async () => {
    bootstrapRendererCase({
      currentView: 'edit',
      state: {
        CardList: [
          createCard('card-1'),
          createCard('card-2', true),
          createCard('card-3', true),
          createCard('card-4'),
          createCard('card-5'),
        ],
      },
    });

    useGlobalStore.getState().dragHoverMove(4);
    useGlobalStore.getState().dragCardsMove();

    expect(getCardIds()).toEqual([
      'card-1',
      'card-4',
      'card-2',
      'card-3',
      'card-5',
    ]);
    expect(getSelectedIds()).toEqual(['card-2', 'card-3']);
  });

  test('非连续选择拖拽时应保持被选中卡牌的相对顺序', async () => {
    bootstrapRendererCase({
      currentView: 'edit',
      state: {
        CardList: [
          createCard('card-1', true),
          createCard('card-2'),
          createCard('card-3', true),
          createCard('card-4'),
          createCard('card-5', true),
        ],
      },
    });

    useGlobalStore.getState().dragHoverMove(4);
    useGlobalStore.getState().dragCardsMove();

    expect(getCardIds()).toEqual([
      'card-2',
      'card-4',
      'card-1',
      'card-3',
      'card-5',
    ]);
    expect(getSelectedIds()).toEqual(['card-1', 'card-3', 'card-5']);
  });

  test('拖拽到末尾时应将选中块移动到列表尾部', async () => {
    bootstrapRendererCase({
      currentView: 'edit',
      state: {
        CardList: [
          createCard('card-1'),
          createCard('card-2', true),
          createCard('card-3', true),
          createCard('card-4'),
        ],
      },
    });

    useGlobalStore.getState().dragHoverMove(4);
    useGlobalStore.getState().dragCardsMove();

    expect(getCardIds()).toEqual([
      'card-1',
      'card-4',
      'card-2',
      'card-3',
    ]);
  });

  test('重复 hover 不同位置时应只保留一个 dragTarget 且位置更新为最后一次', async () => {
    bootstrapRendererCase({
      currentView: 'edit',
      state: {
        CardList: [createCard('card-1'), createCard('card-2'), createCard('card-3'), createCard('card-4')],
      },
    });

    useGlobalStore.getState().dragHoverMove(1);
    useGlobalStore.getState().dragHoverMove(3);

    expect(getCardIds()).toEqual([
      'card-1',
      'card-2',
      'card-3',
      'dragTarget',
      'card-4',
    ]);
    expect(useGlobalStore.getState().CardList.filter((card) => card.id === 'dragTarget')).toHaveLength(1);
  });

  test('多次 hover 后放下时应按最后一次 hover 的位置排序', async () => {
    bootstrapRendererCase({
      currentView: 'edit',
      state: {
        CardList: [
          createCard('card-1'),
          createCard('card-2', true),
          createCard('card-3', true),
          createCard('card-4'),
          createCard('card-5'),
        ],
      },
    });

    useGlobalStore.getState().dragHoverMove(1);
    useGlobalStore.getState().dragHoverMove(4);
    useGlobalStore.getState().dragCardsMove();

    expect(getCardIds()).toEqual([
      'card-1',
      'card-4',
      'card-2',
      'card-3',
      'card-5',
    ]);
  });

  test('未选中任何卡牌时拖拽放下不应改变原始顺序', async () => {
    bootstrapRendererCase({
      currentView: 'edit',
      state: {
        CardList: [createCard('card-1'), createCard('card-2'), createCard('card-3')],
      },
    });

    useGlobalStore.getState().dragHoverMove(1);
    useGlobalStore.getState().dragCardsMove();

    expect(getCardIds()).toEqual(['card-1', 'card-2', 'card-3']);
    expect(useGlobalStore.getState().CardList.some((card) => card.id === 'dragTarget')).toBe(false);
  });

  test('没有占位项时取消拖拽不应破坏原始顺序', async () => {
    bootstrapRendererCase({
      currentView: 'edit',
      state: {
        CardList: [createCard('card-1'), createCard('card-2'), createCard('card-3')],
      },
    });

    useGlobalStore.getState().dragHoverCancel();

    expect(getCardIds()).toEqual(['card-1', 'card-2', 'card-3']);
  });

  test('拖拽目标落在选中块内部时最终顺序应保持不变', async () => {
    bootstrapRendererCase({
      currentView: 'edit',
      state: {
        CardList: [
          createCard('card-1'),
          createCard('card-2', true),
          createCard('card-3', true),
          createCard('card-4'),
        ],
      },
    });

    useGlobalStore.getState().dragHoverMove(2);
    useGlobalStore.getState().dragCardsMove();

    expect(getCardIds()).toEqual(['card-1', 'card-2', 'card-3', 'card-4']);
    expect(getSelectedIds()).toEqual(['card-2', 'card-3']);
  });

  test('拖拽前后卡牌 id 集合应保持一致', async () => {
    bootstrapRendererCase({
      currentView: 'edit',
      state: {
        CardList: [
          createCard('card-1'),
          createCard('card-2', true),
          createCard('card-3', true),
          createCard('card-4'),
          createCard('card-5'),
        ],
      },
    });

    const beforeIds = getSortedIds();

    useGlobalStore.getState().dragHoverMove(0);
    useGlobalStore.getState().dragCardsMove();

    expect(getSortedIds()).toEqual(beforeIds);
    expect(useGlobalStore.getState().CardList).toHaveLength(beforeIds.length);
  });

  test('拖拽未选中卡牌时应先自动选中该卡牌', async () => {
    await renderCardList({
      CardList: [
        createCard('card-1', true),
        createCard('card-2'),
        createCard('card-3'),
      ],
    });

    fireEvent.mouseDown(await screen.findByTestId('card-drag-handle-1'));

    await waitFor(() => {
      expect(getSelectedIds()).toEqual(['card-2']);
    });
  });

  test('拖拽排序后选中状态应保持在原被选中的卡牌上', async () => {
    bootstrapRendererCase({
      currentView: 'edit',
      state: {
        CardList: [
          createCard('card-1'),
          createCard('card-2', true),
          createCard('card-3', true),
          createCard('card-4'),
          createCard('card-5'),
        ],
      },
    });

    useGlobalStore.getState().dragHoverMove(4);
    useGlobalStore.getState().dragCardsMove();

    expect(getSelectedIds()).toEqual(['card-2', 'card-3']);
    expect(useGlobalStore.getState().CardList.filter((card) => !card.selected).map((card) => card.id)).toEqual([
      'card-1',
      'card-4',
      'card-5',
    ]);
  });

  test('拖拽结束时 card-list 容器应清理 dragTarget 占位项', async () => {
    await renderCardList();

    useGlobalStore.getState().dragHoverMove(1);
    expect(useGlobalStore.getState().CardList.some((card) => card.id === 'dragTarget')).toBe(true);

    fireEvent.dragEnd(screen.getByTestId('card-list'));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList.some((card) => card.id === 'dragTarget')).toBe(false);
    });
  });
});


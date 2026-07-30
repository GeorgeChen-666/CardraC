// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import zhLocale from '../../../../main/locales/zh.json';
import { layoutSides } from '../../../../shared/constants';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../../setup/rendererCaseBootstrap';
import {
  installImageViewerApiSpies,
  spyOnCardSettingDialogOpen,
} from '../../helpers/uiRuntimeTestHelpers';
import { useGlobalStore } from '../../../state/store';

vi.mock('@mui/material/Menu', async () => {
  const ReactModule = await import('react');

  return {
    default: ({ open, children }) => (open
      ? ReactModule.createElement('div', { role: 'menu' }, children)
      : null),
  };
});

const { cardEditor: t, configDialog } = zhLocale;

const createCard = ({
  id = 'card-1',
  face = { path: 'face-1.png', mtime: 1700000000000, ext: 'png' },
  back = { path: 'back-1.png', mtime: 1700000000001, ext: 'png' },
  repeat = 1,
  selected = false,
  config,
} = {}) => ({
  id,
  face,
  back,
  repeat,
  selected,
  ...(config ? { config } : {}),
});

describe('单个卡牌 UI 行为', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  const renderSingleCardScene = async ({ state, mocks } = {}) => {
    bootstrapRendererCase({
      currentView: 'edit',
      state: {
        CardList: [createCard()],
        ...state,
      },
      mocks,
    });

    const { CardList } = await import('../../../parts/edit/CardList');
    renderRendererCase(<CardList />);
  };

  const getSingleCard = async () => (await screen.findByRole('button', { name: t.btnRemove })).closest('.Card');

  const openCardMenu = async () => {
    fireEvent.click(await screen.findByTestId('card-menu-button-0'));
  };

  test('单面模式下单卡不应显示卡背图片与交换按钮', async () => {
    await renderSingleCardScene({
      state: {
        Config: {
          sides: layoutSides.oneSide,
        },
      },
    });

    expect(screen.queryByTestId('card-swap-button-0')).toBeNull();
    expect(screen.queryByTestId('card-back-image')).toBeNull();
    expect(await screen.findByTestId('card-face-image')).toBeTruthy();

    await openCardMenu();

    expect(screen.queryByRole('menuitem', { name: t.back })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: t.clearBack })).toBeNull();
    expect(await screen.findByRole('menuitem', { name: t.spicalConfig })).toBeTruthy();
  });

  test('折页模式下单卡不应显示数量输入且不应提供特殊配置入口', async () => {
    await renderSingleCardScene({
      state: {
        Config: {
          sides: layoutSides.brochure,
        },
      },
    });

    await screen.findByRole('button', { name: t.btnRemove });

    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByTestId('card-swap-button-0')).toBeNull();
    expect(screen.queryByTestId('card-back-image')).toBeNull();

    await openCardMenu();

    expect(await screen.findByRole('menuitem', { name: t.face })).toBeTruthy();
    expect(await screen.findByRole('menuitem', { name: t.clearFace })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: t.spicalConfig })).toBeNull();
  });

  test('应支持从单卡菜单打开特殊配置并更新出血显示', async () => {
    await renderSingleCardScene();
    const openDialogSpy = spyOnCardSettingDialogOpen();

    await openCardMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: t.spicalConfig }));

    expect(openDialogSpy).toHaveBeenCalledWith(['card-1']);


    useGlobalStore.getState().editCardsConfig(['card-1'], {
      bleed: {
        faceBleedX: 1.1,
        faceBleedY: 1.2,
        backBleedX: 0.3,
        backBleedY: 0.4,
      },
    });

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList[0].config?.bleed).toEqual({
        faceBleedX: 1.1,
        faceBleedY: 1.2,
        backBleedX: 0.3,
        backBleedY: 0.4,
      });
    });

    const firstCard = await getSingleCard();
    await waitFor(() => {
      const bleedSummary = within(firstCard).getByTitle(configDialog.bleed);
      expect(bleedSummary.textContent).toContain(`${t.face}: 1.1|1.2`);
      expect(bleedSummary.textContent).toContain(`${t.back}: 0.3|0.4`);
    });
  });

  test('显式设置为 0 的独立出血配置不应被当作空配置移除', async () => {
    await renderSingleCardScene();

    useGlobalStore.getState().editCardsConfig(['card-1'], {
      bleed: {
        faceBleedX: 0,
        faceBleedY: 0,
        backBleedX: 0,
        backBleedY: 0,
      },
    });

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList[0].config?.bleed).toEqual({
        faceBleedX: 0,
        faceBleedY: 0,
        backBleedX: 0,
        backBleedY: 0,
      });
    });

    const firstCard = await getSingleCard();
    const bleedSummary = within(firstCard).getByTitle(configDialog.bleed);
    expect(bleedSummary.textContent).toContain(`${t.face}: 0|0`);
    expect(bleedSummary.textContent).toContain(`${t.back}: 0|0`);
  });

  test('悬停卡面图片时应触发卡面放大预览并在移出时关闭', async () => {
    await renderSingleCardScene();
    const { update, close } = installImageViewerApiSpies();

    const faceImage = await screen.findByTestId('card-face-image');
    fireEvent.mouseOver(faceImage);
    fireEvent.mouseLeave(faceImage);

    expect(update).toHaveBeenCalledWith('face-1.png');
    expect(close).toHaveBeenCalled();
  });

  test('单面模式下不应提供卡背放大入口', async () => {
    await renderSingleCardScene({
      state: {
        Config: {
          sides: layoutSides.oneSide,
        },
      },
    });
    const { update } = installImageViewerApiSpies();

    const faceImage = await screen.findByTestId('card-face-image');
    fireEvent.mouseOver(faceImage);

    expect(update).toHaveBeenCalledWith('face-1.png');
    expect(update).not.toHaveBeenCalledWith('back-1.png');
    expect(screen.queryByTestId('card-back-image')).toBeNull();
  });

  test('悬停卡背图片时应触发卡背放大预览并在移出时关闭', async () => {
    await renderSingleCardScene({
      state: {
        Config: {
          sides: layoutSides.doubleSides,
        },
      },
    });
    const { update, close } = installImageViewerApiSpies();

    const backImage = await screen.findByTestId('card-back-image');
    fireEvent.mouseOver(backImage);
    fireEvent.mouseLeave(backImage);

    expect(update).toHaveBeenCalledWith('back-1.png');
    expect(close).toHaveBeenCalled();
  });
});

















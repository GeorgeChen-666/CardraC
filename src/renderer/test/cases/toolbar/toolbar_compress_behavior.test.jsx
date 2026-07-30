// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import zhLocale from '../../../../main/locales/zh.json';
import { cleanupRendererCase } from '../../setup/rendererCaseBootstrap';
import { bootstrapMenuBarCase, renderMenuBar } from '../../helpers/toolbarTestHelpers';

const { toolbar: t, configDialog } = zhLocale;
const lvText = t.compressMenu.compressLevelDesc.split('|');

const createReloadLocalImageMock = () => vi.fn(async () => {
  const { useGlobalStore } = await import('../../../state/store');
  const state = useGlobalStore.getState();
  return {
    CardList: state.CardList,
    Config: state.Config,
  };
});

describe('工具栏压缩等级行为', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test('切换压缩等级后应更新压缩等级并触发图像重载', async () => {
    const reloadLocalImageMock = createReloadLocalImageMock();

    bootstrapMenuBarCase({
      currentView: 'edit',
      mocks: {
        functions: {
          checkImage: async () => [],
          reloadLocalImage: reloadLocalImageMock,
        },
      },
    });
    const page = await renderMenuBar();

    await page.menu.clickButton(t.compressLevel);
    await page.menu.user.click(await screen.findByText(`${t.compressLevel}Lv3:${lvText[3]}`));
    const { useGlobalStore } = await import('../../../state/store');

    await waitFor(() => {
      expect(reloadLocalImageMock).toHaveBeenCalledTimes(1);
      expect(useGlobalStore.getState().Config.compressLevel).toBe(3);
    });
  });

  test('点击手动重载图像时应触发重载且保持当前压缩等级', async () => {
    const reloadLocalImageMock = createReloadLocalImageMock();

    bootstrapMenuBarCase({
      currentView: 'edit',
      state: {
        Config: {
          compressLevel: 2,
        },
      },
      mocks: {
        functions: {
          checkImage: async () => [],
          reloadLocalImage: reloadLocalImageMock,
        },
      },
    });
    const page = await renderMenuBar();

    await page.menu.clickButton(t.compressLevel);
    await page.menu.user.click(await screen.findByText(t.compressMenu.manualReload));

    const { useGlobalStore } = await import('../../../state/store');

    await waitFor(() => {
      expect(reloadLocalImageMock).toHaveBeenCalledTimes(1);
      expect(useGlobalStore.getState().Config.compressLevel).toBe(2);
    });
  });

  test('检测到异常图片时应支持从修正路径入口打开重载图片向导', async () => {
    bootstrapMenuBarCase({
      currentView: 'edit',
      state: {
        Config: {
          globalBackground: { path: 'missing-bg.png', mtime: 1, ext: 'png' },
        },
        CardList: [{
          id: 'card-1',
          face: { path: 'missing-face.png', mtime: 2, ext: 'png' },
          back: { path: 'missing-back.png', mtime: 3, ext: 'png' },
          repeat: 1,
        }],
      },
      mocks: {
        functions: {
          checkImage: async () => ['missing-face.png', 'missing-back.png'],
        },
      },
    });
    const page = await renderMenuBar();

    await page.menu.clickButton(t.compressLevel);
    await page.menu.user.click(await screen.findByText(t.compressMenu.fixPath));

    expect(await screen.findByText(configDialog.reloadImageWizard)).toBeTruthy();
    expect(await screen.findByText('missing-face.png')).toBeTruthy();
    expect(await screen.findByText('missing-back.png')).toBeTruthy();
  });

  test('修正图片向导确认后应批量回写新路径并触发重载', async () => {
    const invalidPaths = [
      'C:/old/cards/card-01.png',
      'C:/old/cards/card-02.png',
      'C:/old/cards/bg.png',
    ];
    const checkImageMock = vi.fn(async ({ pathList }) => {
      if (pathList?.[0]?.startsWith('D:/new/cards/')) {
        return [];
      }

      return invalidPaths;
    });
    const reloadLocalImageMock = createReloadLocalImageMock();

    bootstrapMenuBarCase({
      currentView: 'edit',
      state: {
        Config: {
          globalBackground: { path: 'C:/old/cards/bg.png', mtime: 11, ext: 'png' },
        },
        CardList: [
          {
            id: 'card-1',
            face: { path: 'C:/old/cards/card-01.png', mtime: 21, ext: 'png' },
            back: { path: 'C:/old/cards/card-02.png', mtime: 22, ext: 'png' },
            repeat: 1,
          },
          {
            id: 'card-2',
            face: { path: 'C:/keep/keep.png', mtime: 31, ext: 'png' },
            back: null,
            repeat: 1,
          },
        ],
      },
      mocks: {
        functions: {
          checkImage: checkImageMock,
          openImage: async () => [{ face: { path: 'D:/new/cards/card-01.png', mtime: 99, ext: 'png' } }],
          reloadLocalImage: reloadLocalImageMock,
        },
      },
    });
    const page = await renderMenuBar();

    await page.menu.clickButton(t.compressLevel);
    await page.menu.user.click(await screen.findByText(t.compressMenu.fixPath));

    const sourceRow = (await screen.findByText('C:/old/cards/card-01.png')).closest('tr');
    await page.menu.user.click(within(sourceRow).getByRole('button'));

    expect(checkImageMock).toHaveBeenNthCalledWith(2, {
      pathList: [
        'D:/new/cards/card-01.png',
        'D:/new/cards/card-02.png',
        'D:/new/cards/bg.png',
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('D:/new/cards/card-02.png')).toBeTruthy();
      expect(screen.getByText('D:/new/cards/bg.png')).toBeTruthy();
    });

    await page.menu.user.click(await screen.findByRole('button', { name: zhLocale.button.ok }));

    const { useGlobalStore } = await import('../../../state/store');

    await waitFor(() => {
      expect(reloadLocalImageMock).toHaveBeenCalledTimes(1);
      expect(useGlobalStore.getState().Config.globalBackground).toEqual({
        path: 'D:/new/cards/bg.png',
        ext: 'png',
      });
      expect(useGlobalStore.getState().CardList[0].face).toEqual({
        path: 'D:/new/cards/card-01.png',
        ext: 'png',
      });
      expect(useGlobalStore.getState().CardList[0].back).toEqual({
        path: 'D:/new/cards/card-02.png',
        ext: 'png',
      });
      expect(useGlobalStore.getState().CardList[1].face).toEqual({
        path: 'C:/keep/keep.png',
        mtime: 31,
        ext: 'png',
      });
    });
  });
});




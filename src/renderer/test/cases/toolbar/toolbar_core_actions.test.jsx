// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';
import zhLocale from '../../../../main/locales/zh.json';
import { cleanupRendererCase } from '../../setup/rendererCaseBootstrap';
import { mergeRendererState } from '../../helpers/rendererTestSetup';
import { bootstrapMenuBarCase, renderMenuBar } from '../../helpers/toolbarTestHelpers';
import { useGlobalStore } from '../../../state/store';

const { toolbar: t } = zhLocale;

const createFileEntry = (realPath) => ([{ realPath, safePath: realPath, ext: 'cpnp', modified: 1700000000000 }]);
const createImageResult = (path) => ([{ face: { path, mtime: 1700000000000, ext: 'png' } }]);

describe('工具栏核心动作', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test('点击新建按钮后应重置卡牌列表并刷新导出页数与预览版本', async () => {
    bootstrapMenuBarCase({ currentView: 'edit' });
    const page = await renderMenuBar();
    const beforeVersion = (await import('../../../state/store')).useGlobalStore.getState().Global.imageVersion;

    await page.menu.clickButton(t.btnAdd);

    const { useGlobalStore } = await import('../../../state/store');
    const state = useGlobalStore.getState();
    expect(state.CardList).toEqual([]);
    expect(state.Global.exportPageCount).toBe(3);
    expect(state.Global.imageVersion).toBeGreaterThanOrEqual(beforeVersion);
  });

  test('点击打开按钮后应读取文件并载入项目数据', async () => {
    bootstrapMenuBarCase({
      currentView: 'edit',
      mocks: {
        functions: {
          showFileOpenDialog: async () => [createFileEntry('C:/projects/demo.cpnp')],
          openProject: async () => ({
            Global: {},
            Config: {},
            CardList: [{ id: 'opened-card', face: { path: 'opened-face.png', mtime: 1, ext: 'png' }, repeat: 1 }],
          }),
        },
      },
    });
    const page = await renderMenuBar();

    await page.menu.clickButton(t.btnOpen);

    const { useGlobalStore } = await import('../../../state/store');
    expect(useGlobalStore.getState().CardList.map((card) => card.id)).toContain('opened-card');
    expect(useGlobalStore.getState().Global.exportPageCount).toBe(3);
  });

  test('打开项目时若用户取消选择则不应触发载入流程', async () => {
    bootstrapMenuBarCase({
      currentView: 'edit',
      mocks: {
        functions: {
          showFileOpenDialog: async () => [],
        },
      },
    });
    const rendererFunctions = await import('../../../functions');
    const page = await renderMenuBar();

    await page.menu.clickButton(t.btnOpen);

    expect(rendererFunctions.openProject).not.toHaveBeenCalled();
    expect(useGlobalStore.getState().CardList.map((card) => card.id)).toEqual(['card-1']);
    expect(useGlobalStore.getState().Global.exportPageCount).toBe(2);
  });

  test('点击保存按钮后应使用目标路径保存项目', async () => {
    const saveProjectMock = vi.fn(async () => true);

    bootstrapMenuBarCase({
      currentView: 'edit',
      mocks: {
        functions: {
          showFileOpenDialog: async () => ({ realPath: 'C:/projects/saved.cpnp' }),
          saveProject: saveProjectMock,
        },
      },
    });
    const page = await renderMenuBar();

    await page.menu.clickButton(t.btnSave);

    expect(saveProjectMock).toHaveBeenCalledWith(expect.objectContaining({
      filePath: 'C:/projects/saved.cpnp',
    }));
  });

  test('保存项目时若用户取消选择则不应继续保存', async () => {
    bootstrapMenuBarCase({
      currentView: 'edit',
      mocks: {
        functions: {
          showFileOpenDialog: async () => null,
        },
      },
    });
    const rendererFunctions = await import('../../../functions');
    const page = await renderMenuBar();

    await page.menu.clickButton(t.btnSave);

    expect(rendererFunctions.saveProject).not.toHaveBeenCalled();
  });

  test('点击导出 PDF/PNG 按钮后应使用对应格式导出文件', async () => {
    const exportFileMock = vi.fn(async () => true);
    const showFileOpenDialogMock = vi.fn(async ({ filterExtensions }) => ({
      realPath: filterExtensions === 'pdf' ? 'C:/exports/output.pdf' : 'C:/exports/output.zip',
    }));

    bootstrapMenuBarCase({
      currentView: 'edit',
      mocks: {
        functions: {
          showFileOpenDialog: showFileOpenDialogMock,
          exportFile: exportFileMock,
        },
      },
    });
    const page = await renderMenuBar();

    await page.menu.clickButton(t.btnExport.replace('{{format}}', 'PDF'));
    await page.menu.clickButton(t.btnExport.replace('{{format}}', 'PNG'));

    expect(exportFileMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      filePath: 'C:/exports/output.pdf',
      targetFileType: 'pdf',
    }));
    expect(exportFileMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      filePath: 'C:/exports/output.zip',
      targetFileType: 'png',
    }));
  });

  test('导出文件时若用户取消保存则不应触发导出', async () => {
    bootstrapMenuBarCase({
      currentView: 'edit',
      mocks: {
        functions: {
          showFileOpenDialog: async () => null,
        },
      },
    });
    const rendererFunctions = await import('../../../functions');
    const page = await renderMenuBar();

    await page.menu.clickButton(t.btnExport.replace('{{format}}', 'PDF'));
    await page.menu.clickButton(t.btnExport.replace('{{format}}', 'PNG'));

    expect(rendererFunctions.exportFile).not.toHaveBeenCalled();
  });

  test('点击全局背景按钮后应更新全局背景图', async () => {
    bootstrapMenuBarCase({
      currentView: 'edit',
      mocks: {
        functions: {
          openImage: async () => createImageResult('background-updated.png'),
        },
      },
    });
    const page = await renderMenuBar();

    await page.menu.clickButton(t.btnGlobalBack);

    const { useGlobalStore } = await import('../../../state/store');
    expect(useGlobalStore.getState().Config.globalBackground?.path).toBe('background-updated.png');
  });

  test('选择全局背景时若未选中图片则应清除原背景', async () => {
    bootstrapMenuBarCase({
      currentView: 'edit',
      state: {
        Config: {
          globalBackground: { path: 'existing-background.png', mtime: 3, ext: 'png' },
        },
      },
      mocks: {
        functions: {
          openImage: async () => [],
        },
      },
    });
    const page = await renderMenuBar();

    await page.menu.clickButton(t.btnGlobalBack);

    expect(useGlobalStore.getState().Config.globalBackground).toBeUndefined();
  });

  test('点击撤销和重做按钮时应清理预览缓存并变更卡牌顺序', async () => {
    const clearPreviewCacheMock = vi.fn(async () => true);

    bootstrapMenuBarCase({
      currentView: 'edit',
      mocks: {
        functions: {
          clearPreviewCache: clearPreviewCacheMock,
        },
      },
    });
    const { useGlobalStore } = await import('../../../state/store');
    useGlobalStore.getState().historyReset();
    useGlobalStore.getState().setWithHistory({
      CardList: [
        { id: 'card-2', face: { path: 'face-2.png', mtime: 2, ext: 'png' }, repeat: 1 },
        { id: 'card-1', face: { path: 'face-1.png', mtime: 1, ext: 'png' }, repeat: 1 },
      ],
    });
    mergeRendererState({ canUndo: true, canRedo: false }, 'History');

    const page = await renderMenuBar();

    await page.menu.clickButton(t.btnUndo);
    expect(clearPreviewCacheMock).toHaveBeenCalledTimes(1);
    expect(useGlobalStore.getState().CardList.map((card) => card.id)).toEqual(['card-1']);

    mergeRendererState({ canRedo: true }, 'History');
    await page.menu.clickButton(t.btnRedo);
    expect(clearPreviewCacheMock).toHaveBeenCalledTimes(2);
    expect(useGlobalStore.getState().CardList.map((card) => card.id)).toEqual(['card-2', 'card-1']);
  });
});


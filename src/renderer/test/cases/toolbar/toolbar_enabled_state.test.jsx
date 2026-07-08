// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';
import zhLocale from '../../../../main/locales/zh.json';
import { cleanupRendererCase } from '../../setup/rendererCaseBootstrap';
import { mergeRendererState } from '../../helpers/rendererTestSetup';
import { bootstrapMenuBarCase, renderMenuBar } from '../../helpers/toolbarTestHelpers';

const { toolbar: t } = zhLocale;

describe('工具栏启用状态', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test('默认状态下撤销和重做应禁用，压缩和打印应启用', async () => {
    bootstrapMenuBarCase({ currentView: 'edit' });
    const page = await renderMenuBar();

    expect(page.menu.isButtonDisabled(t.btnUndo)).toBe(true);
    expect(page.menu.isButtonDisabled(t.btnRedo)).toBe(true);
    expect(page.menu.isButtonDisabled(t.compressLevel)).toBe(false);
    expect(page.menu.isButtonDisabled(t.print)).toBe(false);
  });

  test('有历史记录时撤销和重做按钮都应启用', async () => {
    bootstrapMenuBarCase({ currentView: 'edit' });
    mergeRendererState({ canUndo: true, canRedo: true }, 'History');
    const page = await renderMenuBar();

    expect(page.menu.isButtonDisabled(t.btnUndo)).toBe(false);
    expect(page.menu.isButtonDisabled(t.btnRedo)).toBe(false);
  });

  test('无卡牌时压缩和打印按钮应禁用', async () => {
    bootstrapMenuBarCase({
      currentView: 'edit',
      state: { CardList: [] },
    });
    const page = await renderMenuBar();

    expect(page.menu.isButtonDisabled(t.compressLevel)).toBe(true);
    expect(page.menu.isButtonDisabled(t.print)).toBe(true);
  });
});


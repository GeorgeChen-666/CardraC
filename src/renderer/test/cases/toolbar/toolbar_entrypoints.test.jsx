// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';
import { screen } from '@testing-library/react';
import zhLocale from '../../../../main/locales/zh.json';
import { cleanupRendererCase } from '../../setup/rendererCaseBootstrap';
import { bootstrapMenuBarCase, renderMenuBar } from '../../helpers/toolbarTestHelpers';

const { toolbar: t } = zhLocale;

describe('工具栏入口可点击性', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test('点击压缩等级按钮应展开菜单', async () => {
    bootstrapMenuBarCase({ currentView: 'edit' });
    const page = await renderMenuBar();

    await page.menu.clickButton(t.compressLevel);

    expect(await screen.findByText(t.compressMenu.fixPath)).toBeTruthy();
    expect(screen.getByText(t.compressMenu.manualReload)).toBeTruthy();
  });


  test('点击参数设置按钮应打开边界对话框', async () => {
    bootstrapMenuBarCase({ currentView: 'edit' });
    const page = await renderMenuBar();

    await page.menu.clickButton(t.btnConfig);

    expect(await screen.findByTestId('setup-dialog')).toBeTruthy();
  });

  test('点击打印按钮应打开边界抽屉', async () => {
    bootstrapMenuBarCase({ currentView: 'edit' });
    const page = await renderMenuBar();

    await page.menu.clickButton(t.print);

    expect(await screen.findByTestId('print-drawer')).toBeTruthy();
  });
});


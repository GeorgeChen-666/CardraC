// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';
import { screen } from '@testing-library/react';
import zhLocale from '../../../../main/locales/zh.json';
import { cleanupRendererCase } from '../../setup/rendererCaseBootstrap';
import { bootstrapMenuBarCase, renderMenuBar } from '../../helpers/toolbarTestHelpers';

const { toolbar: t } = zhLocale;

describe('工具栏例外行为', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test('点击 Chat 按钮应弹出真实聊天对话框', async () => {
    bootstrapMenuBarCase({ currentView: 'edit' });
    const page = await renderMenuBar();

    await page.menu.clickButton('Chat');

    expect(await screen.findByRole('dialog', { name: t.chatScan })).toBeTruthy();
  });

  test('点击 GitHub 按钮应打开项目主页', async () => {
    bootstrapMenuBarCase({ currentView: 'edit' });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const page = await renderMenuBar();

    await page.menu.clickButton('GitHub');

    expect(openSpy).toHaveBeenCalledWith('https://github.com/GeorgeChen-666/CardraC');
  });

  test('点击关于按钮应弹出真实关于对话框', async () => {
    bootstrapMenuBarCase({ currentView: 'edit' });
    const page = await renderMenuBar();

    await page.menu.clickButton(t.btnAbout);

    expect(await screen.findByRole('dialog', { name: /About Cardrac/i })).toBeTruthy();
    expect(await screen.findByText('Version: test-version')).toBeTruthy();
  });
});


// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';
import { screen } from '@testing-library/react';
import zhLocale from '../../../../main/locales/zh.json';
import { i18nInstance } from '../../../i18n';
import { cleanupRendererCase } from '../../setup/rendererCaseBootstrap';
import { bootstrapMenuBarCase, renderMenuBar } from '../../helpers/toolbarTestHelpers';

const { toolbar: t } = zhLocale;

describe('工具栏语言切换行为', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test('语言菜单不应展示当前语言', async () => {
    bootstrapMenuBarCase({
      currentView: 'edit',
      state: {
        Global: {
          currentLang: 'zh',
          availableLangs: ['zh', 'en'],
        },
      },
    });
    const page = await renderMenuBar();

    await page.menu.clickButton(t.btnLang);

    expect(await screen.findByText('en')).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /zh/i })).toBeNull();
  });

  test('点击其他语言后应切换语言并更新当前语言状态', async () => {
    const changeLanguageSpy = vi.spyOn(i18nInstance, 'changeLanguage').mockResolvedValue(i18nInstance);

    bootstrapMenuBarCase({
      currentView: 'edit',
      state: {
        Global: {
          currentLang: 'zh',
          availableLangs: ['zh', 'en'],
        },
      },
    });
    const page = await renderMenuBar();

    await page.menu.clickButton(t.btnLang);
    await page.menu.user.click(await screen.findByRole('menuitem', { name: /en/i }));

    const { useGlobalStore } = await import('../../../state/store');

    expect(changeLanguageSpy).toHaveBeenCalledWith('en');
    expect(useGlobalStore.getState().Global.currentLang).toBe('en');

    await page.menu.clickButton(t.btnLang);

    expect(await screen.findByText('zh')).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /en/i })).toBeNull();
  });
});




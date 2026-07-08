// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';
import { screen } from '@testing-library/react';
import zhLocale from '../../../../main/locales/zh.json';
import { layoutSides } from '../../../../shared/constants';
import { cleanupRendererCase } from '../../setup/rendererCaseBootstrap';
import { bootstrapMenuBarCase, renderMenuBar } from '../../helpers/toolbarTestHelpers';
import { useGlobalStore } from '../../../state/store';

const { toolbar: t } = zhLocale;

const defaultVisibleButtons = [
  t.btnAdd,
  t.btnOpen,
  t.btnSave,
  t.btnUndo,
  t.btnRedo,
  t.btnLang,
  t.btnConfig,
  t.btnExport.replace('{{format}}', 'PDF'),
  t.btnExport.replace('{{format}}', 'PNG'),
  t.compressLevel,
  t.print,
  t.btnGlobalBack,
  'Chat',
  'GitHub',
  t.btnAbout,
];

describe('工具栏可见性', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test('编辑模式下基础按钮与附加开关应显示，且开关切换后应同步到 store', async () => {
    bootstrapMenuBarCase({ currentView: 'edit' });
    const page = await renderMenuBar();

    defaultVisibleButtons.forEach((label) => {
      expect(page.menu.getButton(label)).toBeTruthy();
    });

    const overviewSwitch = screen.getByRole('switch', { name: t.lblShowOverviewWindow });
    const frontBackSwitch = screen.getByRole('switch', { name: t.lblViewFrontLarge });
    expect(overviewSwitch).toBeTruthy();
    expect(frontBackSwitch).toBeTruthy();

    await page.menu.user.click(overviewSwitch);
    await page.menu.user.click(frontBackSwitch);

    expect(useGlobalStore.getState().Global.isShowOverView).toBe(false);
    expect(useGlobalStore.getState().Global.isBackEditing).toBe(true);
  });

  test('单面模式下全局背景按钮应隐藏，双面模式下应可见', async () => {
    bootstrapMenuBarCase({
      currentView: 'edit',
      state: { Config: { sides: layoutSides.oneSide } },
    });
    let page = await renderMenuBar();

    expect(page.menu.queryButton(t.btnGlobalBack)).toBeNull();

    cleanupRendererCase();
    bootstrapMenuBarCase({
      currentView: 'edit',
      state: { Config: { sides: layoutSides.doubleSides } },
    });
    page = await renderMenuBar();

    expect(page.menu.getButton(t.btnGlobalBack)).toBeTruthy();
  });
});


// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import zhLocale from '../../../../main/locales/zh.json';
import { cleanupRendererCase } from '../../setup/rendererCaseBootstrap';
import { bootstrapMenuBarCase, renderMenuBar } from '../../helpers/toolbarTestHelpers';

const { toolbar, configPrintDialog, button } = zhLocale;

const renderToolbarWithRealPrintDrawer = async (options = {}) => {
  bootstrapMenuBarCase({
    currentView: 'edit',
    ...options,
    mocks: {
      ...options.mocks,
      components: {
        ...(options.mocks?.components || {}),
        PrintDrawer: 'actual',
      },
    },
  });

  return renderMenuBar();
};

const openPrintDrawer = async (options = {}) => {
  const page = await renderToolbarWithRealPrintDrawer(options);
  await page.menu.clickButton(toolbar.print);

  const drawer = document.querySelector('.print-drawer');
  expect(drawer).toBeTruthy();

  await waitFor(() => {
    expect(within(drawer).getByLabelText(configPrintDialog.targetPrinter)).toBeTruthy();
  });

  return { page, drawer };
};

describe('打印入口', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test('点击打印入口应打开打印抽屉', async () => {
    const { drawer } = await openPrintDrawer();

    expect(within(drawer).getByLabelText(configPrintDialog.targetPrinter)).toBeTruthy();
    expect(within(drawer).getByLabelText(configPrintDialog.pageRange)).toBeTruthy();
    expect(within(drawer).getByLabelText(configPrintDialog.printFilter)).toBeTruthy();
  });

  test('打印抽屉打开后应显示关键入口元素并支持关闭', async () => {
    const { drawer } = await openPrintDrawer();

    expect(within(drawer).getByText(configPrintDialog.printParams)).toBeTruthy();
    expect(within(drawer).getByRole('button', { name: configPrintDialog.adjustOffsetGuide })).toBeTruthy();
    expect(within(drawer).getByRole('button', { name: button.cancel })).toBeTruthy();

    within(drawer).getByRole('button', { name: button.cancel }).click();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: configPrintDialog.adjustOffsetGuide })).toBeNull();
    });
  });
});


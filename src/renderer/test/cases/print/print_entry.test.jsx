// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import zhLocale from '../../../../main/locales/zh.json';
import { cleanupRendererCase } from '../../setup/rendererCaseBootstrap';
import { openPrintDrawer } from '../../helpers/printTestHelpers';

const { configPrintDialog, button } = zhLocale;

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


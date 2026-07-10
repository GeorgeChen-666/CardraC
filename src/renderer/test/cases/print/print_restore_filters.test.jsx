// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import zhLocale from '../../../../main/locales/zh.json';
import { cleanupRendererCase } from '../../setup/rendererCaseBootstrap';
import { openPrintDrawer, setPageRange } from '../../helpers/printTestHelpers';

const { configPrintDialog, button } = zhLocale;

describe('打印配置回填与页码过滤', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test.each([
    configPrintDialog.printFilter_all,
    configPrintDialog.printFilter_odd,
    configPrintDialog.printFilter_even,
  ])('打印范围切换为 %s 时应更新下拉显示', async (filterLabel) => {
    const { drawer, user } = await openPrintDrawer();

    if (filterLabel !== configPrintDialog.printFilter_all) {
      await user.click(within(drawer).getByRole('combobox', { name: configPrintDialog.printFilter }));
      await user.click(await screen.findByRole('option', { name: filterLabel }));
    }

    expect(within(drawer).getByRole('combobox', { name: configPrintDialog.printFilter }).textContent).toContain(filterLabel);
  });

  test.each([
    configPrintDialog.printFilter_odd,
    configPrintDialog.printFilter_even,
  ])('起始页不是 1 时，切换到 %s 后应保留当前区间输入', async (filterLabel) => {
    const { drawer, user } = await openPrintDrawer({
      mocks: {
        functions: {
          getExportPageCount: async () => 6,
        },
      },
    });

    await waitFor(() => {
      expect(within(drawer).getAllByRole('spinbutton')[1].value).toBe('6');
    });

    await setPageRange(drawer, user, 2, 6);
    await user.click(within(drawer).getByRole('combobox', { name: configPrintDialog.printFilter }));
    await user.click(await screen.findByRole('option', { name: filterLabel }));

    expect(within(drawer).getByRole('spinbutton', { name: configPrintDialog.pageRange }).value).toBe('2');
    expect(within(drawer).getAllByRole('spinbutton')[1].value).toBe('6');
  });

  test('起止页相同且打印全部时应只打印该单页', async () => {
    const { drawer, user } = await openPrintDrawer({
      mocks: {
        functions: {
          getExportPageCount: async () => 6,
        },
      },
    });

    await waitFor(() => {
      expect(within(drawer).getAllByRole('spinbutton')[1].value).toBe('6');
    });

    await setPageRange(drawer, user, 3, 3);
    expect(within(drawer).getByRole('spinbutton', { name: configPrintDialog.pageRange }).value).toBe('3');
    expect(within(drawer).getAllByRole('spinbutton')[1].value).toBe('3');
  });

  test('同一会话内降低 pageEnd 后仍应允许再次调大', async () => {
    const { drawer, user } = await openPrintDrawer({
      mocks: {
        functions: {
          getExportPageCount: async () => 6,
        },
      },
    });

    await waitFor(() => {
      expect(within(drawer).getAllByRole('spinbutton')[1].value).toBe('6');
    });

    await setPageRange(drawer, user, 1, 3);
    await setPageRange(drawer, user, 1, 5);
    expect(within(drawer).getAllByRole('spinbutton')[1].value).toBe('5');
  });

  test('切换到指定纸张尺寸后应使用该尺寸的名称和宽高进行打印', async () => {
    const { drawer, user } = await openPrintDrawer({
      mocks: {
        functions: {
          getPrinters: async () => ({
            printers: [
              {
                printerName: 'Test Printer',
                isDefault: true,
                defaultWidthMm: 210,
                defaultHeightMm: 297,
                isLandscape: false,
                defaultPaperSize: 'A4',
                paperSizes: [
                  { name: 'A4', widthMm: 210, heightMm: 297 },
                  { name: 'Legal', widthMm: 216, heightMm: 356 },
                ],
              },
            ],
          }),
        },
      },
    });

    await user.click(within(drawer).getByRole('combobox', { name: configPrintDialog.paperSize }));
    await user.click(await screen.findByRole('option', { name: 'Legal' }));

    expect(within(drawer).getByRole('combobox', { name: configPrintDialog.paperSize }).textContent).toContain('Legal');
  });

  test('重新打开打印抽屉后页码范围应重置为默认值', async () => {
    const { drawer, user, page } = await openPrintDrawer({
      mocks: {
        functions: {
          getExportPageCount: async () => 6,
        },
      },
    });

    await waitFor(() => {
      expect(within(drawer).getAllByRole('spinbutton')[1].value).toBe('6');
    });

    await setPageRange(drawer, user, 2, 5);
    expect(within(drawer).getByRole('spinbutton', { name: configPrintDialog.pageRange }).value).toBe('2');
    expect(within(drawer).getAllByRole('spinbutton')[1].value).toBe('5');

    await user.click(within(drawer).getByRole('button', { name: button.cancel }));
    await page.menu.clickButton(zhLocale.toolbar.print);

    await waitFor(() => {
      expect(within(drawer).getByRole('spinbutton', { name: configPrintDialog.pageRange }).value).toBe('1');
    });

    expect(within(drawer).getAllByRole('spinbutton')[1].value).toBe('6');
  });
});

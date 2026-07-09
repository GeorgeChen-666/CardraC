// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, waitFor, within } from '@testing-library/react';
import zhLocale from '../../../../main/locales/zh.json';
import { cleanupRendererCase } from '../../setup/rendererCaseBootstrap';
import { enableCustomPageMode, openPrintDrawer } from '../../helpers/printTestHelpers';

const { configPrintDialog, button } = zhLocale;

describe('打印参数校验', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test('非法自定义页码格式时应提示错误', async () => {
    const { drawer, user } = await openPrintDrawer();
    await enableCustomPageMode(drawer, user);
    const pageInput = within(drawer).getByLabelText(configPrintDialog.pageNumber);

    fireEvent.change(pageInput, { target: { value: '1-5,8' } });
    fireEvent.blur(pageInput);

    await waitFor(() => {
      expect(within(drawer).getByText(configPrintDialog.pageNumberError)).toBeTruthy();
    });
  });

  test('无可用打印机时打印按钮应保持禁用', async () => {
    const { drawer } = await openPrintDrawer({
      mocks: {
        functions: {
          getPrinters: async () => ({ printers: [] }),
        },
      },
    });

    expect(within(drawer).getByRole('button', { name: button.print }).disabled).toBe(true);
  });

  test('页码错误时打印按钮应保持禁用', async () => {
    const { drawer, user } = await openPrintDrawer();
    await enableCustomPageMode(drawer, user);
    const pageInput = within(drawer).getByLabelText(configPrintDialog.pageNumber);

    fireEvent.change(pageInput, { target: { value: '3-1' } });
    fireEvent.blur(pageInput);

    await waitFor(() => {
      expect(within(drawer).getByText(configPrintDialog.pageNumberError)).toBeTruthy();
    });

    expect(within(drawer).getByRole('button', { name: button.print }).disabled).toBe(true);
  });

  test('合法页码范围时应允许继续打印', async () => {
    const { drawer, user } = await openPrintDrawer();
    await enableCustomPageMode(drawer, user);
    const pageInput = within(drawer).getByLabelText(configPrintDialog.pageNumber);

    fireEvent.change(pageInput, { target: { value: '3/1-2/2' } });
    fireEvent.blur(pageInput);

    await waitFor(() => {
      expect(within(drawer).queryByText(configPrintDialog.pageNumberError)).toBeNull();
    });

    const printButton = within(drawer).getByRole('button', { name: button.print });
    expect(printButton.disabled).toBe(false);

    await user.click(printButton);

    expect(within(drawer).queryByText(configPrintDialog.pageNumberError)).toBeNull();
    expect(printButton.disabled).toBe(false);
  });

  test('取消自定义页码模式后应隐藏页码输入并恢复打印范围下拉', async () => {
    const { drawer, user } = await openPrintDrawer();
    const [customPageCheckbox] = within(drawer).getAllByRole('checkbox');

    await enableCustomPageMode(drawer, user);
    expect(within(drawer).getByLabelText(configPrintDialog.pageNumber)).toBeTruthy();

    await user.click(customPageCheckbox);

    await waitFor(() => {
      expect(within(drawer).queryByLabelText(configPrintDialog.pageNumber)).toBeNull();
    });

    expect(within(drawer).getByRole('combobox', { name: configPrintDialog.printFilter })).toBeTruthy();
  });
});

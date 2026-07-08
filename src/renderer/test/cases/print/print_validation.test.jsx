// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import zhLocale from '../../../../main/locales/zh.json';
import { eleActions } from '../../../../shared/constants';
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

const enableCustomPageMode = async (drawer) => {
  const user = userEvent.setup();
  const [customPageCheckbox] = within(drawer).getAllByRole('checkbox');
  await user.click(customPageCheckbox);

  await waitFor(() => {
    expect(within(drawer).getByLabelText(configPrintDialog.pageNumber)).toBeTruthy();
  });

  return user;
};

describe('打印参数校验', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test('非法自定义页码格式时应提示错误', async () => {
    const { drawer } = await openPrintDrawer();
    await enableCustomPageMode(drawer);
    const pageInput = within(drawer).getByLabelText(configPrintDialog.pageNumber);

    fireEvent.change(pageInput, { target: { value: '1-5,8' } });
    fireEvent.blur(pageInput);

    await waitFor(() => {
      expect(within(drawer).getByText(configPrintDialog.pageNumberError)).toBeTruthy();
    });
  });

  test('页码错误时打印按钮应保持禁用', async () => {
    const { drawer } = await openPrintDrawer();
    await enableCustomPageMode(drawer);
    const pageInput = within(drawer).getByLabelText(configPrintDialog.pageNumber);

    fireEvent.change(pageInput, { target: { value: '3-1' } });
    fireEvent.blur(pageInput);

    await waitFor(() => {
      expect(within(drawer).getByText(configPrintDialog.pageNumberError)).toBeTruthy();
    });

    expect(within(drawer).getByRole('button', { name: button.print }).disabled).toBe(true);
  });

  test('合法页码范围时应允许继续打印', async () => {
    const callMainMock = vi.fn(async (key) => {
      switch (key) {
        case eleActions.loadPrintConfig:
          return { printConfig: {} };
        case eleActions.savePrintConfig:
        case eleActions.adjustGuidePrint:
        case eleActions.printPages:
          return true;
        default:
          return {};
      }
    });

    const { drawer } = await openPrintDrawer({
      mocks: {
        functions: {
          callMain: callMainMock,
        },
      },
    });
    const user = await enableCustomPageMode(drawer);
    const pageInput = within(drawer).getByLabelText(configPrintDialog.pageNumber);

    fireEvent.change(pageInput, { target: { value: '3/1-2/2' } });
    fireEvent.blur(pageInput);

    await waitFor(() => {
      expect(within(drawer).queryByText(configPrintDialog.pageNumberError)).toBeNull();
    });

    const printButton = within(drawer).getByRole('button', { name: button.print });
    expect(printButton.disabled).toBe(false);

    await user.click(printButton);

    await waitFor(() => {
      expect(callMainMock).toHaveBeenCalledWith(
        eleActions.printPages,
        expect.objectContaining({
          pageList: [1, 2, 3],
          printConfig: expect.objectContaining({
            paperSize: 'A4',
            paperWidthMm: 210,
            paperHeightMm: 297,
          }),
        }),
      );
    });
  });
});


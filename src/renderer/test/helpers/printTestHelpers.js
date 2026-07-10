import { waitFor, within, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';
import zhLocale from '../../../main/locales/zh.json';
import { bootstrapMenuBarCase, renderMenuBar } from './toolbarTestHelpers';

const { toolbar, configPrintDialog } = zhLocale;

export const renderToolbarWithRealPrintDrawer = async (options = {}) => {
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

export const openPrintDrawer = async (options = {}) => {
  const page = await renderToolbarWithRealPrintDrawer(options);
  const user = userEvent.setup();

  await page.menu.clickButton(toolbar.print);

  const drawer = document.querySelector('.print-drawer');
  if (!drawer) {
    throw new Error('Print drawer did not render');
  }

  await waitFor(() => {
    expect(within(drawer).getByRole('combobox', { name: configPrintDialog.targetPrinter })).toBeTruthy();
  });

  return { page, user, drawer };
};

export const openGuideDialog = async (options = {}) => {
  const { drawer, user } = await openPrintDrawer(options);

  await user.click(within(drawer).getByRole('button', { name: configPrintDialog.adjustOffsetGuide }));

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: configPrintDialog.adjustOffsetGuide })).toBeTruthy();
  });

  return { drawer, user };
};

export const enableCustomPageMode = async (drawer, user = userEvent.setup()) => {
  const [customPageCheckbox] = within(drawer).getAllByRole('checkbox');
  await user.click(customPageCheckbox);

  await waitFor(() => {
    expect(within(drawer).getByLabelText(configPrintDialog.pageNumber)).toBeTruthy();
  });

  return user;
};

export const setPageRange = async (drawer, user, start, end) => {
  const rangeStartInput = within(drawer).getByRole('spinbutton', { name: configPrintDialog.pageRange });
  const rangeEndInput = within(drawer).getAllByRole('spinbutton')[1];

  await user.clear(rangeStartInput);
  await user.type(rangeStartInput, `${start}`);
  rangeStartInput.blur();

  await user.clear(rangeEndInput);
  await user.type(rangeEndInput, `${end}`);
  rangeEndInput.blur();
};

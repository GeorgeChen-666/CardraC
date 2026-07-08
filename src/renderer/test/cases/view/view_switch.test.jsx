// @vitest-environment jsdom

import React from 'react';
import { waitFor } from '@testing-library/react';
import { afterEach, describe, test } from 'vitest';
import zhLocale from '../../../../main/locales/zh.json';
import { MainPage } from '../../pages/MainPage';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../../setup/rendererCaseBootstrap';

const footerSummaryText = `${zhLocale.footer.files} 1 / ${zhLocale.footer.images} 1`;

const editView = {
  body: {
    visibleTestIds: ['card-list'],
    hiddenTestIds: ['print-preview'],
  },
  menu: {
    visibleTexts: [zhLocale.toolbar.lblShowOverviewWindow, zhLocale.toolbar.lblViewFrontLarge],
    hiddenButtons: [zhLocale.toolbar.btnPrev, zhLocale.toolbar.btnNext],
    hiddenTextboxesCount: 0,
  },
  footer: {
    currentView: zhLocale.footer.editView,
    summaryText: footerSummaryText,
    visibleButtons: [zhLocale.footer.editView, zhLocale.footer.previewView],
  },
};

const previewView = {
  body: {
    visibleTestIds: ['print-preview'],
    hiddenTestIds: ['card-list'],
  },
  menu: {
    visibleButtons: [zhLocale.toolbar.btnPrev, zhLocale.toolbar.btnNext],
    visibleTextboxesCount: 1,
    hiddenTexts: [zhLocale.toolbar.lblShowOverviewWindow, zhLocale.toolbar.lblViewFrontLarge, zhLocale.toolbar.lblViewBackLarge],
  },
  footer: {
    currentView: zhLocale.footer.previewView,
    summaryText: footerSummaryText,
    visibleButtons: [zhLocale.footer.editView, zhLocale.footer.previewView],
  },
};

describe('视图切换', () => {
  afterEach(() => {
    cleanupRendererCase();
  });

  const renderMainPage = async (initialView) => {
    bootstrapRendererCase({ currentView: initialView });
    const { Main } = await import('../../../parts/Main');

    renderRendererCase(<Main />);
    return new MainPage();
  };

  const waitForPageMatch = async (page, expectation) => {
    await waitFor(() => {
      page.assertMatches(expectation);
    });
  };

  test('编辑模式切换到预览模式时，界面应切换到预览视图', async () => {
    const page = await renderMainPage('edit');

    await page.footer.switchView(zhLocale.footer.previewView);

    await waitForPageMatch(page, previewView);
  });

  test('预览模式下再次点击预览时，界面不应发生变化', async () => {
    const page = await renderMainPage('preview');

    await waitForPageMatch(page, previewView);

    await page.footer.switchView(zhLocale.footer.previewView);

    await waitForPageMatch(page, previewView);
  });

  test('预览模式切换回编辑模式时，界面应切换到编辑视图', async () => {
    const page = await renderMainPage('preview');

    await waitForPageMatch(page, previewView);

    await page.footer.switchView(zhLocale.footer.editView);

    await waitForPageMatch(page, editView);
  });
});
















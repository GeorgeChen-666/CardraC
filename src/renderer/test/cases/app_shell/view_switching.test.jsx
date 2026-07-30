// @vitest-environment jsdom

import React from 'react';
import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import zhLocale from '../../../../main/locales/zh.json';
import { MainPage } from '../../pages/MainPage';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../../setup/rendererCaseBootstrap';

const footerSummaryText = `${zhLocale.footer.files} 1 / ${zhLocale.footer.images} 1`;

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

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
    const rendererFunctions = await import('../../../functions');

    await page.footer.switchView(zhLocale.footer.previewView);

    await waitForPageMatch(page, previewView);
    expect(rendererFunctions.getExportPageCount).toHaveBeenCalledTimes(2);
    expect(rendererFunctions.clearPreviewCache).toHaveBeenCalledTimes(1);
  });

  test('预览模式下再次点击预览时，界面不应发生变化', async () => {
    const page = await renderMainPage('preview');
    const rendererFunctions = await import('../../../functions');

    await waitForPageMatch(page, previewView);

    await page.footer.switchView(zhLocale.footer.previewView);

    await waitForPageMatch(page, previewView);
    expect(rendererFunctions.getExportPageCount).toHaveBeenCalledTimes(2);
    expect(rendererFunctions.clearPreviewCache).toHaveBeenCalledTimes(1);
  });

  test('预览模式切换回编辑模式时，界面应切换到编辑视图', async () => {
    const page = await renderMainPage('preview');

    await waitForPageMatch(page, previewView);

    await page.footer.switchView(zhLocale.footer.editView);

    await waitForPageMatch(page, editView);
  });

  test('切换视图时应等待导出页数和预览缓存清理完成后再更新 currentView', async () => {
    const getCountDeferred = createDeferred();
    const clearCacheDeferred = createDeferred();
    const callSequence = [];

    bootstrapRendererCase({
      currentView: 'edit',
      mocks: {
        functions: {
          getExportPageCount: vi.fn(async () => {
            callSequence.push('getExportPageCount:start');
            const result = await getCountDeferred.promise;
            callSequence.push('getExportPageCount:end');
            return result;
          }),
          clearPreviewCache: vi.fn(async () => {
            callSequence.push('clearPreviewCache:start');
            const result = await clearCacheDeferred.promise;
            callSequence.push('clearPreviewCache:end');
            return result;
          }),
        },
      },
    });
    const { Main } = await import('../../../parts/Main');
    const { useGlobalStore } = await import('../../../state/store');
    renderRendererCase(<Main />);
    const page = new MainPage();

    const switchPromise = page.footer.switchView(zhLocale.footer.previewView);

    await waitFor(() => {
      expect(callSequence).toEqual(['getExportPageCount:start']);
    });
    expect(useGlobalStore.getState().Global.currentView).toBe('edit');

    getCountDeferred.resolve(5);

    await waitFor(() => {
      expect(callSequence).toEqual(['getExportPageCount:start', 'getExportPageCount:end', 'clearPreviewCache:start']);
    });
    expect(useGlobalStore.getState().Global.currentView).toBe('edit');

    clearCacheDeferred.resolve(true);
    await switchPromise;

    await waitFor(() => {
      expect(useGlobalStore.getState().Global.currentView).toBe('preview');
    });
    expect(callSequence.slice(0, 4)).toEqual([
      'getExportPageCount:start',
      'getExportPageCount:end',
      'clearPreviewCache:start',
      'clearPreviewCache:end',
    ]);
  });
});
















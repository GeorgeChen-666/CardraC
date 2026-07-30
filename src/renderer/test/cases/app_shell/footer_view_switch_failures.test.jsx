// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import zhLocale from '../../../../main/locales/zh.json';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../../setup/rendererCaseBootstrap';
import { useGlobalStore } from '../../../state/store';

const { footer: t } = zhLocale;

const { footerRejectCollector } = vi.hoisted(() => ({
  footerRejectCollector: [],
}));

vi.mock('../../../componments/ChipToggleGroup', async () => {
  const ReactModule = await import('react');

  return {
    ChipToggleGroup: ({ options, value, onChange }) => ReactModule.createElement(
      'div',
      { 'data-testid': 'chip-toggle-group' },
      options.map((option) => ReactModule.createElement('button', {
        key: option.value,
        type: 'button',
        'data-current': value === option.value ? 'true' : 'false',
        onClick: () => {
          Promise.resolve(onChange(option.value)).catch((error) => {
            footerRejectCollector.push(error);
          });
        },
      }, option.label)),
    ),
  };
});

const renderFooterScene = async ({ currentView = 'edit', mocks } = {}) => {
  bootstrapRendererCase({
    currentView,
    mocks,
  });

  const { Footer } = await import('../../../parts/Footer');
  renderRendererCase(<Footer />);
};

describe('Footer 视图切换失败路径', () => {
  afterEach(() => {
    footerRejectCollector.length = 0;
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test('获取导出页数失败时不应清理预览缓存，也不应切换视图', async () => {
    const clearPreviewCacheMock = vi.fn(async () => true);

    await renderFooterScene({
      currentView: 'edit',
      mocks: {
        functions: {
          getExportPageCount: vi.fn(async () => {
            throw new Error('get-count-failed');
          }),
          clearPreviewCache: clearPreviewCacheMock,
        },
      },
    });
    const rendererFunctions = await import('../../../functions');

    screen.getByRole('button', { name: t.previewView }).click();

    await waitFor(() => {
      expect(footerRejectCollector).toHaveLength(1);
    });
    expect(footerRejectCollector[0]?.message).toBe('get-count-failed');
    expect(rendererFunctions.getExportPageCount).toHaveBeenCalledTimes(1);
    expect(clearPreviewCacheMock).not.toHaveBeenCalled();
    expect(useGlobalStore.getState().Global.currentView).toBe('edit');
    expect(useGlobalStore.getState().Global.exportPageCount).toBe(2);
  });

  test('清理预览缓存失败时不应切换视图，但应保留已更新的页数', async () => {
    const getExportPageCountMock = vi.fn(async () => 7);

    await renderFooterScene({
      currentView: 'edit',
      mocks: {
        functions: {
          getExportPageCount: getExportPageCountMock,
          clearPreviewCache: vi.fn(async () => {
            throw new Error('clear-cache-failed');
          }),
        },
      },
    });
    const rendererFunctions = await import('../../../functions');

    screen.getByRole('button', { name: t.previewView }).click();

    await waitFor(() => {
      expect(footerRejectCollector).toHaveLength(1);
    });
    expect(footerRejectCollector[0]?.message).toBe('clear-cache-failed');
    expect(getExportPageCountMock).toHaveBeenCalledTimes(1);
    expect(rendererFunctions.clearPreviewCache).toHaveBeenCalledTimes(1);
    expect(useGlobalStore.getState().Global.currentView).toBe('edit');
    expect(useGlobalStore.getState().Global.exportPageCount).toBe(7);
  });
});


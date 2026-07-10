// @vitest-environment jsdom

import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import zhLocale from '../../../../main/locales/zh.json';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../../setup/rendererCaseBootstrap';

const renderPreviewToolbar = async ({
  previewRef = {
    current: {
      zoomOut: vi.fn(),
      zoomIn: vi.fn(),
      fitToContainer: vi.fn(),
    },
  },
  state,
} = {}) => {
  bootstrapRendererCase({
    currentView: 'preview',
    state: {
      Global: {
        exportPageCount: 4,
        exportPreviewIndex: 3,
      },
      ...(state || {}),
    },
  });

  const rendererFunctions = await import('../../../functions');
  const { useGlobalStore } = await import('../../../state/store');
  const { PreviewToolbar } = await import('../../../parts/preview/ToolBar');
  renderRendererCase(<PreviewToolbar previewRef={previewRef} />);

  return { previewRef, rendererFunctions, useGlobalStore };
};

describe('PreviewToolbar 组件行为', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test('挂载后应将预览页重置到第 1 页', async () => {
    await renderPreviewToolbar();

    await waitFor(() => {
      expect(screen.getByRole('textbox').value).toBe('1');
    });
  });

  test('有卡片数据时挂载应请求导出页数', async () => {
    const { rendererFunctions } = await renderPreviewToolbar();

    await waitFor(() => {
      expect(rendererFunctions.getExportPageCount).toHaveBeenCalledTimes(1);
    });
  });

  test('卡片列表为空时挂载不应请求导出页数', async () => {
    const { rendererFunctions } = await renderPreviewToolbar({
      state: {
        CardList: [],
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('textbox').value).toBe('1');
    });

    expect(rendererFunctions.getExportPageCount).not.toHaveBeenCalled();
  });

  test('点击缩放按钮时应调用 previewRef 对应方法', async () => {
    const previewRef = {
      current: {
        zoomOut: vi.fn(),
        zoomIn: vi.fn(),
        fitToContainer: vi.fn(),
      },
    };
    await renderPreviewToolbar({ previewRef });

    fireEvent.click(screen.getByRole('button', { name: zhLocale.toolbar.zoomOut }));
    fireEvent.click(screen.getByRole('button', { name: zhLocale.toolbar.zoomIn }));
    fireEvent.click(screen.getByRole('button', { name: zhLocale.toolbar.zoomFix }));

    expect(previewRef.current.zoomOut).toHaveBeenCalledTimes(1);
    expect(previewRef.current.zoomIn).toHaveBeenCalledTimes(1);
    expect(previewRef.current.fitToContainer).toHaveBeenCalledTimes(1);
  });

  test('通过页码输入跳转时应更新 exportPreviewIndex', async () => {
    const { useGlobalStore } = await renderPreviewToolbar({
      state: {
        Global: {
          exportPageCount: 4,
          exportPreviewIndex: 2,
        },
      },
    });

    const input = screen.getByRole('textbox');

    await waitFor(() => {
      expect(input.value).toBe('1');
    });

    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(useGlobalStore.getState().Global.exportPreviewIndex).toBe(4);
    });
  });
});



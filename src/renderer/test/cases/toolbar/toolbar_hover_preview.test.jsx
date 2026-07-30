// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import zhLocale from '../../../../main/locales/zh.json';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../../setup/rendererCaseBootstrap';
import { useUiRuntimeStore } from '../../../state/uiRuntimeStore';

const { toolbar: t } = zhLocale;

const renderToolbarWithActualImageViewer = async ({ state } = {}) => {
  bootstrapRendererCase({
    currentView: 'edit',
    state: {
      Global: {
        imageVersion: 9,
      },
      Config: {
        globalBackground: { path: 'hover-bg.png', mtime: 10, ext: 'png' },
      },
      ...state,
    },
    mocks: {
      components: {
        ImageViewer: 'actual',
      },
    },
  });

  const { EditToolbar } = await import('../../../parts/edit/Toolbar');
  return renderRendererCase(<EditToolbar />);
};

describe('工具栏全局背景预览', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test('悬停全局背景按钮时应打开预览并在移出时关闭', async () => {
    await renderToolbarWithActualImageViewer();

    const button = await screen.findByRole('button', { name: t.btnGlobalBack });
    fireEvent.mouseOver(button);

    await waitFor(() => {
      expect(document.getElementById('ImageViewer')).toBeTruthy();
    });
    expect(document.querySelector('#ImageViewer img')?.getAttribute('src')).toBe('cardrac://image/hover-bg.png?quality=auto&version=9');

    fireEvent.mouseLeave(button);

    await waitFor(() => {
      expect(document.getElementById('ImageViewer')).toBeNull();
    });
  });

  test('挂载时应注册 imageViewerApi，卸载时应清空', async () => {
    const { unmount } = await renderToolbarWithActualImageViewer();

    await waitFor(() => {
      expect(useUiRuntimeStore.getState().imageViewerApi).toEqual(expect.objectContaining({
        update: expect.any(Function),
        close: expect.any(Function),
      }));
    });

    unmount();

    await waitFor(() => {
      expect(useUiRuntimeStore.getState().imageViewerApi).toBeNull();
    });
  });
});


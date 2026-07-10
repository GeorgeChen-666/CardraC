// @vitest-environment jsdom

import React, { createRef } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../../../setup/rendererCaseBootstrap';

const renderImageViewer = async ({ global } = {}) => {
  bootstrapRendererCase({
    currentView: 'edit',
    state: {
      Global: {
        isShowOverView: true,
        imageVersion: 7,
        ...global,
      },
    },
    mocks: {
      components: {
        ImageViewer: 'actual',
      },
    },
  });

  const { ImageViewer } = await import('../../../../parts/edit/ImageViewer');
  const ref = createRef();
  renderRendererCase(<ImageViewer ref={ref} />);
  return ref;
};

describe('ImageViewer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    cleanupRendererCase();
  });

  test('应支持通过 update 打开放大预览、切换图片并通过 close 关闭', async () => {
    const ref = await renderImageViewer();

    await act(async () => {
      await ref.current.update('face-standalone.png');
    });

    await waitFor(() => {
      expect(document.getElementById('ImageViewer')).toBeTruthy();
    });
    expect(screen.getByRole('img').getAttribute('src')).toBe('cardrac://image/face-standalone.png?quality=auto&version=7');

    await act(async () => {
      await ref.current.update('back-standalone.png');
    });

    await waitFor(() => {
      expect(screen.getByRole('img').getAttribute('src')).toBe('cardrac://image/back-standalone.png?quality=auto&version=7');
    });

    await act(async () => {
      ref.current.close();
    });

    await waitFor(() => {
      expect(document.getElementById('ImageViewer')).toBeNull();
    });
  });

  test('总开关关闭或传入空路径时不应打开预览', async () => {
    const hiddenRef = await renderImageViewer({
      global: {
        isShowOverView: false,
      },
    });

    await act(async () => {
      await hiddenRef.current.update('face-standalone.png');
    });

    expect(document.getElementById('ImageViewer')).toBeNull();

    cleanup();
    cleanupRendererCase();

    const emptyPathRef = await renderImageViewer();

    await act(async () => {
      await emptyPathRef.current.update('');
    });

    expect(document.getElementById('ImageViewer')).toBeNull();
  });
});





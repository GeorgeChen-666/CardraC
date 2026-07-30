// @vitest-environment jsdom

import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import zhLocale from '../../../../../main/locales/zh.json';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../../../setup/rendererCaseBootstrap';

const createDomRect = ({ width, height, left = 0, top = 0 }) => ({
  width,
  height,
  left,
  top,
  right: left + width,
  bottom: top + height,
  x: left,
  y: top,
});

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

const setupMainPreviewScene = async ({
  exportPreviewIndex = 3,
  exportPageCount = 3,
  getExportPreviewImpl = vi.fn(async ({ pageIndex }) => `data:image/png;base64,page-${pageIndex}`),
} = {}) => {
  bootstrapRendererCase({
    currentView: 'preview',
    state: {
      Global: {
        exportPreviewIndex,
        exportPageCount,
        imageVersion: 1,
      },
    },
    mocks: {
      components: {
        PrintPreview: 'actual',
      },
      functions: {
        getExportPreview: getExportPreviewImpl,
      },
    },
  });

  const { useGlobalStore } = await import('../../../../state/store');
  const { Main } = await import('../../../../parts/Main');
  const renderResult = renderRendererCase(<Main />);

  const previewImage = await screen.findByAltText('Preview');
  const previewContainer = renderResult.container.querySelector('.PrintPreviewContainer');
  previewContainer.getBoundingClientRect = () => createDomRect({ width: 800, height: 600 });

  Object.defineProperty(previewImage, 'naturalWidth', {
    configurable: true,
    value: 400,
  });
  Object.defineProperty(previewImage, 'naturalHeight', {
    configurable: true,
    value: 200,
  });

  fireEvent.load(previewImage);

  await waitFor(() => {
    expect(previewImage.style.transform).toContain('translate(0px, 100px) scale(2)');
  });

  return {
    useGlobalStore,
    getExportPreviewImpl,
    previewImage,
    previewContainer,
    ...renderResult,
  };
};

describe('Main preview 集成联动', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test('Toolbar 缩放按钮应通过 shared previewRef 驱动真实 PrintPreview', async () => {
    const { previewImage } = await setupMainPreviewScene();

    fireEvent.click(screen.getByRole('button', { name: zhLocale.toolbar.zoomIn }));

    await waitFor(() => {
      expect(previewImage.style.transform).toContain('scale(2.1)');
    });

    fireEvent.click(screen.getByRole('button', { name: zhLocale.toolbar.zoomOut }));

    await waitFor(() => {
      expect(previewImage.style.transform).toContain('scale(2)');
    });
  });

  test('Toolbar 页码跳转后应驱动 store 与真实预览重新取图', async () => {
    const getExportPreviewImpl = vi.fn(async ({ pageIndex }) => `data:image/png;base64,page-${pageIndex}`);
    const { previewImage, useGlobalStore } = await setupMainPreviewScene({
      exportPreviewIndex: 3,
      getExportPreviewImpl,
    });

    await waitFor(() => {
      expect(useGlobalStore.getState().Global.exportPreviewIndex).toBe(1);
      expect(getExportPreviewImpl).toHaveBeenCalledWith(expect.objectContaining({ pageIndex: 1 }));
    });

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(useGlobalStore.getState().Global.exportPreviewIndex).toBe(2);
      expect(getExportPreviewImpl).toHaveBeenLastCalledWith(expect.objectContaining({ pageIndex: 2 }));
      expect(previewImage.getAttribute('src')).toBe('data:image/png;base64,page-2');
    });
  });

  test('PrintPreview 中 Shift+wheel 翻页后，Toolbar 输入框应同步更新', async () => {
    const getExportPreviewImpl = vi.fn(async ({ pageIndex }) => `data:image/png;base64,page-${pageIndex}`);
    const { previewContainer, previewImage, useGlobalStore } = await setupMainPreviewScene({
      exportPreviewIndex: 1,
      getExportPreviewImpl,
    });

    const input = screen.getByRole('textbox');
    expect(input.value).toBe('1');

    fireEvent.wheel(previewContainer, { deltaY: 120, shiftKey: true });

    await waitFor(() => {
      expect(useGlobalStore.getState().Global.exportPreviewIndex).toBe(2);
      expect(screen.getByRole('textbox').value).toBe('2');
      expect(getExportPreviewImpl).toHaveBeenLastCalledWith(expect.objectContaining({ pageIndex: 2 }));
      expect(previewImage.getAttribute('src')).toBe('data:image/png;base64,page-2');
    });
  });

  test('Toolbar 快速改页且预览乱序返回时，应保持最后一次选中的页码与预览结果', async () => {
    const page2Deferred = createDeferred();
    const page3Deferred = createDeferred();
    const getExportPreviewImpl = vi.fn(({ pageIndex }) => {
      if (pageIndex === 2) return page2Deferred.promise;
      if (pageIndex === 3) return page3Deferred.promise;
      return Promise.resolve(`data:image/png;base64,page-${pageIndex}`);
    });
    const { previewImage, useGlobalStore } = await setupMainPreviewScene({
      exportPreviewIndex: 1,
      exportPageCount: 4,
      getExportPreviewImpl,
    });

    const input = screen.getByRole('textbox');
    expect(input.value).toBe('1');

    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(useGlobalStore.getState().Global.exportPreviewIndex).toBe(2);
      expect(getExportPreviewImpl).toHaveBeenLastCalledWith(expect.objectContaining({ pageIndex: 2 }));
    });

    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(useGlobalStore.getState().Global.exportPreviewIndex).toBe(3);
      expect(getExportPreviewImpl).toHaveBeenLastCalledWith(expect.objectContaining({ pageIndex: 3 }));
      expect(screen.getByRole('textbox').value).toBe('3');
    });

    await Promise.resolve();

    page3Deferred.resolve('data:image/png;base64,page-3');
    await page3Deferred.promise;

    await waitFor(() => {
      expect(previewImage.getAttribute('src')).toBe('data:image/png;base64,page-3');
    });

    page2Deferred.resolve('data:image/png;base64,page-2-stale');
    await page2Deferred.promise;

    await waitFor(() => {
      expect(useGlobalStore.getState().Global.exportPreviewIndex).toBe(3);
      expect(screen.getByRole('textbox').value).toBe('3');
      expect(previewImage.getAttribute('src')).toBe('data:image/png;base64,page-3');
    });
  });
});


// @vitest-environment jsdom

import React, { createRef } from 'react';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import zhLocale from '../../../../main/locales/zh.json';
import { emptyImg } from '../../../../shared/constants';
import { layoutSides } from '../../../../shared/constants';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../../setup/rendererCaseBootstrap';

const originalResizeObserver = globalThis.ResizeObserver;
const originalImage = globalThis.Image;

if (typeof ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    constructor() {
      this.observe = () => {};
      this.unobserve = () => {};
      this.disconnect = () => {};
    }
  };
}

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

const installResizeObserverMock = () => {
  const instances = [];

  class ResizeObserverMock {
    constructor(callback) {
      this.callback = callback;
      this.observe = vi.fn();
      this.unobserve = vi.fn();
      this.disconnect = vi.fn();
      instances.push(this);
    }

    trigger(entries = [{ target: null }]) {
      this.callback(entries, this);
    }
  }

  globalThis.ResizeObserver = ResizeObserverMock;

  return {
    instances,
    restore: () => {
      globalThis.ResizeObserver = originalResizeObserver;
    },
  };
};

const installImageMock = () => {
  const instances = [];

  class ImageMock {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this._src = '';
      instances.push(this);
    }

    set src(value) {
      this._src = value;
    }

    get src() {
      return this._src;
    }
  }

  globalThis.Image = ImageMock;

  return {
    instances,
    restore: () => {
      globalThis.Image = originalImage;
    },
  };
};

const installClipboardMock = ({
  writeText = vi.fn(async () => undefined),
  readText = vi.fn(async () => ''),
} = {}) => {
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText,
      readText,
    },
  });

  return { writeText, readText };
};

const setupBitmapPreview = async (options = {}) => {
  const {
    containerRect = { width: 800, height: 600, left: 0, top: 0 },
    ...renderOptions
  } = options;
  const renderResult = await renderPrintPreview(renderOptions);
  const previewImage = await screen.findByAltText('Preview');
  const previewContainer = renderResult.container.querySelector('.PrintPreviewContainer');

  previewContainer.getBoundingClientRect = () => createDomRect(containerRect);

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

  return { previewImage, previewContainer, containerRect, ...renderResult };
};

const renderPrintPreview = async ({
  exportPreviewIndex = 1,
  exportPageCount = 3,
  imageVersion = 1,
  getExportPreviewImpl = vi.fn(async () => 'data:image/png;base64,preview'),
  state,
} = {}) => {
  const stateOverrides = state || {};
  bootstrapRendererCase({
    currentView: 'preview',
    state: {
      ...stateOverrides,
      Global: {
        exportPageCount,
        exportPreviewIndex,
        imageVersion,
        ...(stateOverrides.Global || {}),
      },
      Config: {
        sides: layoutSides.doubleSides,
        ...(stateOverrides.Config || {}),
      },
    },
    mocks: {
      functions: {
        getExportPreview: getExportPreviewImpl,
      },
    },
  });

  const { useGlobalStore } = await import('../../../state/store');
  const { PrintPreview } = await vi.importActual('../../../parts/preview/PrintPreview/index.jsx');
  const previewRef = createRef();
  const renderResult = renderRendererCase(<PrintPreview ref={previewRef} />);

  return { previewRef, getExportPreviewImpl, useGlobalStore, ...renderResult };
};

describe('PrintPreview 组件行为', () => {
  afterEach(() => {
    globalThis.Image = originalImage;
    globalThis.ResizeObserver = originalResizeObserver;
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanup();
    cleanupRendererCase();
  });

  test('异步获取预览时应先显示 Loading，完成后再渲染图片', async () => {
    const deferred = createDeferred();
    const getExportPreviewImpl = vi.fn(() => deferred.promise);
    await renderPrintPreview({ getExportPreviewImpl });

    expect(screen.getByText('Loading...')).toBeTruthy();
    expect(screen.queryByAltText('Preview')).toBeNull();

    await act(async () => {
      deferred.resolve('data:image/png;base64,preview');
      await deferred.promise;
    });

    expect(await screen.findByAltText('Preview')).toBeTruthy();
    expect(screen.queryByText('Loading...')).toBeNull();
  });

  test('加载位图预览后应适应容器，并在滚轮缩放时更新 scale', async () => {
    const { previewImage, previewContainer } = await setupBitmapPreview();

    fireEvent.wheel(previewContainer, {
      deltaY: -120,
      clientX: 400,
      clientY: 300,
    });

    await waitFor(() => {
      expect(previewImage.style.transform).toContain('scale(2.1)');
    });
  });

  test('ref API 应支持缩放上下限与状态查询', async () => {
    const { previewRef } = await setupBitmapPreview();

    await waitFor(() => {
      expect(previewRef.current.getScale()).toBeCloseTo(2, 5);
      expect(previewRef.current.canZoomIn()).toBe(true);
      expect(previewRef.current.canZoomOut()).toBe(true);
    });

    act(() => {
      for (let i = 0; i < 40; i += 1) {
        previewRef.current.zoomIn();
      }
    });

    await waitFor(() => {
      expect(previewRef.current.getScale()).toBeCloseTo(5, 5);
      expect(previewRef.current.canZoomIn()).toBe(false);
      expect(previewRef.current.canZoomOut()).toBe(true);
    });

    act(() => {
      for (let i = 0; i < 60; i += 1) {
        previewRef.current.zoomOut();
      }
    });

    await waitFor(() => {
      expect(previewRef.current.getScale()).toBeCloseTo(0.1, 5);
      expect(previewRef.current.canZoomOut()).toBe(false);
      expect(previewRef.current.canZoomIn()).toBe(true);
    });
  });

  test('按住 Shift 滚轮时应切换预览页码', async () => {
    const { container, useGlobalStore } = await renderPrintPreview({ exportPreviewIndex: 1 });

    await screen.findByAltText('Preview');
    const previewContainer = container.querySelector('.PrintPreviewContainer');
    fireEvent.wheel(previewContainer, { deltaY: 120, shiftKey: true });

    await waitFor(() => {
      expect(useGlobalStore.getState().Global.exportPreviewIndex).toBe(2);
    });
  });

  test('按住 Shift 滚轮翻页时应受第一页和最后一页边界限制', async () => {
    const { container, useGlobalStore } = await renderPrintPreview({
      exportPreviewIndex: 1,
      exportPageCount: 3,
    });

    await screen.findByAltText('Preview');
    const previewContainer = container.querySelector('.PrintPreviewContainer');

    fireEvent.wheel(previewContainer, { deltaY: -120, shiftKey: true });

    await waitFor(() => {
      expect(useGlobalStore.getState().Global.exportPreviewIndex).toBe(1);
    });

    await act(async () => {
      useGlobalStore.getState().mergeGlobal({ exportPreviewIndex: 3 });
    });

    fireEvent.wheel(previewContainer, { deltaY: 120, shiftKey: true });

    await waitFor(() => {
      expect(useGlobalStore.getState().Global.exportPreviewIndex).toBe(3);
    });
  });

  test('exportPreviewIndex 与 imageVersion 变化时应重新获取预览', async () => {
    const getExportPreviewImpl = vi.fn(async ({ pageIndex }) => `data:image/png;base64,preview-${pageIndex}`);
    const { useGlobalStore } = await renderPrintPreview({ getExportPreviewImpl });

    await screen.findByAltText('Preview');

    await waitFor(() => {
      expect(getExportPreviewImpl).toHaveBeenCalledTimes(1);
      expect(getExportPreviewImpl.mock.calls[0][0]).toMatchObject({ pageIndex: 1 });
    });

    await act(async () => {
      useGlobalStore.getState().mergeGlobal({ exportPreviewIndex: 2 });
    });

    await waitFor(() => {
      expect(getExportPreviewImpl).toHaveBeenCalledTimes(2);
      expect(getExportPreviewImpl.mock.calls[1][0]).toMatchObject({ pageIndex: 2 });
    });

    await act(async () => {
      useGlobalStore.getState().mergeGlobal({ imageVersion: 2 });
    });

    await waitFor(() => {
      expect(getExportPreviewImpl).toHaveBeenCalledTimes(3);
      expect(getExportPreviewImpl.mock.calls[2][0]).toMatchObject({ pageIndex: 2 });
    });
  });

  test('慢请求乱序返回时，旧页预览不应覆盖最新页', async () => {
    const page1Deferred = createDeferred();
    const page2Deferred = createDeferred();
    const getExportPreviewImpl = vi.fn(({ pageIndex }) => {
      if (pageIndex === 1) return page1Deferred.promise;
      if (pageIndex === 2) return page2Deferred.promise;
      return Promise.resolve(`data:image/png;base64,preview-${pageIndex}`);
    });
    const { useGlobalStore } = await renderPrintPreview({
      exportPreviewIndex: 1,
      getExportPreviewImpl,
    });

    expect(screen.getByText('Loading...')).toBeTruthy();

    await act(async () => {
      useGlobalStore.getState().mergeGlobal({ exportPreviewIndex: 2 });
      await Promise.resolve();
    });

    await act(async () => {
      page2Deferred.resolve('data:image/png;base64,preview-page-2');
      await page2Deferred.promise;
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByAltText('Preview').getAttribute('src')).toBe('data:image/png;base64,preview-page-2');
    });

    await act(async () => {
      page1Deferred.resolve('data:image/png;base64,preview-page-1-stale');
      await page1Deferred.promise;
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByAltText('Preview').getAttribute('src')).toBe('data:image/png;base64,preview-page-2');
      expect(useGlobalStore.getState().Global.exportPreviewIndex).toBe(2);
    });
  });

  test('手动缩放后应支持拖拽平移，并可双击恢复适应容器', async () => {
    const { previewImage, previewContainer } = await setupBitmapPreview();

    fireEvent.wheel(previewContainer, {
      deltaY: -120,
      clientX: 400,
      clientY: 300,
    });

    await waitFor(() => {
      expect(previewImage.style.transform).toContain('translate(-20px, 90px) scale(2.1)');
    });

    fireEvent.mouseDown(previewContainer, {
      button: 0,
      clientX: 150,
      clientY: 140,
    });

    await waitFor(() => {
      expect(previewContainer.style.cursor).toBe('grabbing');
    });

    fireEvent.mouseMove(window, {
      clientX: 210,
      clientY: 230,
    });

    await waitFor(() => {
      expect(previewImage.style.transform).toContain('translate(40px, 180px) scale(2.1)');
    });

    fireEvent.mouseUp(window);

    await waitFor(() => {
      expect(previewContainer.style.cursor).toBe('grab');
    });

    fireEvent.doubleClick(previewContainer);

    await waitFor(() => {
      expect(previewImage.style.transform).toContain('translate(0px, 100px) scale(2)');
    });
  });

  test('非左键按下时不应进入拖拽状态或改变视图位置', async () => {
    const { previewImage, previewContainer } = await setupBitmapPreview();
    const initialTransform = previewImage.style.transform;

    fireEvent.mouseDown(previewContainer, {
      button: 1,
      clientX: 120,
      clientY: 120,
    });
    fireEvent.mouseMove(window, {
      clientX: 260,
      clientY: 260,
    });

    await waitFor(() => {
      expect(previewContainer.style.cursor).toBe('grab');
      expect(previewImage.style.transform).toBe(initialTransform);
    });
  });

  test('从 print-drawer 区域按下时不应开始拖拽', async () => {
    const { previewImage, previewContainer, container } = await setupBitmapPreview();
    const initialTransform = previewImage.style.transform;
    const drawer = document.createElement('div');
    drawer.className = 'print-drawer';
    container.querySelector('.PrintPreviewContainer').appendChild(drawer);

    fireEvent.mouseDown(drawer, {
      button: 0,
      clientX: 120,
      clientY: 120,
    });
    fireEvent.mouseMove(window, {
      clientX: 240,
      clientY: 240,
    });

    await waitFor(() => {
      expect(previewContainer.style.cursor).toBe('grab');
      expect(previewImage.style.transform).toBe(initialTransform);
    });
  });

  test('ResizeObserver 在未手动缩放时应自动 fit，手动缩放后不应覆盖用户视图', async () => {
    const resizeObserverMock = installResizeObserverMock();
    const { previewImage, previewContainer, containerRect } = await setupBitmapPreview({
      containerRect: { width: 800, height: 600, left: 0, top: 0 },
    });

    expect(resizeObserverMock.instances.length).toBeGreaterThan(0);

    containerRect.width = 400;
    containerRect.height = 300;
    resizeObserverMock.instances[0].trigger();

    await waitFor(() => {
      expect(previewImage.style.transform).toContain('translate(0px, 50px) scale(1)');
    });

    fireEvent.wheel(previewContainer, {
      deltaY: -120,
      clientX: 200,
      clientY: 150,
    });

    await waitFor(() => {
      expect(previewImage.style.transform).toContain('scale(1.1)');
      expect(previewImage.style.transform).toMatch(/translate\(-20(\.0+\d*)?px, 39\.9+\d*px\) scale\(1\.1\)|translate\(-20(\.0+\d*)?px, 40(\.0+\d*)?px\) scale\(1\.1\)/);
    });

    containerRect.width = 900;
    containerRect.height = 700;
    resizeObserverMock.instances[0].trigger();

    await waitFor(() => {
      expect(previewImage.style.transform).toContain('scale(1.1)');
      expect(previewImage.style.transform).toMatch(/translate\(-20(\.0+\d*)?px, 39\.9+\d*px\) scale\(1\.1\)|translate\(-20(\.0+\d*)?px, 40(\.0+\d*)?px\) scale\(1\.1\)/);
    });

    resizeObserverMock.restore();
  });

  test('SVG 高清替换缓存应在同版本复用，并在 imageVersion 变化后重新加载', async () => {
    vi.useFakeTimers();
    const imageMock = installImageMock();
    try {
      const getSvgMarkup = (page) => `
        <svg width="120" height="80" data-page="${page}" xmlns="http://www.w3.org/2000/svg">
          <image data-card-mark="0.face" href="cardrac://image/demo.png?quality=low" width="40" height="40" x="0" y="0" />
        </svg>
      `;
      const getExportPreviewImpl = vi.fn(async ({ pageIndex }) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(getSvgMarkup(pageIndex))}`);
      const { container, useGlobalStore } = await renderPrintPreview({
        getExportPreviewImpl,
        state: {
          CardList: [{ id: 'card-1', face: { path: 'demo.png' }, back: null, repeat: 1 }],
        },
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(container.querySelector('svg')).toBeTruthy();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
        await Promise.resolve();
      });

      expect(imageMock.instances).toHaveLength(1);
      expect(imageMock.instances[0].src).toContain('quality=high');

      await act(async () => {
        imageMock.instances[0].onload?.();
        await Promise.resolve();
      });

      expect(container.querySelector('svg')?.getAttribute('data-page')).toBe('1');
      expect(container.querySelector('image[data-card-mark="0.face"]')?.getAttribute('href')).toContain('quality=high');

      await act(async () => {
        useGlobalStore.getState().mergeGlobal({ exportPreviewIndex: 2 });
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(container.querySelector('svg')?.getAttribute('data-page')).toBe('2');
      expect(container.querySelector('image[data-card-mark="0.face"]')?.getAttribute('href')).toContain('quality=high');
      expect(imageMock.instances).toHaveLength(1);

      await act(async () => {
        useGlobalStore.getState().mergeGlobal({ imageVersion: 2 });
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(getExportPreviewImpl).toHaveBeenCalledTimes(3);
      expect(container.querySelector('svg')?.getAttribute('data-page')).toBe('2');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
        await Promise.resolve();
      });

      expect(imageMock.instances).toHaveLength(2);
      expect(imageMock.instances[1].src).toContain('quality=high');
    } finally {
      imageMock.restore();
    }
  });

  test('SVG 高清图加载失败后应按间隔重试，并在超过上限后停止', async () => {
    vi.useFakeTimers();
    const imageMock = installImageMock();
    try {
      const retryImagePath = 'retry-demo.png';
      const svgMarkup = `
        <svg width="120" height="80" xmlns="http://www.w3.org/2000/svg">
          <image data-card-mark="0.face" href="cardrac://image/${retryImagePath}?quality=low" width="40" height="40" x="0" y="0" />
        </svg>
      `;
      const { container } = await renderPrintPreview({
        imageVersion: 99,
        getExportPreviewImpl: vi.fn(async () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`),
        state: {
          CardList: [{ id: 'card-1', face: { path: retryImagePath }, back: null, repeat: 1 }],
        },
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(container.querySelector('svg')).toBeTruthy();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
        await Promise.resolve();
      });

      expect(imageMock.instances).toHaveLength(1);

      for (let i = 0; i < 10; i += 1) {
        await act(async () => {
          imageMock.instances[i].onerror?.();
          await vi.advanceTimersByTimeAsync(2000);
          await Promise.resolve();
        });
      }

      expect(imageMock.instances).toHaveLength(11);

      await act(async () => {
        imageMock.instances[10].onerror?.();
        await vi.advanceTimersByTimeAsync(2000);
        await Promise.resolve();
      });

      expect(imageMock.instances).toHaveLength(11);
    } finally {
      imageMock.restore();
    }
  });

  test('SVG 预览应渲染标尺，并支持 hover 高亮与右键菜单', async () => {
    const svgMarkup = `
      <svg width="120" height="80" xmlns="http://www.w3.org/2000/svg">
        <image data-card-mark="0.face" href="${emptyImg.path}" width="40" height="40" x="0" y="0" />
        <image data-card-mark="0.face" href="${emptyImg.path}" width="40" height="40" x="50" y="0" />
      </svg>
    `;
    const { container } = await renderPrintPreview({
      getExportPreviewImpl: vi.fn(async () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`),
    });

    await waitFor(() => {
      expect(container.querySelector('svg')).toBeTruthy();
    });

    expect(screen.queryByAltText('Preview')).toBeNull();
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2);

    const svgImages = container.querySelectorAll('[data-card-mark="0.face"]');
    expect(svgImages.length).toBe(2);

    fireEvent.mouseEnter(svgImages[0]);
    expect(svgImages[0].classList.contains('mouseHover')).toBe(true);
    expect(svgImages[1].classList.contains('mouseHover')).toBe(true);

    fireEvent.mouseLeave(svgImages[0]);
    expect(svgImages[0].classList.contains('mouseHover')).toBe(false);
    expect(svgImages[1].classList.contains('mouseHover')).toBe(false);

    fireEvent.contextMenu(svgImages[0], { clientX: 120, clientY: 140 });

    expect(await screen.findByRole('menuitem', { name: zhLocale.printPreview.contextMenu.copy })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: zhLocale.printPreview.contextMenu.paste })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: zhLocale.printPreview.contextMenu.clear })).toBeTruthy();
  });

  test('通过 PrintPreview 中的 SVG 右键菜单执行清空时，应更新卡片并清理预览缓存', async () => {
    const svgMarkup = `
      <svg width="120" height="80" xmlns="http://www.w3.org/2000/svg">
        <image data-card-mark="0.face" href="cardrac://image/demo.png?quality=low" width="40" height="40" x="0" y="0" />
      </svg>
    `;
    const rendererFunctions = await import('../../../functions');
    const { container, useGlobalStore } = await renderPrintPreview({
      getExportPreviewImpl: vi.fn(async () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`),
      state: {
        CardList: [{ id: 'card-1', face: { path: 'demo.png', ext: 'png', mtime: 1 }, back: null, repeat: 1 }],
      },
    });

    await waitFor(() => {
      expect(container.querySelector('svg')).toBeTruthy();
    });

    const svgImage = container.querySelector('image[data-card-mark="0.face"]');
    fireEvent.contextMenu(svgImage, { clientX: 120, clientY: 140 });
    fireEvent.click(await screen.findByRole('menuitem', { name: zhLocale.printPreview.contextMenu.clear }));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList[0].face).toBeNull();
      expect(rendererFunctions.clearPreviewCache).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: zhLocale.printPreview.contextMenu.clear })).toBeNull();
    });

    expect(rendererFunctions.getExportPageCount).not.toHaveBeenCalled();
  });

  test('通过 PrintPreview 中的 SVG 右键菜单执行粘贴时，应更新对应卡面并刷新页数', async () => {
    const pastedImage = { path: 'pasted-back.png', ext: 'png', mtime: 3 };
    const { readText } = installClipboardMock({
      readText: vi.fn(async () => JSON.stringify(pastedImage)),
    });
    const svgMarkup = `
      <svg width="120" height="80" xmlns="http://www.w3.org/2000/svg">
        <image data-card-mark="0.back" href="cardrac://image/back.png?quality=low" width="40" height="40" x="0" y="0" />
      </svg>
    `;
    const rendererFunctions = await import('../../../functions');
    const { container, useGlobalStore } = await renderPrintPreview({
      getExportPreviewImpl: vi.fn(async () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`),
      state: {
        CardList: [{ id: 'card-1', face: { path: 'face.png' }, back: { path: 'back.png' }, repeat: 1 }],
      },
    });

    await waitFor(() => {
      expect(container.querySelector('svg')).toBeTruthy();
    });

    fireEvent.contextMenu(container.querySelector('image[data-card-mark="0.back"]'), { clientX: 120, clientY: 140 });
    fireEvent.click(await screen.findByRole('menuitem', { name: zhLocale.printPreview.contextMenu.paste }));

    await waitFor(() => {
      expect(readText).toHaveBeenCalledTimes(1);
      expect(useGlobalStore.getState().CardList[0].back).toEqual(pastedImage);
      expect(rendererFunctions.clearPreviewCache).toHaveBeenCalledTimes(1);
      expect(rendererFunctions.getExportPageCount).toHaveBeenCalledTimes(1);
    });
  });

  test('通过 PrintPreview 中的 SVG 右键菜单执行替换时，应使用 openImage 返回数据更新对应 side', async () => {
    const replacementFace = { path: 'replacement.png', ext: 'png', mtime: 8 };
    const svgMarkup = `
      <svg width="120" height="80" xmlns="http://www.w3.org/2000/svg">
        <image data-card-mark="0.back" href="cardrac://image/back.png?quality=low" width="40" height="40" x="0" y="0" />
      </svg>
    `;
    const rendererFunctions = await import('../../../functions');
    rendererFunctions.openImage.mockResolvedValue([{ face: replacementFace, back: null }]);

    const { container, useGlobalStore } = await renderPrintPreview({
      getExportPreviewImpl: vi.fn(async () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`),
      state: {
        CardList: [{ id: 'card-1', face: { path: 'face.png' }, back: { path: 'back.png' }, repeat: 1 }],
      },
    });

    await waitFor(() => {
      expect(container.querySelector('svg')).toBeTruthy();
    });

    fireEvent.contextMenu(container.querySelector('image[data-card-mark="0.back"]'), { clientX: 120, clientY: 140 });
    fireEvent.click(await screen.findByRole('menuitem', { name: zhLocale.printPreview.contextMenu.replace }));

    await waitFor(() => {
      expect(rendererFunctions.openImage).toHaveBeenCalledWith(false, false);
      expect(useGlobalStore.getState().CardList[0].back).toEqual(replacementFace);
      expect(rendererFunctions.clearPreviewCache).toHaveBeenCalledTimes(1);
      expect(rendererFunctions.getExportPageCount).toHaveBeenCalledTimes(1);
    });
  });
});


















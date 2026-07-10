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

const installClipboard = ({
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

const createImageElement = (cardMark = '0.face') => {
  const imageElement = document.createElement('div');
  imageElement.dataset.cardMark = cardMark;
  return imageElement;
};

const renderImageContextMenu = async ({
  anchorPosition = { top: 100, left: 120 },
  imageElement = createImageElement(),
  state,
  onClose = vi.fn(),
} = {}) => {
  bootstrapRendererCase({
    currentView: 'preview',
    state,
  });

  const rendererFunctions = await import('../../../functions');
  const { useGlobalStore } = await import('../../../state/store');
  const { ImageContextMenu } = await import('../../../parts/preview/PrintPreview/ImageContextMenu');

  renderRendererCase(
    <ImageContextMenu
      anchorPosition={anchorPosition}
      onClose={onClose}
      imageElement={imageElement}
    />,
  );

  return { onClose, rendererFunctions, useGlobalStore };
};

describe('ImageContextMenu 组件行为', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test('空白槽位应禁用复制与清空操作', async () => {
    await renderImageContextMenu({
      state: {
        CardList: [{ id: 'card-1', face: null, back: null, repeat: 1 }],
      },
    });

    const copyItem = await screen.findByRole('menuitem', { name: zhLocale.printPreview.contextMenu.copy });
    const clearItem = await screen.findByRole('menuitem', { name: zhLocale.printPreview.contextMenu.clear });
    const pasteItem = await screen.findByRole('menuitem', { name: zhLocale.printPreview.contextMenu.paste });

    expect(copyItem.getAttribute('aria-disabled')).toBe('true');
    expect(clearItem.getAttribute('aria-disabled')).toBe('true');
    expect(pasteItem.getAttribute('aria-disabled')).toBeNull();
  });

  test('复制时应将当前图片数据写入剪贴板', async () => {
    const faceData = { path: 'face-a.png', ext: 'png', mtime: 1 };
    const { writeText } = installClipboard();
    const { onClose } = await renderImageContextMenu({
      state: {
        CardList: [{ id: 'card-1', face: faceData, back: null, repeat: 1 }],
      },
    });

    fireEvent.click(await screen.findByRole('menuitem', { name: zhLocale.printPreview.contextMenu.copy }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(JSON.stringify(faceData));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  test('粘贴合法 JSON 后应更新卡面并清理预览缓存、刷新页数', async () => {
    const pastedImage = { path: 'pasted-back.png', ext: 'png', mtime: 5 };
    const { readText } = installClipboard({
      readText: vi.fn(async () => JSON.stringify(pastedImage)),
    });
    const { onClose, rendererFunctions, useGlobalStore } = await renderImageContextMenu({
      imageElement: createImageElement('0.back'),
      state: {
        CardList: [{ id: 'card-1', face: { path: 'face-a.png' }, back: null, repeat: 1 }],
      },
    });

    fireEvent.click(await screen.findByRole('menuitem', { name: zhLocale.printPreview.contextMenu.paste }));

    await waitFor(() => {
      expect(readText).toHaveBeenCalledTimes(1);
      expect(useGlobalStore.getState().CardList[0].back).toEqual(pastedImage);
      expect(rendererFunctions.clearPreviewCache).toHaveBeenCalledTimes(1);
      expect(rendererFunctions.getExportPageCount).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  test('粘贴非法 JSON 时应安全关闭且不改动卡片数据', async () => {
    const { readText } = installClipboard({
      readText: vi.fn(async () => '{not-json'),
    });
    const initialFace = { path: 'face-a.png', ext: 'png', mtime: 1 };
    const { onClose, rendererFunctions, useGlobalStore } = await renderImageContextMenu({
      state: {
        CardList: [{ id: 'card-1', face: initialFace, back: null, repeat: 1 }],
      },
    });

    fireEvent.click(await screen.findByRole('menuitem', { name: zhLocale.printPreview.contextMenu.paste }));

    await waitFor(() => {
      expect(readText).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(useGlobalStore.getState().CardList[0].face).toEqual(initialFace);
    expect(rendererFunctions.clearPreviewCache).not.toHaveBeenCalled();
    expect(rendererFunctions.getExportPageCount).not.toHaveBeenCalled();
  });

  test('清空时应移除当前图片并清理预览缓存', async () => {
    const { onClose, rendererFunctions, useGlobalStore } = await renderImageContextMenu({
      state: {
        CardList: [{ id: 'card-1', face: { path: 'face-a.png', ext: 'png', mtime: 1 }, back: null, repeat: 1 }],
      },
    });

    fireEvent.click(await screen.findByRole('menuitem', { name: zhLocale.printPreview.contextMenu.clear }));

    await waitFor(() => {
      expect(useGlobalStore.getState().CardList[0].face).toBeNull();
      expect(rendererFunctions.clearPreviewCache).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    expect(rendererFunctions.getExportPageCount).not.toHaveBeenCalled();
  });

  test('替换时应使用 openImage 返回的 face 数据更新对应卡面', async () => {
    const replacementFace = { path: 'replacement.png', ext: 'png', mtime: 8 };
    const { onClose, rendererFunctions, useGlobalStore } = await renderImageContextMenu({
      imageElement: createImageElement('0.back'),
      state: {
        CardList: [{ id: 'card-1', face: { path: 'face-a.png' }, back: { path: 'back-a.png' }, repeat: 1 }],
      },
    });

    rendererFunctions.openImage.mockResolvedValue([{ face: replacementFace, back: null }]);

    fireEvent.click(await screen.findByRole('menuitem', { name: zhLocale.printPreview.contextMenu.replace }));

    await waitFor(() => {
      expect(rendererFunctions.openImage).toHaveBeenCalledWith(false, false);
      expect(useGlobalStore.getState().CardList[0].back).toEqual(replacementFace);
      expect(rendererFunctions.clearPreviewCache).toHaveBeenCalledTimes(1);
      expect(rendererFunctions.getExportPageCount).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
   });
 });



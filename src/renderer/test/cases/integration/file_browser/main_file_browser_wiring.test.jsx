// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../../../setup/rendererCaseBootstrap';
import { useUiRuntimeStore } from '../../../../state/uiRuntimeStore';

const createFileEntry = (realPath) => ({
  realPath,
  safePath: realPath,
  ext: 'cpnp',
  modified: 1700000000000,
});

const createFileBrowserDialogStub = (openDialogMock) => React.forwardRef((_props, ref) => {
  React.useImperativeHandle(ref, () => ({
    openDialog: openDialogMock,
  }));

  return <div data-testid="file-browser-dialog-stub" />;
});

const renderMainWithFileBrowserStub = async (openDialogMock = vi.fn()) => {
  bootstrapRendererCase({
    currentView: 'edit',
    mocks: {
      components: {
        FileBrowserDialog: createFileBrowserDialogStub(openDialogMock),
      },
    },
  });

  const { Main } = await import('../../../../parts/Main');
  const renderResult = renderRendererCase(<Main />);

  return {
    openDialogMock,
    ...renderResult,
  };
};

describe('Main 文件浏览器 API wiring', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    cleanupRendererCase();
    const actualUiRuntimeStoreModule = await vi.importActual('../../../../state/uiRuntimeStore');
    actualUiRuntimeStoreModule.resetUiRuntimeStore();
  });

  test('挂载 Main 时应注册 fileBrowserApi，卸载时应清空', async () => {
    const openDialogMock = vi.fn();
    const { unmount } = await renderMainWithFileBrowserStub(openDialogMock);

    await waitFor(() => {
      expect(useUiRuntimeStore.getState().fileBrowserApi?.openDialog).toBe(openDialogMock);
    });

    unmount();

    await waitFor(() => {
      expect(useUiRuntimeStore.getState().fileBrowserApi).toBeNull();
    });
  });

  test('showFileOpenDialog 在打开模式下应委托 fileBrowserApi.openDialog 并返回完整选择结果', async () => {
    const openDialogMock = vi.fn();
    const actualUiRuntimeStoreModule = await vi.importActual('../../../../state/uiRuntimeStore');
    const { showFileOpenDialog } = await vi.importActual('../../../../functions');

    actualUiRuntimeStoreModule.useUiRuntimeStore.getState().setFileBrowserApi({
      openDialog: openDialogMock,
    });

    const promise = showFileOpenDialog({ filterExtensions: 'cpnp' });

    expect(openDialogMock).toHaveBeenCalledTimes(1);

    const dialogOptions = openDialogMock.mock.calls[0][0];
    expect(dialogOptions).toEqual(expect.objectContaining({
      multiSelect: false,
      showFileIcon: false,
      filterExtensions: 'cpnp',
      onSelect: expect.any(Function),
    }));

    const selectedFiles = [[createFileEntry('C:/projects/demo.cpnp')]];
    await dialogOptions.onSelect(selectedFiles);

    await expect(promise).resolves.toEqual(selectedFiles);
  });

  test('showFileOpenDialog 在保存模式下应返回首个文件项', async () => {
    const openDialogMock = vi.fn();
    const actualUiRuntimeStoreModule = await vi.importActual('../../../../state/uiRuntimeStore');
    const { showFileOpenDialog } = await vi.importActual('../../../../functions');

    actualUiRuntimeStoreModule.useUiRuntimeStore.getState().setFileBrowserApi({
      openDialog: openDialogMock,
    });

    const promise = showFileOpenDialog({ filterExtensions: 'cpnp', mode: 'save' });

    expect(openDialogMock).toHaveBeenCalledTimes(1);

    const dialogOptions = openDialogMock.mock.calls[0][0];
    const selectedFiles = [[createFileEntry('C:/projects/saved.cpnp')]];
    await dialogOptions.onSelect(selectedFiles);

    await expect(promise).resolves.toEqual(createFileEntry('C:/projects/saved.cpnp'));
  });

  test('showFileOpenDialog 在 fileBrowserApi 抛错时应返回 reject', async () => {
    const openDialogMock = vi.fn(() => {
      throw new Error('dialog-failed');
    });
    const actualUiRuntimeStoreModule = await vi.importActual('../../../../state/uiRuntimeStore');
    const { showFileOpenDialog } = await vi.importActual('../../../../functions');

    actualUiRuntimeStoreModule.useUiRuntimeStore.getState().setFileBrowserApi({
      openDialog: openDialogMock,
    });

    await expect(showFileOpenDialog({ filterExtensions: 'cpnp' })).rejects.toThrow('dialog-failed');
  });
});







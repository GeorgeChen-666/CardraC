// @vitest-environment jsdom

import React, { createRef } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import zhLocale from '../../../../main/locales/zh.json';
import { homeDir } from '../../../../shared/functions';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../../setup/rendererCaseBootstrap';

const createDirectoryItem = ({
  path,
  name,
  isDirectory = false,
  size = 0,
  modified = 1700000000000,
  thumbnailUrl,
}) => ({
  path,
  name,
  isDirectory,
  size,
  modified,
  ...(thumbnailUrl ? { thumbnailUrl } : {}),
});

const createDirectoryResponse = (currentPath, items) => ({
  type: 'directory',
  currentPath,
  items,
});

const getGridItemByName = async (name) => (await screen.findByText(name)).closest('.grid-file-item');

const setupDialogScene = async ({
  getDefaultPathValue = { path: 'C:/workspace/project' },
  browsePathImpl,
  listDrivesImpl,
  getFileDetailsImpl,
  setDefaultPathImpl,
} = {}) => {
  bootstrapRendererCase({
    currentView: 'edit',
    mocks: {
      components: {
        FileBrowserDialog: 'actual',
      },
    },
  });

  const rendererFunctions = await import('../../../functions');
  const getDefaultPathMock = vi.spyOn(rendererFunctions, 'getDefaultPath').mockResolvedValue(getDefaultPathValue);
  const listDrivesMock = vi.spyOn(rendererFunctions, 'listDrives').mockImplementation(listDrivesImpl || (async () => createDirectoryResponse('', [])));
  const browsePathMock = vi.spyOn(rendererFunctions, 'browsePath').mockImplementation(browsePathImpl || (async ({ path }) => createDirectoryResponse(path, [])));
  const getFileDetailsMock = vi.spyOn(rendererFunctions, 'getFileDetails').mockImplementation(getFileDetailsImpl || (async () => []));
  const setDefaultPathMock = vi.spyOn(rendererFunctions, 'setDefaultPath').mockImplementation(setDefaultPathImpl || (async () => true));

  const { FileBrowserDialog } = await import('../../../parts/edit/FileBrowser/FileBrowserDialog');
  const ref = createRef();
  renderRendererCase(<FileBrowserDialog ref={ref} />);

  return {
    ref,
    rendererFunctions,
    getDefaultPathMock,
    listDrivesMock,
    browsePathMock,
    getFileDetailsMock,
    setDefaultPathMock,
  };
};

describe('FileBrowserDialog 组件行为', () => {
  afterEach(async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test('openDialog 应读取默认路径、应用标题，并按排序参数加载目录', async () => {
    const folderItems = [
      createDirectoryItem({ path: 'C:/workspace/project/alpha.cpnp', name: 'alpha.cpnp' }),
      createDirectoryItem({ path: 'C:/workspace/project/assets', name: 'assets', isDirectory: true }),
    ];
    const { ref, browsePathMock } = await setupDialogScene({
      browsePathImpl: async ({ path, query }) => {
        expect(path).toBe('C:/workspace/project');
        expect(query).toEqual({ ext: 'cpnp', sort: 'name', order: 'asc' });
        return createDirectoryResponse(path, folderItems);
      },
    });

    await act(async () => {
      await ref.current.openDialog({
        title: '选择项目文件',
        filterExtensions: 'cpnp',
        sort: 'name',
        order: 'asc',
      });
    });

    expect(await screen.findByText('选择项目文件')).toBeTruthy();
    expect(await screen.findByText('alpha.cpnp')).toBeTruthy();
    expect(await screen.findByText('assets')).toBeTruthy();
    expect(await screen.findByText('project')).toBeTruthy();
    expect(browsePathMock).toHaveBeenCalledTimes(1);
  });

  test('默认路径为空时应改为列出驱动器，而不是浏览目录', async () => {
    const driveItems = [
      createDirectoryItem({ path: 'C:/', name: 'C:', isDirectory: true }),
      createDirectoryItem({ path: 'D:/', name: 'D:', isDirectory: true }),
    ];
    const { ref, listDrivesMock, browsePathMock } = await setupDialogScene({
      getDefaultPathValue: { path: '' },
      listDrivesImpl: async () => createDirectoryResponse('', driveItems),
    });

    await act(async () => {
      await ref.current.openDialog({ title: '选择磁盘' });
    });

    expect(await screen.findByText('C:')).toBeTruthy();
    expect(await screen.findByText('D:')).toBeTruthy();
    expect(listDrivesMock).toHaveBeenCalledTimes(1);
    expect(browsePathMock).not.toHaveBeenCalled();
  });

  test('切换排序方式后应按新的 sort/order 重新加载当前目录', async () => {
    const folderItems = [
      createDirectoryItem({ path: 'C:/workspace/project/beta.cpnp', name: 'beta.cpnp', size: 12 }),
    ];
    const { ref, browsePathMock } = await setupDialogScene({
      browsePathImpl: async ({ path }) => createDirectoryResponse(path, folderItems),
    });

    await act(async () => {
      await ref.current.openDialog({
        title: '排序测试',
        filterExtensions: 'cpnp',
        sort: 'name',
        order: 'asc',
      });
    });

    expect(await screen.findByText('beta.cpnp')).toBeTruthy();
    expect(browsePathMock).toHaveBeenNthCalledWith(1, {
      path: 'C:/workspace/project',
      query: { ext: 'cpnp', sort: 'name', order: 'asc' },
    });

    const sortButton = screen.getByTitle(`${zhLocale.fileBrowser.sort}: ${zhLocale.fileBrowser.sort_name_asc}`);
    await act(async () => {
      sortButton.click();
    });
    await act(async () => {
      (await screen.findByRole('menuitem', { name: zhLocale.fileBrowser.sort_size_desc })).click();
    });

    await waitFor(() => {
      expect(browsePathMock).toHaveBeenNthCalledWith(2, {
        path: 'C:/workspace/project',
        query: { ext: 'cpnp', sort: 'size', order: 'desc' },
      });
    });
  });

  test('点击取消时应返回空数组并关闭对话框', async () => {
    const onSelectMock = vi.fn();
    const folderItems = [
      createDirectoryItem({ path: 'C:/workspace/project/alpha.cpnp', name: 'alpha.cpnp' }),
    ];
    const { ref } = await setupDialogScene({
      browsePathImpl: async ({ path }) => createDirectoryResponse(path, folderItems),
    });

    await act(async () => {
      await ref.current.openDialog({
        title: '取消测试',
        filterExtensions: 'cpnp',
        onSelect: onSelectMock,
      });
    });

    expect(await screen.findByText('取消测试')).toBeTruthy();

    await act(async () => {
      screen.getByRole('button', { name: zhLocale.button.cancel }).click();
    });

    await waitFor(() => {
      expect(onSelectMock).toHaveBeenCalledWith([]);
    });
    await waitFor(() => {
      expect(screen.queryByText('取消测试')).toBeNull();
    });
  });

  test('点击快捷访问后应跳转目录，并支持返回与前进', async () => {
    const downloadsPath = `${homeDir}/Downloads`;
    const rootItems = [
      createDirectoryItem({ path: 'C:/workspace/project/alpha.cpnp', name: 'alpha.cpnp' }),
    ];
    const downloadItems = [
      createDirectoryItem({ path: `${downloadsPath}/downloaded.cpnp`, name: 'downloaded.cpnp' }),
    ];
    const { ref, browsePathMock } = await setupDialogScene({
      browsePathImpl: async ({ path }) => {
        if (path === 'C:/workspace/project') {
          return createDirectoryResponse(path, rootItems);
        }

        if (path === downloadsPath) {
          return createDirectoryResponse(path, downloadItems);
        }

        throw new Error(`Unexpected path: ${path}`);
      },
    });

    await act(async () => {
      await ref.current.openDialog({
        title: '快捷访问测试',
        filterExtensions: 'cpnp',
      });
    });

    const backButton = screen.getByTestId('ArrowBackIcon').closest('button');
    const forwardButton = screen.getByTestId('ArrowForwardIcon').closest('button');
    expect(backButton.disabled).toBe(true);
    expect(forwardButton.disabled).toBe(true);

    const downloadsItem = screen.getByText(zhLocale.fileBrowser.quickAccess.downloads).closest('.sidebar-item');
    fireEvent.click(downloadsItem);

    await waitFor(() => {
      expect(browsePathMock).toHaveBeenNthCalledWith(2, {
        path: downloadsPath,
        query: { ext: 'cpnp', sort: 'name', order: 'asc' },
      });
      expect(screen.getByText('downloaded.cpnp')).toBeTruthy();
      expect(backButton.disabled).toBe(false);
      expect(forwardButton.disabled).toBe(true);
    });

    fireEvent.click(backButton);

    await waitFor(() => {
      expect(screen.getByText('alpha.cpnp')).toBeTruthy();
      expect(backButton.disabled).toBe(true);
      expect(forwardButton.disabled).toBe(false);
    });

    fireEvent.click(forwardButton);

    await waitFor(() => {
      expect(screen.getByText('downloaded.cpnp')).toBeTruthy();
      expect(backButton.disabled).toBe(false);
      expect(forwardButton.disabled).toBe(true);
    });
  });

  test('单选文件时应只高亮当前文件，并让确认按钮可用', async () => {
    const folderItems = [
      createDirectoryItem({ path: 'C:/workspace/project/alpha.cpnp', name: 'alpha.cpnp' }),
      createDirectoryItem({ path: 'C:/workspace/project/beta.cpnp', name: 'beta.cpnp' }),
    ];
    const { ref } = await setupDialogScene({
      browsePathImpl: async ({ path }) => createDirectoryResponse(path, folderItems),
    });

    await act(async () => {
      await ref.current.openDialog({
        title: '单选测试',
        filterExtensions: 'cpnp',
      });
    });

    const alphaItem = await getGridItemByName('alpha.cpnp');
    const betaItem = await getGridItemByName('beta.cpnp');

    fireEvent.click(alphaItem);

    await waitFor(() => {
      expect(alphaItem.className).toContain('selected');
      expect(betaItem.className).not.toContain('selected');
      expect(screen.getByRole('button', { name: zhLocale.button.ok }).disabled).toBe(false);
    });
  });

  test('Ctrl 点击时应支持多选切换，再次点击同一文件应取消选择', async () => {
    const folderItems = [
      createDirectoryItem({ path: 'C:/workspace/project/alpha.cpnp', name: 'alpha.cpnp' }),
      createDirectoryItem({ path: 'C:/workspace/project/beta.cpnp', name: 'beta.cpnp' }),
      createDirectoryItem({ path: 'C:/workspace/project/gamma.cpnp', name: 'gamma.cpnp' }),
    ];
    const { ref } = await setupDialogScene({
      browsePathImpl: async ({ path }) => createDirectoryResponse(path, folderItems),
    });

    await act(async () => {
      await ref.current.openDialog({
        title: 'Ctrl 多选测试',
        filterExtensions: 'cpnp',
        multiSelect: true,
      });
    });

    const alphaItem = await getGridItemByName('alpha.cpnp');
    const betaItem = await getGridItemByName('beta.cpnp');

    fireEvent.click(alphaItem);
    fireEvent.click(betaItem, { ctrlKey: true });

    await waitFor(() => {
      expect(alphaItem.className).toContain('selected');
      expect(betaItem.className).toContain('selected');
    });

    fireEvent.click(betaItem, { ctrlKey: true });

    await waitFor(() => {
      expect(alphaItem.className).toContain('selected');
      expect(betaItem.className).not.toContain('selected');
    });
  });

  test('Shift 点击时应选中范围内的所有文件，并忽略目录项', async () => {
    const folderItems = [
      createDirectoryItem({ path: 'C:/workspace/project/alpha.cpnp', name: 'alpha.cpnp' }),
      createDirectoryItem({ path: 'C:/workspace/project/assets', name: 'assets', isDirectory: true }),
      createDirectoryItem({ path: 'C:/workspace/project/beta.cpnp', name: 'beta.cpnp' }),
      createDirectoryItem({ path: 'C:/workspace/project/gamma.cpnp', name: 'gamma.cpnp' }),
    ];
    const { ref } = await setupDialogScene({
      browsePathImpl: async ({ path }) => createDirectoryResponse(path, folderItems),
    });

    await act(async () => {
      await ref.current.openDialog({
        title: 'Shift 范围测试',
        filterExtensions: 'cpnp',
        multiSelect: true,
      });
    });

    const alphaItem = await getGridItemByName('alpha.cpnp');
    const assetsItem = await getGridItemByName('assets');
    const betaItem = await getGridItemByName('beta.cpnp');
    const gammaItem = await getGridItemByName('gamma.cpnp');

    fireEvent.click(alphaItem);
    fireEvent.click(gammaItem, { shiftKey: true });

    await waitFor(() => {
      expect(alphaItem.className).toContain('selected');
      expect(betaItem.className).toContain('selected');
      expect(gammaItem.className).toContain('selected');
      expect(assetsItem.className).not.toContain('selected');
    });
  });

  test('双面模式下应支持锁定正面、限制背面数量，并按 front/back 结构提交结果', async () => {
    const onSelectMock = vi.fn();
    const folderItems = [
      createDirectoryItem({ path: 'C:/workspace/project/front-a.png', name: 'front-a.png', thumbnailUrl: 'cardrac://image/front-a.png' }),
      createDirectoryItem({ path: 'C:/workspace/project/front-b.png', name: 'front-b.png', thumbnailUrl: 'cardrac://image/front-b.png' }),
      createDirectoryItem({ path: 'C:/workspace/project/back-a.png', name: 'back-a.png', thumbnailUrl: 'cardrac://image/back-a.png' }),
      createDirectoryItem({ path: 'C:/workspace/project/back-b.png', name: 'back-b.png', thumbnailUrl: 'cardrac://image/back-b.png' }),
      createDirectoryItem({ path: 'C:/workspace/project/back-c.png', name: 'back-c.png', thumbnailUrl: 'cardrac://image/back-c.png' }),
    ];
    const { ref, setDefaultPathMock } = await setupDialogScene({
      browsePathImpl: async ({ path, query }) => {
        expect(query).toEqual({ ext: 'png', sort: 'name', order: 'asc' });
        return createDirectoryResponse(path, folderItems);
      },
    });

    await act(async () => {
      await ref.current.openDialog({
        title: '双面配对',
        filterExtensions: 'png',
        multiSelect: true,
        isDoubleSides: true,
        showFileIcon: true,
        onSelect: onSelectMock,
      });
    });

    const frontAItem = await getGridItemByName('front-a.png');
    const frontBItem = await getGridItemByName('front-b.png');
    const backAItem = await getGridItemByName('back-a.png');
    const backBItem = await getGridItemByName('back-b.png');
    const backCItem = await getGridItemByName('back-c.png');

    fireEvent.click(frontAItem);
    fireEvent.click(frontBItem, { ctrlKey: true });

    await waitFor(() => {
      expect(frontAItem.className).toContain('selected');
      expect(frontBItem.className).toContain('selected');
      expect(screen.getByRole('button', { name: zhLocale.fileBrowser.bottomBar.lockedOff }).disabled).toBe(false);
    });

    fireEvent.click(screen.getByRole('button', { name: zhLocale.fileBrowser.bottomBar.lockedOff }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: zhLocale.fileBrowser.bottomBar.lockedOn })).toBeTruthy();
      expect(screen.getByText(zhLocale.fileBrowser.bottomBar.slotLabelEmptyCurrent)).toBeTruthy();
      expect(screen.getByRole('button', { name: zhLocale.button.ok }).disabled).toBe(true);
    });

    fireEvent.click(backAItem);
    fireEvent.click(backBItem, { ctrlKey: true });
    fireEvent.click(backCItem, { ctrlKey: true });

    await waitFor(() => {
      expect(backAItem.className).toContain('selected');
      expect(backBItem.className).toContain('selected');
      expect(backCItem.className).not.toContain('selected');
      expect(screen.getByRole('button', { name: zhLocale.button.ok }).disabled).toBe(false);
    });

    fireEvent.click(screen.getByRole('button', { name: zhLocale.button.ok }));

    await waitFor(() => {
      expect(setDefaultPathMock).toHaveBeenCalledWith({ path: 'C:/workspace/project' });
      expect(onSelectMock).toHaveBeenCalledWith([
        [expect.objectContaining({ path: 'C:/workspace/project/front-a.png', name: 'front-a.png', isDirectory: false }), expect.objectContaining({ path: 'C:/workspace/project/back-a.png', name: 'back-a.png', isDirectory: false })],
        [expect.objectContaining({ path: 'C:/workspace/project/front-b.png', name: 'front-b.png', isDirectory: false }), expect.objectContaining({ path: 'C:/workspace/project/back-b.png', name: 'back-b.png', isDirectory: false })],
      ]);
    });
  });

  test('双面模式锁定正面后，Shift 选择背面范围时应按 lockedFiles 数量截断', async () => {
    const folderItems = [
      createDirectoryItem({ path: 'C:/workspace/project/front-a.png', name: 'front-a.png', thumbnailUrl: 'cardrac://image/front-a.png' }),
      createDirectoryItem({ path: 'C:/workspace/project/front-b.png', name: 'front-b.png', thumbnailUrl: 'cardrac://image/front-b.png' }),
      createDirectoryItem({ path: 'C:/workspace/project/back-a.png', name: 'back-a.png', thumbnailUrl: 'cardrac://image/back-a.png' }),
      createDirectoryItem({ path: 'C:/workspace/project/back-b.png', name: 'back-b.png', thumbnailUrl: 'cardrac://image/back-b.png' }),
      createDirectoryItem({ path: 'C:/workspace/project/back-c.png', name: 'back-c.png', thumbnailUrl: 'cardrac://image/back-c.png' }),
      createDirectoryItem({ path: 'C:/workspace/project/back-d.png', name: 'back-d.png', thumbnailUrl: 'cardrac://image/back-d.png' }),
    ];
    const { ref } = await setupDialogScene({
      browsePathImpl: async ({ path, query }) => {
        expect(query).toEqual({ ext: 'png', sort: 'name', order: 'asc' });
        return createDirectoryResponse(path, folderItems);
      },
    });

    await act(async () => {
      await ref.current.openDialog({
        title: '双面 Shift 截断',
        filterExtensions: 'png',
        multiSelect: true,
        isDoubleSides: true,
        showFileIcon: true,
      });
    });

    const frontAItem = await getGridItemByName('front-a.png');
    const frontBItem = await getGridItemByName('front-b.png');
    const backAItem = await getGridItemByName('back-a.png');
    const backBItem = await getGridItemByName('back-b.png');
    const backCItem = await getGridItemByName('back-c.png');
    const backDItem = await getGridItemByName('back-d.png');

    fireEvent.click(frontAItem);
    fireEvent.click(frontBItem, { ctrlKey: true });

    await waitFor(() => {
      expect(frontAItem.className).toContain('selected');
      expect(frontBItem.className).toContain('selected');
      expect(screen.getByRole('button', { name: zhLocale.fileBrowser.bottomBar.lockedOff }).disabled).toBe(false);
    });

    fireEvent.click(screen.getByRole('button', { name: zhLocale.fileBrowser.bottomBar.lockedOff }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: zhLocale.fileBrowser.bottomBar.lockedOn })).toBeTruthy();
      expect(screen.getByText(zhLocale.fileBrowser.bottomBar.slotLabelEmptyCurrent)).toBeTruthy();
    });

    fireEvent.click(backAItem);
    fireEvent.click(backDItem, { shiftKey: true });

    await waitFor(() => {
      expect(backAItem.className).toContain('selected');
      expect(backBItem.className).toContain('selected');
      expect(backCItem.className).not.toContain('selected');
      expect(backDItem.className).not.toContain('selected');
      expect(screen.getByRole('button', { name: zhLocale.button.ok }).disabled).toBe(false);
    });
  });

  test('双面模式锁定正面后，反向 Shift 选择背面范围时也应从较早项开始截断', async () => {
    const folderItems = [
      createDirectoryItem({ path: 'C:/workspace/project/front-a.png', name: 'front-a.png', thumbnailUrl: 'cardrac://image/front-a.png' }),
      createDirectoryItem({ path: 'C:/workspace/project/front-b.png', name: 'front-b.png', thumbnailUrl: 'cardrac://image/front-b.png' }),
      createDirectoryItem({ path: 'C:/workspace/project/back-a.png', name: 'back-a.png', thumbnailUrl: 'cardrac://image/back-a.png' }),
      createDirectoryItem({ path: 'C:/workspace/project/back-b.png', name: 'back-b.png', thumbnailUrl: 'cardrac://image/back-b.png' }),
      createDirectoryItem({ path: 'C:/workspace/project/back-c.png', name: 'back-c.png', thumbnailUrl: 'cardrac://image/back-c.png' }),
      createDirectoryItem({ path: 'C:/workspace/project/back-d.png', name: 'back-d.png', thumbnailUrl: 'cardrac://image/back-d.png' }),
    ];
    const { ref } = await setupDialogScene({
      browsePathImpl: async ({ path, query }) => {
        expect(query).toEqual({ ext: 'png', sort: 'name', order: 'asc' });
        return createDirectoryResponse(path, folderItems);
      },
    });

    await act(async () => {
      await ref.current.openDialog({
        title: '双面反向 Shift 截断',
        filterExtensions: 'png',
        multiSelect: true,
        isDoubleSides: true,
        showFileIcon: true,
      });
    });

    const frontAItem = await getGridItemByName('front-a.png');
    const frontBItem = await getGridItemByName('front-b.png');
    const backAItem = await getGridItemByName('back-a.png');
    const backBItem = await getGridItemByName('back-b.png');
    const backCItem = await getGridItemByName('back-c.png');
    const backDItem = await getGridItemByName('back-d.png');

    fireEvent.click(frontAItem);
    fireEvent.click(frontBItem, { ctrlKey: true });

    await waitFor(() => {
      expect(frontAItem.className).toContain('selected');
      expect(frontBItem.className).toContain('selected');
      expect(screen.getByRole('button', { name: zhLocale.fileBrowser.bottomBar.lockedOff }).disabled).toBe(false);
    });

    fireEvent.click(screen.getByRole('button', { name: zhLocale.fileBrowser.bottomBar.lockedOff }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: zhLocale.fileBrowser.bottomBar.lockedOn })).toBeTruthy();
    });

    fireEvent.click(backDItem);
    fireEvent.click(backAItem, { shiftKey: true });

    await waitFor(() => {
      expect(frontAItem.className).not.toContain('selected');
      expect(frontBItem.className).not.toContain('selected');
      expect(backAItem.className).toContain('selected');
      expect(backBItem.className).toContain('selected');
      expect(backCItem.className).not.toContain('selected');
      expect(backDItem.className).not.toContain('selected');
      expect(screen.getByRole('button', { name: zhLocale.button.ok }).disabled).toBe(false);
    });
  });

  test('save 模式点击现有文件后应回填文件名，并在确认覆盖后返回完整保存路径', async () => {
    const onSelectMock = vi.fn();
    const folderItems = [
      createDirectoryItem({ path: 'C:/workspace/project/alpha.cpnp', name: 'alpha.cpnp' }),
    ];
    const { ref, setDefaultPathMock } = await setupDialogScene({
      browsePathImpl: async ({ path, query }) => {
        expect(query).toEqual({ ext: 'cpnp', sort: 'name', order: 'asc' });
        return createDirectoryResponse(path, folderItems);
      },
    });

    await act(async () => {
      await ref.current.openDialog({
        title: '保存项目',
        mode: 'save',
        filterExtensions: 'cpnp',
        onSelect: onSelectMock,
      });
    });

    const fileItem = (await screen.findByText('alpha.cpnp')).closest('.grid-file-item');
    fireEvent.click(fileItem);

    await waitFor(() => {
      expect(screen.getByDisplayValue('alpha')).toBeTruthy();
      expect(screen.getByRole('button', { name: zhLocale.button.save }).disabled).toBe(false);
    });

    fireEvent.click(screen.getByRole('button', { name: zhLocale.button.save }));

    expect(await screen.findByText(zhLocale.fileBrowser.existConfirm)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: zhLocale.button.yes }));

    await waitFor(() => {
      expect(setDefaultPathMock).toHaveBeenCalledWith({ path: 'C:/workspace/project' });
      expect(onSelectMock).toHaveBeenCalledWith([[
        { realPath: 'C:/workspace/project/alpha.cpnp', name: 'alpha', isDirectory: false },
      ]]);
    });
  });

  test('save 模式手动输入的文件名与现有文件仅大小写不同时，仍应触发覆盖确认', async () => {
    const onSelectMock = vi.fn();
    const folderItems = [
      createDirectoryItem({ path: 'C:/workspace/project/ALPHA.CPNP', name: 'ALPHA.CPNP' }),
    ];
    const { ref, setDefaultPathMock } = await setupDialogScene({
      browsePathImpl: async ({ path }) => createDirectoryResponse(path, folderItems),
    });

    await act(async () => {
      await ref.current.openDialog({
        title: '大小写覆盖确认',
        mode: 'save',
        filterExtensions: 'cpnp',
        onSelect: onSelectMock,
      });
    });

    const fileNameInput = screen.getByLabelText(zhLocale.fileBrowser.bottomBar.nameInputLabel);
    const saveButton = screen.getByRole('button', { name: zhLocale.button.save });

    fireEvent.change(fileNameInput, { target: { value: 'alpha' } });

    await waitFor(() => {
      expect(saveButton.disabled).toBe(false);
    });

    fireEvent.click(saveButton);

    expect(await screen.findByText(zhLocale.fileBrowser.existConfirm)).toBeTruthy();
    expect(onSelectMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: zhLocale.button.yes }));

    await waitFor(() => {
      expect(setDefaultPathMock).toHaveBeenCalledWith({ path: 'C:/workspace/project' });
      expect(onSelectMock).toHaveBeenCalledWith([[
        { realPath: 'C:/workspace/project/alpha.cpnp', name: 'alpha', isDirectory: false },
      ]]);
    });
  });

  test('save 模式手动输入文件名并切换扩展名后应重载目录，且直接保存新文件', async () => {
    const onSelectMock = vi.fn();
    const folderItems = [
      createDirectoryItem({ path: 'C:/workspace/project/alpha.cpnp', name: 'alpha.cpnp' }),
    ];
    const { ref, browsePathMock, setDefaultPathMock } = await setupDialogScene({
      browsePathImpl: async ({ path }) => createDirectoryResponse(path, folderItems),
    });

    await act(async () => {
      await ref.current.openDialog({
        title: '手动保存',
        mode: 'save',
        filterExtensions: 'cpnp,png',
        onSelect: onSelectMock,
      });
    });

    const saveButton = screen.getByRole('button', { name: zhLocale.button.save });
    const fileNameInput = screen.getByLabelText(zhLocale.fileBrowser.bottomBar.nameInputLabel);
    const fileTypeSelect = screen.getByRole('combobox');

    expect(saveButton.disabled).toBe(true);

    fireEvent.change(fileNameInput, { target: { value: 'manual-output' } });

    await waitFor(() => {
      expect(saveButton.disabled).toBe(false);
    });

    fireEvent.mouseDown(fileTypeSelect);
    fireEvent.click(await screen.findByRole('option', { name: 'png' }));

    await waitFor(() => {
      expect(browsePathMock).toHaveBeenNthCalledWith(2, {
        path: 'C:/workspace/project',
        query: { ext: 'png', sort: 'name', order: 'asc' },
      });
    });

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(setDefaultPathMock).toHaveBeenCalledWith({ path: 'C:/workspace/project' });
      expect(onSelectMock).toHaveBeenCalledWith([[
        { realPath: 'C:/workspace/project/manual-output.png', name: 'manual-output', isDirectory: false },
      ]]);
    });
    expect(screen.queryByText(zhLocale.fileBrowser.existConfirm)).toBeNull();

    fireEvent.change(fileNameInput, { target: { value: '' } });

    await waitFor(() => {
      expect(saveButton.disabled).toBe(true);
    });
  });

  test('save 模式文件名为空时即使按 Enter 也不应提交，并应保持对话框打开', async () => {
    const onSelectMock = vi.fn();
    const folderItems = [
      createDirectoryItem({ path: 'C:/workspace/project/alpha.cpnp', name: 'alpha.cpnp' }),
    ];
    const { ref } = await setupDialogScene({
      browsePathImpl: async ({ path }) => createDirectoryResponse(path, folderItems),
    });

    await act(async () => {
      await ref.current.openDialog({
        title: '空文件名保存',
        mode: 'save',
        filterExtensions: 'cpnp',
        onSelect: onSelectMock,
      });
    });

    const saveButton = screen.getByRole('button', { name: zhLocale.button.save });
    const fileNameInput = screen.getByLabelText(zhLocale.fileBrowser.bottomBar.nameInputLabel);

    expect(fileNameInput.value).toBe('');
    expect(saveButton.disabled).toBe(true);

    fireEvent.keyDown(fileNameInput, { key: 'Enter' });

    await waitFor(() => {
      expect(onSelectMock).not.toHaveBeenCalled();
      expect(screen.getByText('空文件名保存')).toBeTruthy();
      expect(screen.getByRole('button', { name: zhLocale.button.save }).disabled).toBe(true);
    });
  });

  test('open 模式选择缺少 modified 的文件时应补充详情，并在确认时返回补水后的结果', async () => {
    const onSelectMock = vi.fn();
    const folderItems = [
      createDirectoryItem({
        path: 'C:/workspace/project/detail-less.cpnp',
        name: 'detail-less.cpnp',
        modified: null,
        size: undefined,
      }),
    ];
    const fileDetails = [{
      path: 'C:/workspace/project/detail-less.cpnp',
      name: 'detail-less.cpnp',
      realPath: 'C:/workspace/project/detail-less.cpnp',
      safePath: 'C:/workspace/project/detail-less.cpnp',
      modified: 1700001234567,
      size: 456,
      isDirectory: false,
    }];
    const { ref, getFileDetailsMock, setDefaultPathMock } = await setupDialogScene({
      browsePathImpl: async ({ path }) => createDirectoryResponse(path, folderItems),
      getFileDetailsImpl: async ({ paths }) => {
        expect(paths).toEqual(['C:/workspace/project/detail-less.cpnp']);
        return fileDetails;
      },
    });

    await act(async () => {
      await ref.current.openDialog({
        title: '补水提交',
        filterExtensions: 'cpnp',
        onSelect: onSelectMock,
      });
    });

    const fileItem = (await screen.findByText('detail-less.cpnp')).closest('.grid-file-item');
    fireEvent.click(fileItem);

    await waitFor(() => {
      expect(getFileDetailsMock).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: zhLocale.button.ok }).disabled).toBe(false);
    });

    fireEvent.click(screen.getByRole('button', { name: zhLocale.button.ok }));

    await waitFor(() => {
      expect(setDefaultPathMock).toHaveBeenCalledWith({ path: 'C:/workspace/project' });
      expect(onSelectMock).toHaveBeenCalledWith([[expect.objectContaining({
        path: 'C:/workspace/project/detail-less.cpnp',
        realPath: 'C:/workspace/project/detail-less.cpnp',
        modified: 1700001234567,
        size: 456,
      })]]);
    });
    expect(getFileDetailsMock).toHaveBeenCalledTimes(1);
  });

  test('open 模式双击文件时应直接提交当前选择结果', async () => {
    const onSelectMock = vi.fn();
    const folderItems = [
      createDirectoryItem({ path: 'C:/workspace/project/beta.cpnp', name: 'beta.cpnp' }),
    ];
    const { ref, setDefaultPathMock } = await setupDialogScene({
      browsePathImpl: async ({ path }) => createDirectoryResponse(path, folderItems),
    });

    await act(async () => {
      await ref.current.openDialog({
        title: '双击打开',
        filterExtensions: 'cpnp',
        onSelect: onSelectMock,
      });
    });

    const fileItem = (await screen.findByText('beta.cpnp')).closest('.grid-file-item');
    fireEvent.click(fileItem);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: zhLocale.button.ok }).disabled).toBe(false);
    });

    fireEvent.doubleClick(fileItem);

    await waitFor(() => {
      expect(setDefaultPathMock).toHaveBeenCalledWith({ path: 'C:/workspace/project' });
      expect(onSelectMock).toHaveBeenCalledWith([[
        expect.objectContaining({
          path: 'C:/workspace/project/beta.cpnp',
          name: 'beta.cpnp',
          isDirectory: false,
        }),
      ]]);
    });
  });

  test('双击目录时应进入子目录并加载新的文件列表', async () => {
    const rootItems = [
      createDirectoryItem({ path: 'C:/workspace/project/assets', name: 'assets', isDirectory: true }),
    ];
    const nestedItems = [
      createDirectoryItem({ path: 'C:/workspace/project/assets/inside.cpnp', name: 'inside.cpnp' }),
    ];
    const { ref, browsePathMock } = await setupDialogScene({
      browsePathImpl: async ({ path, query }) => {
        if (path === 'C:/workspace/project') {
          return createDirectoryResponse(path, rootItems);
        }

        if (path === 'C:/workspace/project/assets') {
          expect(query).toEqual({ ext: 'cpnp', sort: 'name', order: 'asc' });
          return createDirectoryResponse(path, nestedItems);
        }

        throw new Error(`Unexpected path: ${path}`);
      },
    });

    await act(async () => {
      await ref.current.openDialog({
        title: '目录跳转',
        filterExtensions: 'cpnp',
      });
    });

    const folderItem = (await screen.findByText('assets')).closest('.grid-file-item');
    fireEvent.doubleClick(folderItem);

    await waitFor(() => {
      expect(browsePathMock).toHaveBeenNthCalledWith(2, {
        path: 'C:/workspace/project/assets',
        query: { ext: 'cpnp', sort: 'name', order: 'asc' },
      });
      expect(screen.getByText('inside.cpnp')).toBeTruthy();
    });
  });
});







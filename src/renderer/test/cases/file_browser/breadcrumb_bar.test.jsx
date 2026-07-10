// @vitest-environment jsdom

import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../../setup/rendererCaseBootstrap';

const mockBreadcrumbOverflowWidths = ({ containerWidth = 220, breadcrumbWidth = 80 } = {}) =>
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function mockOffsetWidth() {
    if (typeof this.className === 'string' && this.className.includes('windows-address-bar')) {
      return containerWidth;
    }

    if (typeof this.className === 'string' && this.className.includes('breadcrumb-button')) {
      return breadcrumbWidth;
    }

    return 100;
  });

const renderBreadcrumbBar = async ({
  folderChain = [
    { id: 'root', name: '💾 All Drives', isDir: true },
    { id: 'C:/workspace', name: 'workspace', isDir: true },
    { id: 'C:/workspace/project', name: 'project', isDir: true },
  ],
  currentPath = 'C:/workspace/project',
  browsePathImpl,
  onNavigate = vi.fn(),
} = {}) => {
  bootstrapRendererCase({ currentView: 'edit' });

  const rendererFunctions = await import('../../../functions');
  const browsePathMock = vi.spyOn(rendererFunctions, 'browsePath').mockImplementation(
    browsePathImpl || (async ({ path }) => ({ type: 'directory', currentPath: path, items: [] })),
  );

  const { BreadcrumbBar } = await import('../../../parts/edit/FileBrowser/BreadcrumbBar');
  renderRendererCase(
    <BreadcrumbBar
      folderChain={folderChain}
      currentPath={currentPath}
      onNavigate={onNavigate}
    />,
  );

  return { browsePathMock, onNavigate };
};

describe('BreadcrumbBar 组件行为', () => {
  afterEach(async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
    });
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test('点击地址栏后应进入编辑模式并显示当前路径', async () => {
    await renderBreadcrumbBar();

    fireEvent.click((await screen.findByText('project')).closest('.windows-address-bar'));

    const input = await screen.findByDisplayValue('C:/workspace/project');
    expect(input).toBeTruthy();
    expect(screen.queryByText('project')).toBeNull();
  });

  test('编辑模式下按 Escape 应退出编辑且不触发导航', async () => {
    const { onNavigate, browsePathMock } = await renderBreadcrumbBar();

    fireEvent.click((await screen.findByText('project')).closest('.windows-address-bar'));

    const input = await screen.findByDisplayValue('C:/workspace/project');
    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.getByText('project')).toBeTruthy();
    });
    expect(onNavigate).not.toHaveBeenCalled();
    expect(browsePathMock).not.toHaveBeenCalled();
  });

  test('编辑模式下输入有效路径并按 Enter 时应验证路径后导航', async () => {
    const { onNavigate, browsePathMock } = await renderBreadcrumbBar({
      browsePathImpl: async ({ path, query }) => {
        expect(query).toEqual({});
        return { type: 'directory', currentPath: path, items: [] };
      },
    });

    fireEvent.click((await screen.findByText('project')).closest('.windows-address-bar'));

    const input = await screen.findByDisplayValue('C:/workspace/project');
    fireEvent.change(input, { target: { value: 'D:/new-path' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(browsePathMock).toHaveBeenCalledWith({ path: 'D:/new-path', query: {} });
      expect(onNavigate).toHaveBeenCalledWith('D:/new-path');
      expect(screen.getByText('project')).toBeTruthy();
    });
  });

  test('编辑模式下输入无效路径并按 Enter 时应保留编辑态并显示错误', async () => {
    const { onNavigate } = await renderBreadcrumbBar({
      browsePathImpl: async () => ({ type: 'error', message: 'not-found' }),
    });

    fireEvent.click((await screen.findByText('project')).closest('.windows-address-bar'));

    const input = await screen.findByDisplayValue('C:/workspace/project');
    fireEvent.change(input, { target: { value: 'Z:/missing' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      const activeInput = screen.getByDisplayValue('Z:/missing');
      expect(activeInput.getAttribute('aria-invalid')).toBe('true');
    });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  test('点击可见 breadcrumb 按钮时应按对应层级导航', async () => {
    const { onNavigate } = await renderBreadcrumbBar();

    fireEvent.click(await screen.findByRole('button', { name: 'workspace' }));

    expect(onNavigate).toHaveBeenCalledWith('C:/workspace');
  });

  test('隐藏项溢出时应通过 MoreHoriz 菜单展示并导航到隐藏目录', async () => {
    mockBreadcrumbOverflowWidths();
    const { onNavigate } = await renderBreadcrumbBar({
      folderChain: [
        { id: 'root', name: '💾 All Drives', isDir: true },
        { id: 'C:/workspace', name: 'workspace', isDir: true },
        { id: 'C:/workspace/project', name: 'project', isDir: true },
        { id: 'C:/workspace/project/assets', name: 'assets', isDir: true },
        { id: 'C:/workspace/project/assets/images', name: 'images', isDir: true },
      ],
      currentPath: 'C:/workspace/project/assets/images',
    });

    await waitFor(() => {
      expect(document.querySelector('.breadcrumb-dropdown-button')).toBeTruthy();
    });

    fireEvent.click(document.querySelector('.breadcrumb-dropdown-button'));

    const hiddenWorkspaceItem = await screen.findByRole('menuitem', { name: 'workspace' });
    const hiddenProjectItem = await screen.findByRole('menuitem', { name: 'project' });
    expect(hiddenWorkspaceItem).toBeTruthy();
    expect(hiddenProjectItem).toBeTruthy();

    fireEvent.click(hiddenWorkspaceItem);

    expect(onNavigate).toHaveBeenCalledWith('C:/workspace');
  });

  test('隐藏项菜单中点击根 breadcrumb 时应导航到驱动器根列表', async () => {
    mockBreadcrumbOverflowWidths();
    const { onNavigate } = await renderBreadcrumbBar({
      folderChain: [
        { id: 'root', name: '💾 All Drives', isDir: true },
        { id: 'C:/workspace', name: 'workspace', isDir: true },
        { id: 'C:/workspace/project', name: 'project', isDir: true },
        { id: 'C:/workspace/project/assets', name: 'assets', isDir: true },
        { id: 'C:/workspace/project/assets/images', name: 'images', isDir: true },
      ],
      currentPath: 'C:/workspace/project/assets/images',
    });

    await waitFor(() => {
      expect(document.querySelector('.breadcrumb-dropdown-button')).toBeTruthy();
    });

    fireEvent.click(document.querySelector('.breadcrumb-dropdown-button'));
    fireEvent.click(await screen.findByRole('menuitem', { name: '💾 All Drives' }));

    expect(onNavigate).toHaveBeenCalledWith('');
  });
});





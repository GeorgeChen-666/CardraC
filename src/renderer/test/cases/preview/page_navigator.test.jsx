// @vitest-environment jsdom

import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import zhLocale from '../../../../main/locales/zh.json';
import { layoutSides } from '../../../../shared/constants';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../../setup/rendererCaseBootstrap';

const renderPageNavigator = async ({
  currentPage = 1,
  totalPages = 3,
  sides = layoutSides.doubleSides,
  onPageChange = vi.fn(),
} = {}) => {
  bootstrapRendererCase({
    currentView: 'preview',
    state: {
      Config: { sides },
    },
  });

  const { PageNavigator } = await import('../../../parts/preview/ToolBar/PageNavigator');
  const renderResult = renderRendererCase(
    <PageNavigator
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
    />,
  );

  return { onPageChange, PageNavigator, renderResult };
};

describe('PageNavigator 组件行为', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test.each([
    [layoutSides.oneSide, '/ 4'],
    [layoutSides.doubleSides, '/ 5'],
    [layoutSides.foldInHalf, '/ 4'],
    [layoutSides.brochure, '/ 3'],
  ])('应根据 sides=%s 计算总页数显示', async (sides, totalLabel) => {
    await renderPageNavigator({ sides, totalPages: 3 });

    expect(screen.getByText(totalLabel)).toBeTruthy();
  });

  test('在边界页应正确禁用上一页/下一页，并支持按钮翻页', async () => {
    const { onPageChange } = await renderPageNavigator({
      currentPage: 1,
      totalPages: 3,
      sides: layoutSides.doubleSides,
    });

    const prevButton = screen.getByRole('button', { name: zhLocale.toolbar.btnPrev });
    const nextButton = screen.getByRole('button', { name: zhLocale.toolbar.btnNext });

    expect(prevButton.disabled).toBe(true);
    expect(nextButton.disabled).toBe(false);

    fireEvent.click(nextButton);

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  test('位于最后一个虚拟页时应禁用下一页按钮', async () => {
    await renderPageNavigator({
      currentPage: 5,
      totalPages: 3,
      sides: layoutSides.doubleSides,
    });

    expect(screen.getByRole('button', { name: zhLocale.toolbar.btnNext }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: zhLocale.toolbar.btnPrev }).disabled).toBe(false);
  });

  test('输入框聚焦后应展开页码下拉，且下拉展开时滚轮不应翻页', async () => {
    const { onPageChange } = await renderPageNavigator({
      currentPage: 2,
      totalPages: 3,
      sides: layoutSides.doubleSides,
    });

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    expect(await screen.findByText(zhLocale.toolbar.page.replace('{{num}}', '5'))).toBeTruthy();

    fireEvent.wheel(input, { deltaY: 120 });

    expect(onPageChange).not.toHaveBeenCalled();
  });

  test('下拉关闭时滚轮应按当前页上下翻页，并受边界限制', async () => {
    const { onPageChange } = await renderPageNavigator({
      currentPage: 2,
      totalPages: 3,
      sides: layoutSides.oneSide,
    });

    const input = screen.getByRole('textbox');
    fireEvent.wheel(input, { deltaY: 120 });
    fireEvent.wheel(input, { deltaY: -120 });

    expect(onPageChange).toHaveBeenNthCalledWith(1, 3);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 1);
  });

  test('点击下拉页项后应跳转到对应页码，并更新输入框', async () => {
    const { onPageChange } = await renderPageNavigator({
      currentPage: 2,
      totalPages: 3,
      sides: layoutSides.doubleSides,
    });

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    const pageItem = await screen.findByText(zhLocale.toolbar.page.replace('{{num}}', '4'));
    fireEvent.mouseDown(pageItem);

    expect(onPageChange).toHaveBeenCalledWith(4);
    expect(input.value).toBe('4');
  });

  test('点击组件外部区域后应关闭页码下拉', async () => {
    await renderPageNavigator({
      currentPage: 2,
      totalPages: 3,
      sides: layoutSides.doubleSides,
    });

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    await screen.findByText(zhLocale.toolbar.page.replace('{{num}}', '5'));

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByText(zhLocale.toolbar.page.replace('{{num}}', '5'))).toBeNull();
    });
  });

  test('Enter 应提交合法页码，Escape 与非法 blur 应恢复当前页', async () => {
    const { onPageChange } = await renderPageNavigator({
      currentPage: 2,
      totalPages: 3,
      sides: layoutSides.doubleSides,
    });

    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onPageChange).toHaveBeenCalledWith(4);

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('2');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(input.value).toBe('2');
    });
  });

  test('blur 时输入合法且与当前页不同的页码，应触发跳页', async () => {
    const { onPageChange } = await renderPageNavigator({
      currentPage: 2,
      totalPages: 3,
      sides: layoutSides.oneSide,
    });

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(onPageChange).toHaveBeenCalledWith(4);
    });
  });

  test('currentPage 属性变化后应同步刷新输入框值', async () => {
    const { PageNavigator, renderResult } = await renderPageNavigator({
      currentPage: 1,
      totalPages: 3,
      sides: layoutSides.doubleSides,
    });

    const input = screen.getByRole('textbox');
    expect(input.value).toBe('1');

    renderResult.rerender(
      <PageNavigator
        currentPage={4}
        totalPages={3}
        onPageChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('textbox').value).toBe('4');
    });
  });
});




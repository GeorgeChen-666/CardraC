// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import zhLocale from '../../../../main/locales/zh.json';
import { cleanupRendererCase } from '../../setup/rendererCaseBootstrap';
import { renderActualSetupDialog } from '../../helpers/configTestHelpers';

const { configDialog, button } = zhLocale;

vi.mock('../../../parts/ToolBar/Setup/ConfigOverview', () => ({
  ConfigOverview: () => React.createElement('div', { 'data-testid': 'setup-config-overview' }),
}));

vi.mock('../../../parts/ToolBar/Setup/TemplateMenu', () => ({
  TemplateMenu: () => React.createElement('div', { 'data-testid': 'setup-template-menu' }),
}));

describe('参数设置对话框', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    cleanupRendererCase();
  });

  test('打开后应显示默认布局页签且重置按钮初始禁用，点击确定可关闭', async () => {
    const { ref, user } = await renderActualSetupDialog();

    ref.current.openDialog();

    expect(await screen.findByText(`${configDialog.setup}:`)).toBeTruthy();
    expect(screen.getByRole('tab', { name: configDialog.layout, selected: true })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: configDialog.pageNumber })).toBeTruthy();
    expect(screen.getByRole('button', { name: button.reset }).disabled).toBe(true);
    expect(screen.getByTestId('setup-config-overview')).toBeTruthy();
    expect(screen.getByTestId('setup-template-menu')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: button.ok }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  test('修改配置后应启用重置按钮并在点击重置后回滚到打开时快照', async () => {
    const { ref, user } = await renderActualSetupDialog({
      state: {
        Config: {
          pageNumber: false,
        },
      },
    });

    ref.current.openDialog();

    const pageNumberCheckbox = await screen.findByRole('checkbox', { name: configDialog.pageNumber });
    const resetButton = screen.getByRole('button', { name: button.reset });

    expect(pageNumberCheckbox.checked).toBe(false);
    expect(resetButton.disabled).toBe(true);

    await user.click(pageNumberCheckbox);

    const { useGlobalStore } = await import('../../../state/store');
    expect(useGlobalStore.getState().Config.pageNumber).toBe(true);
    expect(resetButton.disabled).toBe(false);

    await user.click(resetButton);

    expect(useGlobalStore.getState().Config.pageNumber).toBe(false);
    expect(screen.getByRole('checkbox', { name: configDialog.pageNumber }).checked).toBe(false);
    expect(resetButton.disabled).toBe(true);
  });

  test('点击确定关闭后应保留改动，并在再次打开时以当前配置作为新的重置基线', async () => {
    const { ref, user } = await renderActualSetupDialog({
      state: {
        Config: {
          pageNumber: false,
        },
      },
    });

    ref.current.openDialog();

    const pageNumberCheckbox = await screen.findByRole('checkbox', { name: configDialog.pageNumber });
    await user.click(pageNumberCheckbox);
    const { useGlobalStore } = await import('../../../state/store');
    await user.click(screen.getByRole('button', { name: button.ok }));

    expect(useGlobalStore.getState().Config.pageNumber).toBe(true);

    ref.current.openDialog();

    const reopenedCheckbox = await screen.findByRole('checkbox', { name: configDialog.pageNumber });
    const resetButton = screen.getByRole('button', { name: button.reset });

    expect(reopenedCheckbox.checked).toBe(true);
    expect(resetButton.disabled).toBe(true);
  });

  test('应支持切换页签显示卡牌和其它设置面板', async () => {
    const { ref, user } = await renderActualSetupDialog({
      state: {
        Config: {
          marginFilling: false,
          fCutLine: '1',
        },
      },
    });

    ref.current.openDialog();

    await user.click(await screen.findByRole('tab', { name: configDialog.card }));
    expect(screen.getByRole('checkbox', { name: configDialog.marginFilling })).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: configDialog.other }));
    const visiblePanel = screen.getAllByRole('tabpanel').find((panel) => !panel.hidden);
    expect(visiblePanel).toBeTruthy();
    expect(within(visiblePanel).getAllByRole('radio', { name: configDialog.normal }).length).toBeGreaterThan(0);
  });
});


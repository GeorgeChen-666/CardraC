// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import zhLocale from '../../../../main/locales/zh.json';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../../setup/rendererCaseBootstrap';

const { toolbar: t, configDialog } = zhLocale;

vi.mock('../../../parts/ToolBar/Setup/ConfigOverview', () => ({
  ConfigOverview: () => <div data-testid="setup-config-overview" />,
}));

vi.mock('../../../parts/ToolBar/Setup/TemplateMenu', () => ({
  TemplateMenu: () => <div data-testid="setup-template-menu" />,
}));

const renderToolbarWithRealSetupDialog = async (state = {}) => {
  bootstrapRendererCase({
    currentView: 'edit',
    state,
    mocks: {
      components: {
        SetupDialog: 'actual',
      },
    },
  });

  const { EditToolbar } = await import('../../../parts/edit/Toolbar');
  renderRendererCase(<EditToolbar />);
};

describe('工具栏设置入口', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    cleanupRendererCase();
  });

  test('点击工具栏设置按钮应打开真实参数设置对话框', async () => {
    await renderToolbarWithRealSetupDialog();

    screen.getByRole('button', { name: t.btnConfig }).click();

    expect(await screen.findByText(`${configDialog.setup}:`)).toBeTruthy();
    expect(screen.getByRole('tab', { name: configDialog.layout, selected: true })).toBeTruthy();
  });
});






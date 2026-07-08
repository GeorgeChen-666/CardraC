// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import zhLocale from '../../../../main/locales/zh.json';
import { initialState } from '../../../../shared/constants';
import { cleanupRendererCase } from '../../setup/rendererCaseBootstrap';
import { renderActualSetupDialog } from '../../helpers/configTestHelpers';

vi.mock('../../../parts/ToolBar/Setup/ConfigOverview', () => ({
  ConfigOverview: () => React.createElement('div', { 'data-testid': 'setup-config-overview' }),
}));

const { configDialog, button, util } = zhLocale;

describe('模板菜单', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    cleanupRendererCase();
  });

  test('应支持加载并套用模板配置', async () => {
    const { ref, user } = await renderActualSetupDialog({
      mocks: {
        functions: {
          getTemplate: async () => [{
            id: 'tpl-1',
            TemplateName: '模板一',
            Config: {
              pageNumber: true,
              marginFilling: true,
            },
          }],
        },
      },
    });

    ref.current.openDialog();
    await screen.findByText(`${configDialog.setup}:`);

    await user.click(screen.getByRole('button', { name: configDialog.clickMenuLoadConfig }));
    await user.click(await screen.findByText('模板一'));

    const { useGlobalStore } = await import('../../../state/store');
    expect(useGlobalStore.getState().Config.pageNumber).toBe(true);
    expect(useGlobalStore.getState().Config.marginFilling).toBe(true);
  });

  test('应用模板时不应污染初始配置和模板源对象', async () => {
    const templateList = [{
      id: 'tpl-safe-apply',
      TemplateName: '稳定模板',
      Config: {
        pageNumber: true,
        globalBackground: { path: 'template-bg.png' },
      },
    }];

    const { ref, user } = await renderActualSetupDialog({
      mocks: {
        functions: {
          getTemplate: async () => templateList,
        },
      },
    });

    ref.current.openDialog();
    await screen.findByText(`${configDialog.setup}:`);

    await user.click(screen.getByRole('button', { name: configDialog.clickMenuLoadConfig }));
    await user.click(await screen.findByRole('menuitem', { name: /稳定模板/ }));

    const { useGlobalStore } = await import('../../../state/store');
    expect(useGlobalStore.getState().Config.pageNumber).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(initialState.Config, 'globalBackground')).toBe(true);
    expect(initialState.Config.globalBackground).toBeNull();
    expect(templateList[0].Config.globalBackground).toEqual({ path: 'template-bg.png' });
  });

  test('模板应用后的 reset、ok 与 reopen 应使用正确的配置基线', async () => {
    const templateList = [{
      id: 'tpl-baseline',
      TemplateName: '模板基线',
      Config: {
        pageNumber: true,
      },
    }];

    const { ref, user } = await renderActualSetupDialog({
      state: {
        Config: {
          pageNumber: false,
        },
      },
      mocks: {
        functions: {
          getTemplate: async () => templateList,
        },
      },
    });

    ref.current.openDialog();
    await screen.findByText(`${configDialog.setup}:`);

    const resetButton = screen.getByRole('button', { name: button.reset });
    const pageNumberCheckbox = screen.getByRole('checkbox', { name: configDialog.pageNumber });
    expect(pageNumberCheckbox.checked).toBe(false);

    await user.click(screen.getByRole('button', { name: configDialog.clickMenuLoadConfig }));
    await user.click(await screen.findByRole('menuitem', { name: /模板基线/ }));
    expect(screen.getByRole('checkbox', { name: configDialog.pageNumber }).checked).toBe(true);
    expect(resetButton.disabled).toBe(false);

    await user.click(resetButton);
    expect(screen.getByRole('checkbox', { name: configDialog.pageNumber }).checked).toBe(false);
    expect(resetButton.disabled).toBe(true);

    await user.click(screen.getByRole('button', { name: configDialog.clickMenuLoadConfig }));
    await user.click(await screen.findByRole('menuitem', { name: /模板基线/ }));
    await user.click(screen.getByRole('button', { name: button.ok }));

    ref.current.openDialog();
    const reopenedCheckbox = await screen.findByRole('checkbox', { name: configDialog.pageNumber });
    const reopenedResetButton = screen.getByRole('button', { name: button.reset });
    expect(reopenedCheckbox.checked).toBe(true);
    expect(reopenedResetButton.disabled).toBe(true);

    await user.click(reopenedCheckbox);
    expect(screen.getByRole('checkbox', { name: configDialog.pageNumber }).checked).toBe(false);
    expect(reopenedResetButton.disabled).toBe(false);

    await user.click(reopenedResetButton);
    expect(screen.getByRole('checkbox', { name: configDialog.pageNumber }).checked).toBe(true);
  });

  test('应支持保存当前配置为模板', async () => {
    const setTemplateMock = vi.fn(async () => true);
    const { ref, user } = await renderActualSetupDialog({
      mocks: {
        functions: {
          setTemplate: setTemplateMock,
        },
      },
    });

    ref.current.openDialog();
    await screen.findByText(`${configDialog.setup}:`);

    await user.click(screen.getByRole('button', { name: configDialog.saveCurrentConfig }));

    const nameInput = screen.getByRole('textbox');
    await user.clear(nameInput);
    await user.type(nameInput, '我的模板');
    await user.click((await screen.findAllByRole('button')).find((btn) => btn.querySelector('[data-testid="CheckIcon"]')));

    expect(setTemplateMock).toHaveBeenCalledWith({ templateName: '我的模板' });
  });

  test('应支持重命名模板', async () => {
    const editTemplateMock = vi.fn(async () => true);
    const { ref, user } = await renderActualSetupDialog({
      mocks: {
        functions: {
          getTemplate: async () => [{
            id: 'tpl-rename',
            TemplateName: '旧模板名',
            Config: {},
          }],
          editTemplate: editTemplateMock,
        },
      },
    });

    ref.current.openDialog();
    await screen.findByText(`${configDialog.setup}:`);

    await user.click(screen.getByRole('button', { name: configDialog.clickMenuLoadConfig }));
    await user.click((await screen.findAllByRole('button')).find((btn) => btn.querySelector('[data-testid="EditIcon"]')));

    const nameInput = screen.getByRole('textbox');
    await user.clear(nameInput);
    await user.type(nameInput, '新模板名');
    await user.click((await screen.findAllByRole('button')).find((btn) => btn.querySelector('[data-testid="CheckIcon"]')));

    expect(editTemplateMock).toHaveBeenCalledWith({ id: 'tpl-rename', templateName: '新模板名' });
  });

  test('应支持取消模板编辑而不提交保存', async () => {
    const editTemplateMock = vi.fn(async () => true);
    const { ref, user } = await renderActualSetupDialog({
      mocks: {
        functions: {
          getTemplate: async () => [{
            id: 'tpl-cancel',
            TemplateName: '取消编辑模板',
            Config: {},
          }],
          editTemplate: editTemplateMock,
        },
      },
    });

    ref.current.openDialog();
    await screen.findByText(`${configDialog.setup}:`);

    await user.click(screen.getByRole('button', { name: configDialog.clickMenuLoadConfig }));
    await user.click((await screen.findAllByRole('button')).find((btn) => btn.querySelector('[data-testid="EditIcon"]')));
    await user.click((await screen.findAllByRole('button')).find((btn) => btn.querySelector('[data-testid="ClearIcon"]')));

    expect(editTemplateMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  test('应支持删除模板并弹出确认对话框', async () => {
    const deleteTemplateMock = vi.fn(async () => true);
    const { ref, user } = await renderActualSetupDialog({
      mocks: {
        functions: {
          getTemplate: async () => [{
            id: 'tpl-2',
            TemplateName: '待删除模板',
            Config: {},
          }],
          deleteTemplate: deleteTemplateMock,
        },
      },
    });

    ref.current.openDialog();
    await screen.findByText(`${configDialog.setup}:`);

    await user.click(screen.getByRole('button', { name: configDialog.clickMenuLoadConfig }));
    await user.click((await screen.findAllByRole('button')).find((button) => button.querySelector('[data-testid="DeleteOutlineIcon"]')));

    expect(await screen.findByText(util.confirmDelete)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: button.yes }));

    expect(deleteTemplateMock).toHaveBeenCalledWith({ id: 'tpl-2' });
  });
});




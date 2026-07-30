// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import zhLocale from '../../../../main/locales/zh.json';
import { flipWay, layoutSides } from '../../../../shared/constants';
import { cleanupRendererCase } from '../../setup/rendererCaseBootstrap';
import { renderActualSetupDialog } from '../../helpers/configTestHelpers';

vi.mock('../../../parts/ToolBar/Setup/ConfigOverview', () => ({
  ConfigOverview: () => React.createElement('div', { 'data-testid': 'setup-config-overview' }),
}));

vi.mock('../../../parts/ToolBar/Setup/TemplateMenu', () => ({
  TemplateMenu: () => React.createElement('div', { 'data-testid': 'setup-template-menu' }),
}));

const { configDialog } = zhLocale;

const openLayoutDialog = async (state = {}) => {
  const result = await renderActualSetupDialog({ state });
  result.ref.current.openDialog();
  await screen.findByText(`${configDialog.setup}:`);
  return { ...result, user: userEvent.setup() };
};

describe('布局配置', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    cleanupRendererCase();
  });

  test('应支持切换单双面模式', async () => {
    const { user } = await openLayoutDialog({
      Config: {
        sides: layoutSides.oneSide,
      },
    });

    await user.click(screen.getByRole('combobox', { name: configDialog.side }));
    await user.click(await screen.findByRole('option', { name: configDialog.doubleSides }));

    const { useGlobalStore } = await import('../../../state/store');
    expect(useGlobalStore.getState().Config.sides).toBe(layoutSides.doubleSides);
    expect(await screen.findByRole('combobox', { name: configDialog.flip })).toBeTruthy();
  });

  test('应支持切换横置状态', async () => {
    const { user } = await openLayoutDialog({
      Config: {
        landscape: true,
      },
    });

    const landscapeCheckbox = screen.getByRole('checkbox', { name: configDialog.landscape });
    expect(landscapeCheckbox.checked).toBe(true);

    await user.click(landscapeCheckbox);

    const { useGlobalStore } = await import('../../../state/store');
    expect(useGlobalStore.getState().Config.landscape).toBe(false);
  });

  test('应支持调整页面尺寸相关配置', async () => {
    const { user } = await openLayoutDialog({
      Config: {
        pageSize: 'A4:210,297',
        pageWidth: 210,
        pageHeight: 297,
      },
    });

    await user.click(screen.getByRole('combobox', { name: configDialog.size }));
    await user.click(await screen.findByRole('option', { name: 'A3' }));

    const { useGlobalStore } = await import('../../../state/store');
    expect(useGlobalStore.getState().Config.pageSize).toBe('A3:297,420');
    expect(useGlobalStore.getState().Config.pageWidth).toBe(297);
    expect(useGlobalStore.getState().Config.pageHeight).toBe(420);

    const pageWidthInput = screen.getByRole('spinbutton', { name: configDialog.pageWidthHeight });
    await user.clear(pageWidthInput);
    await user.type(pageWidthInput, '333');
    pageWidthInput.blur();

    expect(useGlobalStore.getState().Config.pageWidth).toBe(333);
    expect(useGlobalStore.getState().Config.pageSize).toBe('custom');

    const offsetInput = screen.getByRole('spinbutton', { name: configDialog.offsetXY });
    await user.clear(offsetInput);
    await user.type(offsetInput, '12');
    offsetInput.blur();

    expect(useGlobalStore.getState().Config.offsetX).toBe(12);
  });

  test('应支持直接调整 pageHeight 与 offsetY', async () => {
    const { user } = await openLayoutDialog({
      Config: {
        pageSize: 'custom',
        pageWidth: 210,
        pageHeight: 297,
        offsetX: 0,
        offsetY: 0,
      },
    });

    const spinbuttons = screen.getAllByRole('spinbutton');
    const pageHeightInput = spinbuttons[1];
    const offsetYInput = spinbuttons[3];

    await user.clear(pageHeightInput);
    await user.type(pageHeightInput, '444');
    pageHeightInput.blur();

    await user.clear(offsetYInput);
    await user.type(offsetYInput, '15');
    offsetYInput.blur();

    const { useGlobalStore } = await import('../../../state/store');
    expect(useGlobalStore.getState().Config.pageHeight).toBe(444);
    expect(useGlobalStore.getState().Config.pageSize).toBe('custom');
    expect(useGlobalStore.getState().Config.offsetY).toBe(15);
  });

  test('双面模式下应支持切换翻面方式', async () => {
    const { user } = await openLayoutDialog({
      Config: {
        sides: layoutSides.doubleSides,
        flip: flipWay.longEdgeBinding,
      },
    });

    await user.click(screen.getByRole('combobox', { name: configDialog.flip }));
    await user.click(await screen.findByRole('option', { name: configDialog.shortEdgeBinding }));

    const { useGlobalStore } = await import('../../../state/store');
    expect(useGlobalStore.getState().Config.flip).toBe(flipWay.shortEdgeBinding);
  });

  test('不同排版模式下应按规则显示翻面与折线方向配置', async () => {
    const { user } = await openLayoutDialog({
      Config: {
        sides: layoutSides.oneSide,
      },
    });

    const sideSelect = screen.getByRole('combobox', { name: configDialog.side });
    expect(screen.queryByRole('combobox', { name: configDialog.flip })).toBeNull();
    expect(screen.queryByRole('radio', { name: configDialog.foldLineH })).toBeNull();

    await user.click(sideSelect);
    await user.click(await screen.findByRole('option', { name: configDialog.doubleSides }));
    expect(await screen.findByRole('combobox', { name: configDialog.flip })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: configDialog.foldLineH })).toBeNull();

    await user.click(screen.getByRole('combobox', { name: configDialog.side }));
    await user.click(await screen.findByRole('option', { name: configDialog.brochure }));
    expect(await screen.findByRole('combobox', { name: configDialog.flip })).toBeTruthy();

    await user.click(screen.getByRole('combobox', { name: configDialog.side }));
    await user.click(await screen.findByRole('option', { name: configDialog.foldInHalf }));
    expect(screen.queryByRole('combobox', { name: configDialog.flip })).toBeNull();
    expect(await screen.findByRole('radio', { name: configDialog.foldLineH })).toBeTruthy();
    expect(screen.getByRole('radio', { name: configDialog.foldLineV })).toBeTruthy();
  });

  test('autoConfigFlip 为 true 时翻面方式输入应禁用', async () => {
    await openLayoutDialog({
      Config: {
        sides: layoutSides.doubleSides,
        autoConfigFlip: true,
      },
    });

    expect(screen.getByRole('combobox', { name: configDialog.flip }).getAttribute('aria-disabled')).toBe('true');
  });

  test('对贴模式下应显示折叠线方向并支持切换', async () => {
    const { user } = await openLayoutDialog({
      Config: {
        sides: layoutSides.foldInHalf,
        foldLineType: '0',
      },
    });

    const visiblePanel = screen.getAllByRole('tabpanel').find((panel) => !panel.hidden);
    const [foldLineGroup] = within(visiblePanel).getAllByRole('radiogroup');
    await user.click(within(foldLineGroup).getByRole('radio', { name: configDialog.foldLineV }));

    const { useGlobalStore } = await import('../../../state/store');
    expect(useGlobalStore.getState().Config.foldLineType).toBe('1');
  });

  test('应支持切换页码显示开关', async () => {
    const { user } = await openLayoutDialog({
      Config: {
        pageNumber: false,
      },
    });

    const pageNumberCheckbox = screen.getByRole('checkbox', { name: configDialog.pageNumber });
    expect(pageNumberCheckbox.checked).toBe(false);

    await user.click(pageNumberCheckbox);

    const { useGlobalStore } = await import('../../../state/store');
    expect(useGlobalStore.getState().Config.pageNumber).toBe(true);
  });
});


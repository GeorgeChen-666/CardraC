// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import zhLocale from '../../../../main/locales/zh.json';
import { layoutSides } from '../../../../shared/constants';
import { cleanupRendererCase } from '../../setup/rendererCaseBootstrap';
import { renderActualSetupDialog } from '../../helpers/configTestHelpers';

vi.mock('../../../parts/ToolBar/Setup/ConfigOverview', () => ({
  ConfigOverview: () => React.createElement('div', { 'data-testid': 'setup-config-overview' }),
}));

vi.mock('../../../parts/ToolBar/Setup/TemplateMenu', () => ({
  TemplateMenu: () => React.createElement('div', { 'data-testid': 'setup-template-menu' }),
}));

const { configDialog } = zhLocale;

const openCardPanel = async (state = {}) => {
  const { ref, user } = await renderActualSetupDialog({ state });
  ref.current.openDialog();
  await screen.findByText(`${configDialog.setup}:`);
  await user.click(await screen.findByRole('tab', { name: configDialog.card }));
  const visiblePanel = screen.getAllByRole('tabpanel').find((panel) => !panel.hidden);
  return { user, panel: visiblePanel };
};

describe('卡牌配置', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    cleanupRendererCase();
  });

  test('应支持切换自动行列开关', async () => {
    const { user, panel } = await openCardPanel({
      Config: {
        autoColumnsRows: true,
      },
    });

    const autoCheckbox = within(panel).getByRole('checkbox', { name: configDialog.auto });
    expect(autoCheckbox.checked).toBe(true);

    await user.click(autoCheckbox);

    const { useGlobalStore } = await import('../../../state/store');
    expect(useGlobalStore.getState().Config.autoColumnsRows).toBe(false);
  });

  test('自动行列开启时 rows/columns 输入应禁用，关闭后可手动修改', async () => {
    const { user, panel } = await openCardPanel({
      Config: {
        autoColumnsRows: true,
      },
    });

    expect(within(panel).getAllByRole('spinbutton').filter((input) => input.disabled)).toHaveLength(2);

    const autoCheckbox = within(panel).getByRole('checkbox', { name: configDialog.auto });
    await user.click(autoCheckbox);

    await waitFor(() => {
      expect(within(panel).getAllByRole('spinbutton').filter((input) => input.disabled)).toHaveLength(0);
    });

    const rowInput = within(panel).getByRole('spinbutton', { name: configDialog.columns_rows });
    await user.clear(rowInput);
    await user.type(rowInput, '5');
    rowInput.blur();

    const { useGlobalStore } = await import('../../../state/store');
    expect(useGlobalStore.getState().Config.autoColumnsRows).toBe(false);
    expect(useGlobalStore.getState().Config.rows).toBe(5);
  });

  test('应支持切换边距填充', async () => {
    const { user, panel } = await openCardPanel({
      Config: {
        marginFilling: false,
      },
    });

    const marginFillingCheckbox = within(panel).getByRole('checkbox', { name: configDialog.marginFilling });
    expect(marginFillingCheckbox.checked).toBe(false);

    await user.click(marginFillingCheckbox);

    const { useGlobalStore } = await import('../../../state/store');
    expect(useGlobalStore.getState().Config.marginFilling).toBe(true);
  });

  test('非小册子模式下出血输入超限后应在失焦时钳制到边距一半', async () => {
    const { user, panel } = await openCardPanel({
      Config: {
        sides: layoutSides.doubleSides,
        marginX: 6,
        marginY: 8,
        bleedX: 1.1,
        bleedY: 1.2,
        autoColumnsRows: false,
      },
    });

    const spinbuttons = within(panel).getAllByRole('spinbutton');
    const bleedXInput = spinbuttons.find((input) => Number(input.value) === 1.1);
    const bleedYInput = spinbuttons.find((input) => Number(input.value) === 1.2);

    await user.clear(bleedXInput);
    await user.type(bleedXInput, '9');
    bleedXInput.blur();

    await user.clear(bleedYInput);
    await user.type(bleedYInput, '12');
    bleedYInput.blur();

    const { useGlobalStore } = await import('../../../state/store');
    await waitFor(() => {
      expect(useGlobalStore.getState().Config.bleedX).toBe(3);
      expect(useGlobalStore.getState().Config.bleedY).toBe(4);
      expect(Number(bleedXInput.value)).toBe(3);
      expect(Number(bleedYInput.value)).toBe(4);
    });
  });

  test('双面模式下应支持切换牌背防错位', async () => {
    const { user, panel } = await openCardPanel({
      Config: {
        avoidDislocation: false,
      },
    });

    const avoidDislocationCheckbox = within(panel).getByRole('checkbox', { name: configDialog.avoidDislocation });
    expect(avoidDislocationCheckbox.checked).toBe(false);

    await user.click(avoidDislocationCheckbox);

    const { useGlobalStore } = await import('../../../state/store');
    expect(useGlobalStore.getState().Config.avoidDislocation).toBe(true);
  });

  test('对贴模式下应支持切换对贴间距', async () => {
    const { user, panel } = await openCardPanel({
      Config: {
        sides: layoutSides.foldInHalf,
        foldInHalfMargin: 3,
      },
    });

    const foldMarginInput = within(panel).getByRole('spinbutton', { name: configDialog.foldInHalfMargin });
    await user.clear(foldMarginInput);
    await user.type(foldMarginInput, '8');
    foldMarginInput.blur();

    const { useGlobalStore } = await import('../../../state/store');
    expect(useGlobalStore.getState().Config.foldInHalfMargin).toBe(8);
  });

  test('对贴模式下 rows/columns 的最小值与步进应随折线方向切换', async () => {
    const { panel } = await openCardPanel({
      Config: {
        sides: layoutSides.foldInHalf,
        foldLineType: '0',
        autoColumnsRows: false,
        rows: 4,
        columns: 6,
      },
    });

    const rowInput = within(panel).getByRole('spinbutton', { name: configDialog.columns_rows });
    let columnInput = within(panel).getAllByRole('spinbutton').find((input) => Number(input.value) === 6);

    expect(rowInput.min).toBe('2');
    expect(rowInput.step).toBe('2');
    expect(columnInput.min).toBe('1');
    expect(columnInput.step).toBe('1');

    const { useGlobalStore } = await import('../../../state/store');
    await act(async () => {
      useGlobalStore.getState().mergeConfig({ foldLineType: '1' });
    });

    await waitFor(() => {
      const nextRowInput = within(panel).getByRole('spinbutton', { name: configDialog.columns_rows });
      const nextColumnInput = within(panel).getAllByRole('spinbutton').find((input) => Number(input.value) === 6);
      expect(nextRowInput.min).toBe('1');
      expect(nextRowInput.step).toBe('1');
      expect(nextColumnInput.min).toBe('2');
      expect(nextColumnInput.step).toBe('2');
    });
  });

  test('小册子模式下应支持切换每页重复开关', async () => {
    const { user, panel } = await openCardPanel({
      Config: {
        sides: layoutSides.brochure,
        brochureRepeatPerPage: false,
      },
    });

    const brochureRepeatCheckbox = within(panel).getByRole('checkbox', { name: configDialog.brochureRepeatPerPage });
    await user.click(brochureRepeatCheckbox);

    const { useGlobalStore } = await import('../../../state/store');
    expect(useGlobalStore.getState().Config.brochureRepeatPerPage).toBe(true);
  });

  test('小册子模式下应隐藏非适用字段并保留小册子专属配置', async () => {
    const { panel } = await openCardPanel({
      Config: {
        sides: layoutSides.brochure,
      },
    });

    expect(within(panel).queryByRole('spinbutton', { name: `${configDialog.marginX} / ${configDialog.marginY}` })).toBeNull();
    expect(within(panel).queryByRole('checkbox', { name: configDialog.marginFilling })).toBeNull();
    expect(within(panel).queryByRole('checkbox', { name: configDialog.avoidDislocation })).toBeNull();
    expect(within(panel).getByRole('checkbox', { name: configDialog.brochureRepeatPerPage })).toBeTruthy();
  });

  test('应支持交换卡牌宽高', async () => {
    const { user, panel } = await openCardPanel({
      Config: {
        cardWidth: 63,
        cardHeight: 88,
      },
    });

    await user.click(within(panel).getByRole('button', { name: configDialog.saveCurrentConfig }));

    const { useGlobalStore } = await import('../../../state/store');
    expect(useGlobalStore.getState().Config.cardWidth).toBe(88);
    expect(useGlobalStore.getState().Config.cardHeight).toBe(63);
  });
});




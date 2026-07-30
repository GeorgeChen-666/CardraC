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

const openLayoutDialog = async (state = {}) => {
  const result = await renderActualSetupDialog({ state });
  result.ref.current.openDialog();
  await screen.findByText(`${configDialog.setup}:`);
  return result;
};

describe('自动行列计算', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    cleanupRendererCase();
  });

  test('自动行列开启时应按页面尺寸重算并限制出血', async () => {
    await renderActualSetupDialog({
      state: {
        Config: {
          sides: layoutSides.doubleSides,
          autoColumnsRows: true,
          landscape: false,
          pageSize: 'custom',
          pageWidth: 210,
          pageHeight: 297,
          cardWidth: 63,
          cardHeight: 88,
          marginX: 3,
          marginY: 3,
          foldInHalfMargin: 0,
          bleedX: 8,
          bleedY: 9,
          columns: 99,
          rows: 99,
        },
      },
    });

    const { useGlobalStore } = await import('../../../state/store');

    await waitFor(() => {
      const config = useGlobalStore.getState().Config;
      expect(config.columns).toBe(3);
      expect(config.rows).toBe(3);
      expect(config.bleedX).toBe(1.5);
      expect(config.bleedY).toBe(1.5);
    });
  });

  test('小册子模式应忽略卡间距并保留原始出血值', async () => {
    await renderActualSetupDialog({
      state: {
        Config: {
          sides: layoutSides.brochure,
          autoColumnsRows: true,
          landscape: false,
          pageSize: 'custom',
          pageWidth: 210,
          pageHeight: 297,
          cardWidth: 50,
          cardHeight: 60,
          marginX: 40,
          marginY: 30,
          bleedX: 20,
          bleedY: 30,
          columns: 9,
          rows: 9,
        },
      },
    });

    const { useGlobalStore } = await import('../../../state/store');

    await waitFor(() => {
      const config = useGlobalStore.getState().Config;
      expect(config.columns).toBe(1);
      expect(config.rows).toBe(4);
      expect(config.bleedX).toBe(20);
      expect(config.bleedY).toBe(30);
    });
  });

  test('对贴横向折线时应将奇数行修正为偶数', async () => {
    await renderActualSetupDialog({
      state: {
        Config: {
          sides: layoutSides.foldInHalf,
          autoColumnsRows: true,
          foldLineType: '0',
          landscape: false,
          pageSize: 'custom',
          pageWidth: 210,
          pageHeight: 340,
          cardWidth: 50,
          cardHeight: 80,
          marginX: 10,
          marginY: 10,
          foldInHalfMargin: 20,
          rows: 1,
        },
      },
    });

    const { useGlobalStore } = await import('../../../state/store');

    await waitFor(() => {
      const config = useGlobalStore.getState().Config;
      expect(config.columns).toBe(3);
      expect(config.rows).toBe(2);
    });
  });

  test('切换为竖向折线后应将奇数列修正为偶数', async () => {
    const { user } = await openLayoutDialog({
      Config: {
        sides: layoutSides.foldInHalf,
        autoColumnsRows: true,
        foldLineType: '0',
        landscape: false,
        pageSize: 'custom',
        pageWidth: 400,
        pageHeight: 300,
        cardWidth: 60,
        cardHeight: 80,
        marginX: 10,
        marginY: 10,
        foldInHalfMargin: 20,
        columns: 1,
        rows: 1,
      },
    });

    const { useGlobalStore } = await import('../../../state/store');

    await waitFor(() => {
      expect(useGlobalStore.getState().Config.columns).toBe(5);
    });

    const visiblePanel = screen.getAllByRole('tabpanel').find((panel) => !panel.hidden);
    const [foldLineGroup] = within(visiblePanel).getAllByRole('radiogroup');
    await user.click(within(foldLineGroup).getByRole('radio', { name: configDialog.foldLineV }));

    await waitFor(() => {
      const config = useGlobalStore.getState().Config;
      expect(config.foldLineType).toBe('1');
      expect(config.columns).toBe(4);
      expect(config.rows).toBe(2);
    });
  });

  test('切换横置状态后应立即按新方向重算自动行列', async () => {
    await renderActualSetupDialog({
      state: {
        Config: {
          sides: layoutSides.doubleSides,
          autoColumnsRows: true,
          landscape: false,
          pageSize: 'custom',
          pageWidth: 210,
          pageHeight: 297,
          cardWidth: 63,
          cardHeight: 88,
          marginX: 3,
          marginY: 3,
          foldInHalfMargin: 0,
          columns: 99,
          rows: 99,
        },
      },
    });

    const { useGlobalStore } = await import('../../../state/store');

    await waitFor(() => {
      const config = useGlobalStore.getState().Config;
      expect(config.columns).toBe(3);
      expect(config.rows).toBe(3);
    });

    await act(async () => {
      useGlobalStore.getState().mergeConfig({ landscape: true });
    });

    await waitFor(() => {
      const config = useGlobalStore.getState().Config;
      expect(config.landscape).toBe(true);
      expect(config.columns).toBe(4);
      expect(config.rows).toBe(2);
    });
  });

  test('页面过小或卡片过大时自动行列应至少托底为 1', async () => {
    await renderActualSetupDialog({
      state: {
        Config: {
          sides: layoutSides.doubleSides,
          autoColumnsRows: true,
          landscape: false,
          pageSize: 'custom',
          pageWidth: 100,
          pageHeight: 100,
          cardWidth: 500,
          cardHeight: 500,
          marginX: 10,
          marginY: 10,
          foldInHalfMargin: 0,
          columns: 8,
          rows: 8,
        },
      },
    });

    const { useGlobalStore } = await import('../../../state/store');

    await waitFor(() => {
      const config = useGlobalStore.getState().Config;
      expect(config.columns).toBe(1);
      expect(config.rows).toBe(1);
    });
  });

  test('卡间距缩小时应再次收紧出血值', async () => {
    await renderActualSetupDialog({
      state: {
        Config: {
          sides: layoutSides.doubleSides,
          autoColumnsRows: true,
          landscape: false,
          pageSize: 'custom',
          pageWidth: 210,
          pageHeight: 297,
          cardWidth: 63,
          cardHeight: 88,
          marginX: 20,
          marginY: 20,
          foldInHalfMargin: 0,
          bleedX: 8,
          bleedY: 9,
        },
      },
    });

    const { useGlobalStore } = await import('../../../state/store');

    await waitFor(() => {
      const config = useGlobalStore.getState().Config;
      expect(config.bleedX).toBe(8);
      expect(config.bleedY).toBe(9);
    });

    await act(async () => {
      useGlobalStore.getState().mergeConfig({ marginX: 10, marginY: 12 });
    });

    await waitFor(() => {
      const config = useGlobalStore.getState().Config;
      expect(config.marginX).toBe(10);
      expect(config.marginY).toBe(12);
      expect(config.bleedX).toBe(5);
      expect(config.bleedY).toBe(6);
    });
  });

  test('关闭自动行列后调整页面尺寸不应覆盖手动行列', async () => {
    const { user } = await openLayoutDialog({
      Config: {
        autoColumnsRows: false,
        landscape: false,
        pageSize: 'A4:210,297',
        pageWidth: 210,
        pageHeight: 297,
        columns: 9,
        rows: 7,
      },
    });

    await user.click(screen.getByRole('combobox', { name: configDialog.size }));
    await user.click(await screen.findByRole('option', { name: 'A3' }));

    const { useGlobalStore } = await import('../../../state/store');

    await waitFor(() => {
      const config = useGlobalStore.getState().Config;
      expect(config.pageSize).toBe('A3:297,420');
      expect(config.pageWidth).toBe(297);
      expect(config.pageHeight).toBe(420);
      expect(config.columns).toBe(9);
      expect(config.rows).toBe(7);
    });
  });
});

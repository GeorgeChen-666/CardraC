// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import zhLocale from '../../../../main/locales/zh.json';
import { cleanupRendererCase } from '../../setup/rendererCaseBootstrap';
import { renderActualSetupDialog } from '../../helpers/configTestHelpers';

vi.mock('../../../parts/ToolBar/Setup/ConfigOverview', () => ({
  ConfigOverview: () => React.createElement('div', { 'data-testid': 'setup-config-overview' }),
}));

vi.mock('../../../parts/ToolBar/Setup/TemplateMenu', () => ({
  TemplateMenu: () => React.createElement('div', { 'data-testid': 'setup-template-menu' }),
}));

const { configDialog } = zhLocale;

const openOtherPanel = async (state = {}) => {
  const { ref, user } = await renderActualSetupDialog({ state });
  ref.current.openDialog();
  await screen.findByText(`${configDialog.setup}:`);
  await user.click(await screen.findByRole('tab', { name: configDialog.other }));
  const visiblePanel = screen.getAllByRole('tabpanel').find((panel) => !panel.hidden);
  return { user, panel: visiblePanel };
};

describe('标记配置', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    cleanupRendererCase();
  });

  test('应支持切换前切割线样式', async () => {
    const { user, panel } = await openOtherPanel({
      Config: {
        fCutLine: '1',
      },
    });

    const [frontCutlineGroup] = within(panel).getAllByRole('radiogroup');
    const noneRadio = within(frontCutlineGroup).getByRole('radio', { name: configDialog.none });
    await user.click(noneRadio);

    const { useGlobalStore } = await import('../../../state/store');
    expect(useGlobalStore.getState().Config.fCutLine).toBe('0');
  });

  test('双面模式下应支持切换后切割线样式', async () => {
    const { user, panel } = await openOtherPanel({
      Config: {
        bCutLine: '1',
      },
    });

    const [, backCutlineGroup] = within(panel).getAllByRole('radiogroup');
    const crossRadio = within(backCutlineGroup).getByRole('radio', { name: configDialog.cross });
    await user.click(crossRadio);

    const { useGlobalStore } = await import('../../../state/store');
    expect(useGlobalStore.getState().Config.bCutLine).toBe('2');
  });

  test('none 切割线配置在经过项目加载校验后仍应保留', async () => {
    await renderActualSetupDialog({
      mocks: {
        functions: {
          openProject: async () => ({
            Config: {
              fCutLine: '0',
              bCutLine: '0',
            },
            CardList: [],
          }),
        },
      },
    });

    const { useGlobalStore } = await import('../../../state/store');

    await act(async () => {
      await useGlobalStore.getState().openProject({ path: 'demo.cardrac' });
    });

    await waitFor(() => {
      const config = useGlobalStore.getState().Config;
      expect(config.fCutLine).toBe('0');
      expect(config.bCutLine).toBe('0');
    });
  });

  test('应支持调整切割线颜色与线宽', async () => {
    const { user, panel } = await openOtherPanel({
      Config: {
        cutlineColor: '#000000',
        lineWeight: 0.5,
      },
    });

    const colorInput = within(panel).getByLabelText(configDialog.color);
    fireEvent.change(colorInput, { target: { value: '#123456' } });

    const lineWeightInput = within(panel).getByRole('spinbutton', { name: configDialog.lineWeight });
    await user.clear(lineWeightInput);
    await user.type(lineWeightInput, '1.5');
    lineWeightInput.blur();

    const { useGlobalStore } = await import('../../../state/store');
    expect(useGlobalStore.getState().Config.cutlineColor).toBe('#123456');
    expect(useGlobalStore.getState().Config.lineWeight).toBe(1.5);
  });

  test('线宽输入负值后应在失焦时钳制为 0', async () => {
    const { user, panel } = await openOtherPanel({
      Config: {
        lineWeight: 0.5,
      },
    });

    const lineWeightInput = within(panel).getByRole('spinbutton', { name: configDialog.lineWeight });
    await user.clear(lineWeightInput);
    await user.type(lineWeightInput, '-3');
    lineWeightInput.blur();

    const { useGlobalStore } = await import('../../../state/store');
    await waitFor(() => {
      expect(useGlobalStore.getState().Config.lineWeight).toBe(0);
      expect(Number(lineWeightInput.value)).toBe(0);
    });
  });
});





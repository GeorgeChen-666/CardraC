// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import zhLocale from '../../../../main/locales/zh.json';
import { cleanupRendererCase } from '../../setup/rendererCaseBootstrap';
import { openGuideDialog } from '../../helpers/printTestHelpers';

const { configPrintDialog, button } = zhLocale;

describe('打印偏移修正向导', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test('点击偏移修正向导按钮应打开向导并允许关闭', async () => {
    const { user } = await openGuideDialog();

    expect(screen.getByText(configPrintDialog.guideStep1_title)).toBeTruthy();
    expect(screen.getByText(configPrintDialog.guideStep1_body)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: button.close }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: configPrintDialog.adjustOffsetGuide })).toBeNull();
    });
  });

  test('跳过打印步骤后应进入测量步骤并重置默认测量值', async () => {
    const { user } = await openGuideDialog();

    await user.click(screen.getByRole('button', { name: configPrintDialog.guideStep1_button2 }));

    await waitFor(() => {
      expect(screen.getByText(configPrintDialog.guideStep2_body)).toBeTruthy();
    });

    expect(screen.getByLabelText(configPrintDialog.guideStep2_body_field1).value).toBe('15');
    expect(screen.getByLabelText(configPrintDialog.guideStep2_body_field2).value).toBe('15');
    expect(screen.getByLabelText(configPrintDialog.guideStep2_body_field3).value).toBe('15');
    expect(screen.getByLabelText(configPrintDialog.guideStep2_body_field4).value).toBe('15');
  });

  test('开始打印后成功时应进入测量步骤', async () => {
    const { user } = await openGuideDialog();

    await user.click(screen.getByRole('button', { name: configPrintDialog.guideStep1_button1 }));

    await waitFor(() => {
      expect(screen.getByText(configPrintDialog.guideStep2_body)).toBeTruthy();
    });
  });

  test('测量完成后应用结果应更新抽屉中的偏移量并关闭向导', async () => {
    const { drawer, user } = await openGuideDialog();

    await user.click(screen.getByRole('button', { name: configPrintDialog.guideStep1_button2 }));

    const size1Input = await screen.findByLabelText(configPrintDialog.guideStep2_body_field1);
    const size2Input = screen.getByLabelText(configPrintDialog.guideStep2_body_field2);
    const size3Input = screen.getByLabelText(configPrintDialog.guideStep2_body_field3);
    const size4Input = screen.getByLabelText(configPrintDialog.guideStep2_body_field4);

    fireEvent.change(size1Input, { target: { value: '11' } });
    fireEvent.blur(size1Input);
    fireEvent.change(size2Input, { target: { value: '12' } });
    fireEvent.blur(size2Input);
    fireEvent.change(size3Input, { target: { value: '19' } });
    fireEvent.blur(size3Input);
    fireEvent.change(size4Input, { target: { value: '24' } });
    fireEvent.blur(size4Input);

    await user.click(screen.getByRole('button', { name: configPrintDialog.guideStep2_button1 }));

    await waitFor(() => {
      expect(screen.getByText('需要设定偏移：横向4，纵向6')).toBeTruthy();
    });

    await user.click(screen.getByRole('button', { name: configPrintDialog.guideStep3_button1 }));

    await waitFor(() => {
      expect(screen.queryByText(configPrintDialog.guideStep3_title)).toBeNull();
    });

    expect(within(drawer).getByLabelText(configPrintDialog.offsetXY).value).toBe('4');
    expect(within(drawer).getAllByRole('spinbutton')[3].value).toBe('6');
  });

  test('测量步骤点击上一步后应返回准备打印步骤', async () => {
    const { user } = await openGuideDialog();

    await user.click(screen.getByRole('button', { name: configPrintDialog.guideStep1_button2 }));
    expect(await screen.findByText(configPrintDialog.guideStep2_body)).toBeTruthy();

    const prevButtons = screen.getAllByRole('button', { name: button.prev });
    await user.click(prevButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(configPrintDialog.guideStep1_body)).toBeTruthy();
    });
  });
});

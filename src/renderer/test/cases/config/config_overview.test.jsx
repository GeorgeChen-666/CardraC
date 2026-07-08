// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import zhLocale from '../../../../main/locales/zh.json';
import { cleanupRendererCase } from '../../setup/rendererCaseBootstrap';
import { renderActualSetupDialog } from '../../helpers/configTestHelpers';

vi.mock('../../../parts/ToolBar/Setup/TemplateMenu', () => ({
  TemplateMenu: () => React.createElement('div', { 'data-testid': 'setup-template-menu' }),
}));

const { configDialog } = zhLocale;

describe('配置预览', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    cleanupRendererCase();
  });

  test('打开设置时应请求预览并渲染处理后的 SVG 内容', async () => {
    const previewSvg = encodeURIComponent(
      '<svg width="200" height="100" xmlns="http://www.w3.org/2000/svg">' +
      '<image href="cardrac://image/data:image/png;base64,ZmFrZQ==" x="10" y="20" width="30" height="40" transform="rotate(10)" />' +
      '</svg>',
    );

    const { ref } = await renderActualSetupDialog({
      mocks: {
        functions: {
          clearPreviewCache: vi.fn(async () => true),
          getExportPreview: vi.fn(async () => `data:image/svg+xml,${previewSvg}`),
        },
      },
    });

    ref.current.openDialog();
    await screen.findByText(`${configDialog.setup}:`);

    const rendererFunctions = await import('../../../functions');

    await waitFor(() => {
      expect(rendererFunctions.clearPreviewCache).toHaveBeenCalled();
      expect(rendererFunctions.getExportPreview).toHaveBeenCalled();
    });

    await waitFor(() => {
      const overview = document.querySelector('.ConfigOverview');
      const rect = overview?.querySelector('rect');
      const image = overview?.querySelector('image');

      expect(overview?.innerHTML).toContain('<svg');
      expect(rect).toBeTruthy();
      expect(rect?.getAttribute('fill')).toBe('#5d8bb3');
      expect(rect?.getAttribute('transform')).toBe('rotate(10)');
      expect(image?.getAttribute('opacity')).toBe('0');
    });
  });
});


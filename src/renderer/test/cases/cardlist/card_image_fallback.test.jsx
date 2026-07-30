// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../../setup/rendererCaseBootstrap';
import { installImageViewerApiSpies } from '../../helpers/uiRuntimeTestHelpers';

const originalImage = globalThis.Image;

const renderCardImage = async ({
  imageSrc = 'face-1.png',
  path = 'face-1.png',
  isBackEditing = false,
  isFace = true,
} = {}) => {
  bootstrapRendererCase({ currentView: 'edit' });
  const { CardImage } = await import('../../../parts/edit/CardEditor/CardImage');

  const renderResult = renderRendererCase(
    <CardImage
      imageSrc={imageSrc}
      path={path}
      isBackEditing={isBackEditing}
      isFace={isFace}
    />,
  );

  return {
    CardImage,
    ...renderResult,
  };
};

describe('CardImage 回退渲染', () => {
  afterEach(() => {
    globalThis.Image = originalImage;
    vi.restoreAllMocks();
    cleanupRendererCase();
  });

  test.each([
    { isBackEditing: false, isFace: true, testId: 'card-face-image', expectedSize: '160px', label: '正面大图编辑' },
    { isBackEditing: false, isFace: false, testId: 'card-back-image', expectedSize: '50px', label: '背面缩略图显示' },
    { isBackEditing: true, isFace: true, testId: 'card-face-image', expectedSize: '50px', label: '背面编辑时正面缩略图显示' },
    { isBackEditing: true, isFace: false, testId: 'card-back-image', expectedSize: '160px', label: '背面编辑时背面大图显示' },
  ])('应根据编辑面与图片类型使用正确尺寸：$label', async ({ isBackEditing, isFace, testId, expectedSize }) => {
    await renderCardImage({
      imageSrc: isFace ? 'face-sized.png' : 'back-sized.png',
      path: isFace ? 'face-sized.png' : 'back-sized.png',
      isBackEditing,
      isFace,
    });

    const image = await screen.findByTestId(testId);
    const card = image.closest('.MuiCard-root');

    expect(image.getAttribute('height')).toBe(expectedSize);
    expect(image.style.maxWidth).toBe(expectedSize);
    expect(getComputedStyle(card).minWidth).toBe(expectedSize);
  });

  test('图片路径为空时应渲染占位内容且不触发放大预览', async () => {
    const { container } = await renderCardImage({
      imageSrc: '',
      path: '',
    });
    const { update, close } = installImageViewerApiSpies();

    await waitFor(() => {
      expect(screen.queryByTestId('card-face-image')).toBeNull();
    });

    expect(container.querySelector('img')).toBeNull();

    fireEvent.mouseOver(container.firstChild);
    fireEvent.mouseLeave(container.firstChild);

    expect(update).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  test('预加载失败后应切换到占位内容，并在传入有效图片后恢复渲染', async () => {
    globalThis.Image = class MockImage {
      set src(value) {
        this._src = value;
        if (String(value).includes('broken')) {
          setTimeout(() => {
            this.onerror?.(new Event('error'));
          }, 0);
        }
      }

      get src() {
        return this._src;
      }
    };

    const { CardImage, container, rerender } = await renderCardImage({
      imageSrc: 'broken-face.png',
      path: 'broken-face.png',
    });
    const { update, close } = installImageViewerApiSpies();

    await waitFor(() => {
      expect(screen.queryByTestId('card-face-image')).toBeNull();
    });
    expect(container.querySelector('img')).toBeNull();

    fireEvent.mouseOver(container.firstChild);
    expect(update).not.toHaveBeenCalled();

    rerender(
      <CardImage
        imageSrc={'recovered-face.png'}
        path={'recovered-face.png'}
        isBackEditing={false}
        isFace={true}
      />,
    );

    const recoveredImage = await screen.findByTestId('card-face-image');
    fireEvent.mouseOver(recoveredImage);
    fireEvent.mouseLeave(recoveredImage);

    expect(update).toHaveBeenCalledWith('recovered-face.png');
    expect(close).toHaveBeenCalled();
  });
});



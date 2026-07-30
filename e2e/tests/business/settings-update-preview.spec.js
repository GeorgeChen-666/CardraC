const { test, expect } = require('@playwright/test');
const path = require('path');
const { launchApp, closeApp, ROOT } = require('../../helpers/electronApp');

const FIXTURE_IMAGE_DIR = path.join(ROOT, 'e2e', 'fixtures', 'images', 'numeric-images');

test.setTimeout(120000);

async function getPreviewSvgText(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('.PrintPreviewContainer svg text'))
    .map((node) => node.textContent)
    .join(' | '));
}

test('toggles page numbers in setup and updates the preview through the Electron render pipeline @business', async () => {
  let session;

  try {
    session = await launchApp({ defaultPath: FIXTURE_IMAGE_DIR });
    const { page } = session;

    await page.getByTestId('add-card-image-button').click();
    await expect(page.getByText('选择文件')).toBeVisible({ timeout: 30000 });

    const firstImageTile = page.locator('.grid-file-item', { hasText: '1.png' }).first();
    await expect(firstImageTile).toBeVisible({ timeout: 30000 });
    await firstImageTile.click();

    await page.getByRole('button', { name: '确定' }).click();
    await expect(page.getByText('文件数 1 / 卡牌数 1')).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: '预览视图' }).click();
    await expect(page.getByRole('button', { name: '上一页' })).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.PrintPreviewContainer svg').first()).toBeVisible({ timeout: 30000 });

    const previewTextBefore = await getPreviewSvgText(page);
    expect(previewTextBefore).not.toContain('1/1');

    await page.getByRole('button', { name: '参数设置。' }).click();
    await expect(page.getByText('参数设置:')).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('tab', { name: '布局' })).toBeVisible({ timeout: 30000 });

    const pageNumberCheckbox = page.getByRole('checkbox', { name: '页码' });
    await expect(pageNumberCheckbox).not.toBeChecked();
    await pageNumberCheckbox.click();
    await expect(pageNumberCheckbox).toBeChecked();

    await page.getByRole('button', { name: '确定' }).click();
    await expect(page.getByText('参数设置:')).toBeHidden({ timeout: 30000 });

    await expect(page.getByRole('button', { name: '上一页' })).toBeVisible({ timeout: 30000 });
    await expect.poll(
      async () => getPreviewSvgText(page),
      {
        timeout: 30000,
        message: 'expected preview SVG text to include page number after enabling 页码',
      },
    ).toContain('1/1');
  } finally {
    await closeApp(session);
  }
});



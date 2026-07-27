const { test, expect } = require('@playwright/test');
const path = require('path');
const { launchApp, closeApp, ROOT } = require('../../helpers/electronApp');

const FIXTURE_IMAGE_DIR = path.join(ROOT, 'e2e', 'fixtures', 'images', 'numeric-images');

test.setTimeout(120000);

test('imports one fixture image and switches to preview view @smoke', async () => {
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
    await expect(page.getByRole('button', { name: '下一页' })).toBeVisible({ timeout: 30000 });
  } finally {
    await closeApp(session);
  }
});



const { test, expect } = require('@playwright/test');
const path = require('path');
const { launchApp, closeApp, ROOT } = require('../../helpers/electronApp');

const FIXTURE_IMAGE_DIR = path.join(ROOT, 'e2e', 'fixtures', 'images', 'numeric-images');
const MULTI_IMAGE_NAMES = ['1.png', '2.png', '3.png', '4.png', '5.png', '6.png', '7.png', '8.png', '9.png'];

test.setTimeout(120000);

async function importNumericFixtures(page, fileNames) {
  await page.getByTestId('add-card-image-button').click();
  await expect(page.getByText('选择文件')).toBeVisible({ timeout: 30000 });

  for (const fileName of fileNames) {
    const tile = page.locator('.grid-file-item', { hasText: fileName }).first();
    await expect(tile).toBeVisible({ timeout: 30000 });
    await tile.click({ modifiers: ['Control'] });
  }

  await page.getByRole('button', { name: '确定' }).click();
  await expect(page.getByText(`文件数 ${fileNames.length} / 卡牌数 ${fileNames.length}`)).toBeVisible({ timeout: 30000 });
}

async function enablePageNumber(page) {
  await page.getByRole('button', { name: '参数设置。' }).click();
  await expect(page.getByText('参数设置:')).toBeVisible({ timeout: 30000 });

  const pageNumberCheckbox = page.getByRole('checkbox', { name: '页码' });
  if (!(await pageNumberCheckbox.isChecked())) {
    await pageNumberCheckbox.click();
  }
  await expect(pageNumberCheckbox).toBeChecked();

  await page.getByRole('button', { name: '确定' }).click();
  await expect(page.getByText('参数设置:')).toBeHidden({ timeout: 30000 });
}

async function switchLayoutMode(page, targetModeName) {
  await page.getByRole('button', { name: '参数设置。' }).click();
  await expect(page.getByText('参数设置:')).toBeVisible({ timeout: 30000 });

  const sideCombobox = page.getByRole('combobox', { name: '卡牌模式' });
  await sideCombobox.click();
  await page.getByRole('option', { name: targetModeName }).click();

  await page.getByRole('button', { name: '确定' }).click();
  await expect(page.getByText('参数设置:')).toBeHidden({ timeout: 30000 });
}

async function openPreview(page) {
  await page.getByRole('button', { name: '预览视图' }).click();
  await expect(page.getByRole('button', { name: '上一页' })).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.PrintPreviewContainer svg').first()).toBeVisible({ timeout: 30000 });
}

async function getPreviewSvgText(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('.PrintPreviewContainer svg text'))
    .map((node) => node.textContent)
    .join(' | '));
}

test('multi-image layout mode changes alter preview page text and navigator totals through the Electron render pipeline @business', async () => {
  let session;

  try {
    session = await launchApp({ defaultPath: FIXTURE_IMAGE_DIR });
    const { page } = session;

    await importNumericFixtures(page, MULTI_IMAGE_NAMES);
    await enablePageNumber(page);
    await openPreview(page);

    await expect(page.getByText('/ 6')).toBeVisible({ timeout: 30000 });
    await expect.poll(
      async () => getPreviewSvgText(page),
      {
        timeout: 30000,
        message: 'expected default double-sided preview to render page number 1/2 for 9 images',
      },
    ).toContain('1/2');

    await switchLayoutMode(page, '对贴');
    await openPreview(page);

    await expect(page.getByText('/ 4')).toBeVisible({ timeout: 30000 });
    await expect.poll(
      async () => getPreviewSvgText(page),
      {
        timeout: 30000,
        message: 'expected fold-in-half preview to rerender with page number 1/3 after layout mode change',
      },
    ).toContain('1/3');
  } finally {
    await closeApp(session);
  }
});



const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { test, expect } = require('@playwright/test');
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

  await page.getByRole('combobox', { name: '卡牌模式' }).click();
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

async function exportPngToZip(page, exportStem) {
  const zipPath = path.join(FIXTURE_IMAGE_DIR, `${exportStem}.zip`);

  await page.getByRole('button', { name: '导出PNG。' }).click();
  await expect(page.getByText('选择文件')).toBeVisible({ timeout: 30000 });
  await page.getByRole('textbox', { name: '文件名' }).fill(exportStem);
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('操作成功！').last()).toBeVisible({ timeout: 60000 });
  await expect.poll(
    () => fs.existsSync(zipPath),
    { timeout: 30000, message: `expected exported zip ${path.basename(zipPath)} to exist on disk` },
  ).toBe(true);

  return zipPath;
}

async function getZipEntryNames(zipPath) {
  const zipBuffer = fs.readFileSync(zipPath);
  const zip = await JSZip.loadAsync(zipBuffer);
  return Object.keys(zip.files).filter((name) => !zip.files[name].dir);
}

test('preview and export stay consistent after a layout change without action cross-contamination @business', async () => {
  const exportStem = `e2e-preview-export-consistency-${Date.now()}`;
  const zipPath = path.join(FIXTURE_IMAGE_DIR, `${exportStem}.zip`);
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
        message: 'expected preview warm-up in default double-sided mode to show page number 1/2',
      },
    ).toContain('1/2');

    await switchLayoutMode(page, '对贴');
    await openPreview(page);

    await expect(page.getByText('/ 4')).toBeVisible({ timeout: 30000 });
    await expect.poll(
      async () => getPreviewSvgText(page),
      {
        timeout: 30000,
        message: 'expected preview to rerender to fold-in-half mode with page number 1/3',
      },
    ).toContain('1/3');
    const previewTextBeforeExport = await getPreviewSvgText(page);
    expect(previewTextBeforeExport).not.toContain('1/2');

    const exportedZipPath = await exportPngToZip(page, exportStem);
    const zipEntries = await getZipEntryNames(exportedZipPath);
    expect(zipEntries).toHaveLength(3);
    expect(zipEntries).toEqual(['page0.png', 'page1.png', 'page2.png']);

    await expect(page.getByText('/ 4')).toBeVisible({ timeout: 30000 });
    await expect.poll(
      async () => getPreviewSvgText(page),
      {
        timeout: 30000,
        message: 'expected preview to stay on fold-in-half render result after export completes',
      },
    ).toContain('1/3');
    const previewTextAfterExport = await getPreviewSvgText(page);
    expect(previewTextAfterExport).not.toContain('1/2');
  } finally {
    try {
      fs.rmSync(zipPath, { force: true });
    } catch {
      // ignore cleanup failures for test artifacts
    }
    await closeApp(session);
  }
});



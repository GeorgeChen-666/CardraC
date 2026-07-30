const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const JSZip = require('jszip');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp, ROOT } = require('../../helpers/electronApp');

const SMALL_FIXTURE_DIR = path.join(ROOT, 'e2e', 'fixtures', 'images', 'numeric-images');
const LARGE_IMAGE_NAMES = ['1.png', '2.png', '3.png', '4.png', '5.png', '6.png', '7.png', '8.png', '9.png'];

test.setTimeout(240000);

async function createLargeNumericFixtures(targetDir, imageNames, targetSize = 4200) {
  fs.mkdirSync(targetDir, { recursive: true });

  for (const imageName of imageNames) {
    const sourcePath = path.join(SMALL_FIXTURE_DIR, imageName);
    const targetPath = path.join(targetDir, imageName);

    await sharp(sourcePath)
      .resize(targetSize, targetSize, { kernel: sharp.kernel.nearest })
      .png()
      .toFile(targetPath);
  }
}

function cleanupGeneratedLargeFixtureDir(targetDir) {
  try {
    fs.rmSync(targetDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures for generated fixture directories
  }
}

async function waitForBackgroundIndicatorToSettle(indicator) {
  const isCurrentlyVisible = await indicator.isVisible().catch(() => false);
  if (isCurrentlyVisible) {
    await expect(indicator).toBeHidden({ timeout: 30000 });
  }
}

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

async function exportPngToZip(page, exportDir, exportStem) {
  const zipPath = path.join(exportDir, `${exportStem}.zip`);

  await page.getByRole('button', { name: '导出PNG。' }).click();
  await expect(page.getByText('选择文件')).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('textbox', { name: '文件名' })).toBeVisible({ timeout: 30000 });

  await page.getByRole('textbox', { name: '文件名' }).fill(exportStem);
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('操作成功！').last()).toBeVisible({ timeout: 120000 });
  await expect.poll(
    () => fs.existsSync(zipPath),
    { timeout: 60000, message: `expected exported zip ${path.basename(zipPath)} to exist on disk` },
  ).toBe(true);

  return zipPath;
}

async function getZipEntryNames(zipPath) {
  const zipBuffer = fs.readFileSync(zipPath);
  const zip = await JSZip.loadAsync(zipBuffer);
  return Object.keys(zip.files).filter((name) => !zip.files[name].dir);
}

async function openPreview(page) {
  await page.getByRole('button', { name: '预览视图' }).click();
  await expect(page.getByRole('button', { name: '上一页' })).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.PrintPreviewContainer svg').first()).toBeVisible({ timeout: 60000 });
}

test('importing large images starts background high-quality loading and the next export waits for it successfully @business', async () => {
  const stamp = Date.now();
  const largeFixtureDir = path.join(ROOT, 'test-results', 'playwright', `generated-large-images-${stamp}`);
  const exportStem = `e2e-large-image-export-${stamp}`;
  const exportZipPath = path.join(largeFixtureDir, `${exportStem}.zip`);
  let session;

  try {
    await createLargeNumericFixtures(largeFixtureDir, LARGE_IMAGE_NAMES);

    session = await launchApp({ defaultPath: largeFixtureDir });
    const { page } = session;

    await importNumericFixtures(page, LARGE_IMAGE_NAMES);

    const backgroundLoadIndicator = page.getByText('加载高质量图片').first();
    await expect(backgroundLoadIndicator).toBeVisible({ timeout: 60000 });

    const zipPath = await exportPngToZip(page, largeFixtureDir, exportStem);
    const zipEntries = await getZipEntryNames(zipPath);
    expect(zipEntries).toHaveLength(4);
    expect(zipEntries).toEqual(['page0.png', 'page1.png', 'page2.png', 'page3.png']);

    await expect(backgroundLoadIndicator).toBeHidden({ timeout: 30000 });

    await openPreview(page);
    await expect(page.getByText('/ 6')).toBeVisible({ timeout: 30000 });
  } finally {
    try {
      fs.rmSync(exportZipPath, { force: true });
    } catch {
      // ignore cleanup failures for test artifacts
    }
    await closeApp(session);
    cleanupGeneratedLargeFixtureDir(largeFixtureDir);
  }
});

test('importing large images keeps preview actionable while high-quality loading finishes in the background @business', async () => {
  const stamp = Date.now();
  const largeFixtureDir = path.join(ROOT, 'test-results', 'playwright', `generated-large-images-preview-${stamp}`);
  let session;

  try {
    await createLargeNumericFixtures(largeFixtureDir, LARGE_IMAGE_NAMES);

    session = await launchApp({ defaultPath: largeFixtureDir });
    const { page } = session;

    await importNumericFixtures(page, LARGE_IMAGE_NAMES);

    const backgroundLoadIndicator = page.getByText('加载高质量图片').first();

    await openPreview(page);
    await expect(page.getByText('/ 6')).toBeVisible({ timeout: 30000 });
    await waitForBackgroundIndicatorToSettle(backgroundLoadIndicator);
  } finally {
    await closeApp(session);
    cleanupGeneratedLargeFixtureDir(largeFixtureDir);
  }
});




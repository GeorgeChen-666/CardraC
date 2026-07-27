const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const JSZip = require('jszip');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp, ROOT } = require('../../helpers/electronApp');

const SMALL_FIXTURE_DIR = path.join(ROOT, 'e2e', 'fixtures', 'images', 'numeric-images');
const RUNTIME_FIXTURE_ROOT = path.join(ROOT, 'e2e', 'fixtures', 'images');
const LARGE_IMAGE_NAMES = ['1.png', '2.png', '3.png', '4.png', '5.png', '6.png', '7.png', '8.png', '9.png'];

test.setTimeout(240000);

async function writeLargeImageFromFixture({ sourceImageName, targetPath, targetSize = 4200 }) {
  await sharp(path.join(SMALL_FIXTURE_DIR, sourceImageName))
    .resize(targetSize, targetSize, { kernel: sharp.kernel.nearest })
    .png()
    .toFile(targetPath);
}

async function createLargeNumericFixtures(targetDir, imageNames) {
  fs.mkdirSync(targetDir, { recursive: true });

  for (const imageName of imageNames) {
    await writeLargeImageFromFixture({
      sourceImageName: imageName,
      targetPath: path.join(targetDir, imageName),
    });
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
  await expect(page.getByRole('button', { name: '上一页' })).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.PrintPreviewContainer svg').first()).toBeVisible({ timeout: 60000 });
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

async function getZipEntryBuffer(zipPath, entryName) {
  const zipBuffer = fs.readFileSync(zipPath);
  const zip = await JSZip.loadAsync(zipBuffer);
  return zip.files[entryName].async('nodebuffer');
}

async function getNormalizedImageHash(imageBuffer) {
  const normalized = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

async function getPreviewScreenshotHash(page) {
  const screenshotBuffer = await page.locator('.PrintPreviewContainer svg').first().screenshot();
  return getNormalizedImageHash(screenshotBuffer);
}

async function goToNextPreviewPage(page) {
  await page.getByRole('button', { name: '下一页' }).click();
}

async function triggerManualReload(page) {
  await page.getByRole('button', { name: '压缩等级' }).click();
  await page.getByRole('menuitem').filter({ hasText: '手动重载图像' }).click();
}

async function waitForPreviewHash(page, expectedHash, message) {
  await expect.poll(
    async () => getPreviewScreenshotHash(page),
    { timeout: 60000, message },
  ).toBe(expectedHash);
}

async function waitForPreviewHashToDiffer(page, previousHash, message) {
  await expect.poll(
    async () => getPreviewScreenshotHash(page),
    { timeout: 60000, message },
  ).not.toBe(previousHash);
}

function cleanupDir(dirPath) {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures for generated fixture directories
  }
}

test('reloading one modified large image only changes the affected preview/export page while untouched pages stay stable @business', async () => {
  const stamp = Date.now();
  const fixtureDir = path.join(RUNTIME_FIXTURE_ROOT, `generated-large-image-partial-reload-${stamp}`);
  const baselineExportStem = `e2e-large-image-partial-baseline-${stamp}`;
  const baselineZipPath = path.join(fixtureDir, `${baselineExportStem}.zip`);
  const reloadedExportStem = `e2e-large-image-partial-reloaded-${stamp}`;
  const reloadedZipPath = path.join(fixtureDir, `${reloadedExportStem}.zip`);
  const targetImagePath = path.join(fixtureDir, '9.png');
  let session;

  try {
    await createLargeNumericFixtures(fixtureDir, LARGE_IMAGE_NAMES);

    session = await launchApp({ defaultPath: fixtureDir });
    const { page } = session;

    await importNumericFixtures(page, LARGE_IMAGE_NAMES);
    await switchLayoutMode(page, '单面');

    await openPreview(page);
    await expect(page.getByText('/ 3')).toBeVisible({ timeout: 30000 });

    const baselinePreviewPage1Hash = await getPreviewScreenshotHash(page);
    await goToNextPreviewPage(page);
    await waitForPreviewHashToDiffer(
      page,
      baselinePreviewPage1Hash,
      'expected baseline preview page 2 to differ from baseline page 1 after navigating forward',
    );
    const baselinePreviewPage2Hash = await getPreviewScreenshotHash(page);

    const baselineZip = await exportPngToZip(page, fixtureDir, baselineExportStem);
    const baselineEntryNames = await getZipEntryNames(baselineZip);
    expect(baselineEntryNames).toEqual(['page0.png', 'page1.png']);
    const baselineExportPage1Hash = await getNormalizedImageHash(await getZipEntryBuffer(baselineZip, 'page0.png'));
    const baselineExportPage2Hash = await getNormalizedImageHash(await getZipEntryBuffer(baselineZip, 'page1.png'));

    await page.getByRole('button', { name: '编辑视图' }).click();
    await expect(page.getByText('文件数 9 / 卡牌数 9')).toBeVisible({ timeout: 30000 });

    await new Promise((resolve) => setTimeout(resolve, 1100));
    await writeLargeImageFromFixture({ sourceImageName: '1.png', targetPath: targetImagePath });

    await triggerManualReload(page);

    await openPreview(page);
    await expect(page.getByText('/ 3')).toBeVisible({ timeout: 30000 });
    await waitForPreviewHash(
      page,
      baselinePreviewPage1Hash,
      'expected preview page 1 to remain unchanged after reloading only the ninth image',
    );

    await goToNextPreviewPage(page);
    await waitForPreviewHashToDiffer(
      page,
      baselinePreviewPage1Hash,
      'expected preview page 2 to be rendered after navigating forward in the reloaded preview',
    );
    const reloadedPreviewPage2Hash = await getPreviewScreenshotHash(page);
    expect(reloadedPreviewPage2Hash).not.toBe(baselinePreviewPage2Hash);

    const reloadedZip = await exportPngToZip(page, fixtureDir, reloadedExportStem);
    const reloadedEntryNames = await getZipEntryNames(reloadedZip);
    expect(reloadedEntryNames).toEqual(['page0.png', 'page1.png']);
    const reloadedExportPage1Hash = await getNormalizedImageHash(await getZipEntryBuffer(reloadedZip, 'page0.png'));
    const reloadedExportPage2Hash = await getNormalizedImageHash(await getZipEntryBuffer(reloadedZip, 'page1.png'));

    expect(reloadedExportPage1Hash).toBe(baselineExportPage1Hash);
    expect(reloadedExportPage2Hash).not.toBe(baselineExportPage2Hash);
  } finally {
    for (const filePath of [baselineZipPath, reloadedZipPath]) {
      try {
        fs.rmSync(filePath, { force: true });
      } catch {
        // ignore cleanup failures for test artifacts
      }
    }
    await closeApp(session);
    cleanupDir(fixtureDir);
  }
});





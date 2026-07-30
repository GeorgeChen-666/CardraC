const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const JSZip = require('jszip');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp, ROOT } = require('../../helpers/electronApp');

const SMALL_FIXTURE_DIR = path.join(ROOT, 'e2e', 'fixtures', 'images', 'numeric-images');
const RUNTIME_FIXTURE_ROOT = path.join(ROOT, 'e2e', 'fixtures', 'images');

test.setTimeout(240000);

async function writeLargeImageFromFixture({ sourceImageName, targetPath, targetSize = 4200 }) {
  await sharp(path.join(SMALL_FIXTURE_DIR, sourceImageName))
    .resize(targetSize, targetSize, { kernel: sharp.kernel.nearest })
    .png()
    .toFile(targetPath);
}

async function importOneImage(page, fileName) {
  await page.getByTestId('add-card-image-button').click();
  await expect(page.getByText('选择文件')).toBeVisible({ timeout: 30000 });

  const imageTile = page.locator('.grid-file-item', { hasText: fileName }).first();
  await expect(imageTile).toBeVisible({ timeout: 30000 });
  await imageTile.click();

  await page.getByRole('button', { name: '确定' }).click();
  await expect(page.getByText('文件数 1 / 卡牌数 1')).toBeVisible({ timeout: 30000 });
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

async function triggerManualReload(page) {
  await page.getByRole('button', { name: '压缩等级' }).click();
  await page.getByRole('menuitem').filter({ hasText: '手动重载图像' }).click();
}

function cleanupDir(dirPath) {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures for generated fixture directories
  }
}

test('reloading a modified large source image immediately updates both preview and export instead of reusing stale cached content @business', async () => {
  const stamp = Date.now();
  const fixtureDir = path.join(RUNTIME_FIXTURE_ROOT, `generated-large-image-reload-${stamp}`);
  const sourceImagePath = path.join(fixtureDir, 'card.png');
  const baselineExportStem = `e2e-large-image-baseline-export-${stamp}`;
  const baselineZipPath = path.join(fixtureDir, `${baselineExportStem}.zip`);
  const reloadedExportStem = `e2e-large-image-reloaded-export-${stamp}`;
  const reloadedZipPath = path.join(fixtureDir, `${reloadedExportStem}.zip`);
  let session;

  try {
    fs.mkdirSync(fixtureDir, { recursive: true });
    await writeLargeImageFromFixture({ sourceImageName: '1.png', targetPath: sourceImagePath });

    session = await launchApp({ defaultPath: fixtureDir });
    const { page } = session;

    await importOneImage(page, 'card.png');

    await openPreview(page);
    const baselinePreviewHash = await getPreviewScreenshotHash(page);

    const baselineZip = await exportPngToZip(page, fixtureDir, baselineExportStem);
    const baselineEntryNames = await getZipEntryNames(baselineZip);
    expect(baselineEntryNames.length).toBeGreaterThan(0);
    const baselinePageBuffer = await getZipEntryBuffer(baselineZip, baselineEntryNames[0]);
    const baselineExportHash = await getNormalizedImageHash(baselinePageBuffer);

    await page.getByRole('button', { name: '编辑视图' }).click();
    await expect(page.getByText('文件数 1 / 卡牌数 1')).toBeVisible({ timeout: 30000 });

    await writeLargeImageFromFixture({ sourceImageName: '9.png', targetPath: sourceImagePath });
    const reloadedFileStat = fs.statSync(sourceImagePath);
    expect(reloadedFileStat.mtimeMs).toBeGreaterThan(0);

    await triggerManualReload(page);

    await openPreview(page);
    const reloadedPreviewHash = await getPreviewScreenshotHash(page);
    expect(reloadedPreviewHash).not.toBe(baselinePreviewHash);

    const reloadedZip = await exportPngToZip(page, fixtureDir, reloadedExportStem);
    const reloadedEntryNames = await getZipEntryNames(reloadedZip);
    expect(reloadedEntryNames).toEqual(baselineEntryNames);
    const reloadedPageBuffer = await getZipEntryBuffer(reloadedZip, reloadedEntryNames[0]);
    const reloadedExportHash = await getNormalizedImageHash(reloadedPageBuffer);
    expect(reloadedExportHash).not.toBe(baselineExportHash);
  } finally {
    try {
      fs.rmSync(baselineZipPath, { force: true });
    } catch {
      // ignore cleanup failures for test artifacts
    }
    try {
      fs.rmSync(reloadedZipPath, { force: true });
    } catch {
      // ignore cleanup failures for test artifacts
    }
    await closeApp(session);
    cleanupDir(fixtureDir);
  }
});





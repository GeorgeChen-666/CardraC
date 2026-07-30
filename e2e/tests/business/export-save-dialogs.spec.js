const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp, ROOT } = require('../../helpers/electronApp');

const FIXTURE_IMAGE_DIR = path.join(ROOT, 'e2e', 'fixtures', 'images', 'numeric-images');

test.setTimeout(120000);

async function importOneFixtureImage(page) {
  await page.getByTestId('add-card-image-button').click();
  await expect(page.getByText('选择文件')).toBeVisible({ timeout: 30000 });

  const firstImageTile = page.locator('.grid-file-item', { hasText: '1.png' }).first();
  await expect(firstImageTile).toBeVisible({ timeout: 30000 });
  await firstImageTile.click();

  await page.getByRole('button', { name: '确定' }).click();
  await expect(page.getByText('文件数 1 / 卡牌数 1')).toBeVisible({ timeout: 30000 });
}

async function expectSaveDialog(page) {
  await expect(page.getByText('选择文件')).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('textbox', { name: '文件名' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByLabel('扩展名')).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: '取消' })).toBeVisible({ timeout: 30000 });
}

async function exportFromToolbar(page, { buttonName, fileName }) {
  await page.getByRole('button', { name: buttonName }).click();
  await expectSaveDialog(page);
  await page.getByRole('textbox', { name: '文件名' }).fill(fileName);
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('操作成功！')).toBeVisible({ timeout: 60000 });
}

test('exports a PDF through the real Electron save and main-process render pipeline @business', async () => {
  const exportStem = `e2e-export-pdf-${Date.now()}`;
  const exportPath = path.join(FIXTURE_IMAGE_DIR, `${exportStem}.pdf`);
  let session;

  try {
    session = await launchApp({ defaultPath: FIXTURE_IMAGE_DIR });
    const { page } = session;

    await importOneFixtureImage(page);
    await exportFromToolbar(page, {
      buttonName: '导出PDF。',
      fileName: exportStem,
    });

    await expect.poll(
      () => fs.existsSync(exportPath),
      { timeout: 30000, message: 'expected exported PDF file to exist on disk' },
    ).toBe(true);

    const pdfHeader = fs.readFileSync(exportPath).subarray(0, 5).toString('utf8');
    expect(pdfHeader).toBe('%PDF-');
  } finally {
    try {
      fs.rmSync(exportPath, { force: true });
    } catch {
      // ignore cleanup failures for test artifacts
    }
    await closeApp(session);
  }
});

test('exports PNG pages as a zip through the real Electron save and main-process packaging pipeline @business', async () => {
  const exportStem = `e2e-export-png-${Date.now()}`;
  const exportPath = path.join(FIXTURE_IMAGE_DIR, `${exportStem}.zip`);
  let session;

  try {
    session = await launchApp({ defaultPath: FIXTURE_IMAGE_DIR });
    const { page } = session;

    await importOneFixtureImage(page);
    await exportFromToolbar(page, {
      buttonName: '导出PNG。',
      fileName: exportStem,
    });

    await expect.poll(
      () => fs.existsSync(exportPath),
      { timeout: 30000, message: 'expected exported PNG zip file to exist on disk' },
    ).toBe(true);

    const zipHeader = fs.readFileSync(exportPath).subarray(0, 2).toString('utf8');
    expect(zipHeader).toBe('PK');
  } finally {
    try {
      fs.rmSync(exportPath, { force: true });
    } catch {
      // ignore cleanup failures for test artifacts
    }
    await closeApp(session);
  }
});


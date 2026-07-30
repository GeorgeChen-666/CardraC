const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp, ROOT } = require('../../helpers/electronApp');

const FIXTURE_IMAGE_DIR = path.join(ROOT, 'e2e', 'fixtures', 'images', 'numeric-images');
const TARGET_PROJECT_IMAGE_NAMES = ['1.png', '2.png', '3.png', '4.png', '5.png', '6.png', '7.png', '8.png', '9.png'];

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

async function saveProjectToFile(page, projectStem) {
  await page.getByTestId('toolbar-save-project-button').click();
  await expect(page.getByText('选择文件')).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('textbox', { name: '文件名' })).toBeVisible({ timeout: 30000 });

  await page.getByRole('textbox', { name: '文件名' }).fill(projectStem);
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('操作成功！').last()).toBeVisible({ timeout: 60000 });
}

async function openProjectFromFile(page, fileName) {
  await page.getByTestId('toolbar-open-project-button').click();
  await expect(page.getByText('选择文件')).toBeVisible({ timeout: 30000 });

  const targetFileTile = page.locator('.grid-file-item', { hasText: fileName }).first();
  await expect(targetFileTile).toBeVisible({ timeout: 30000 });
  await targetFileTile.click();

  await page.getByRole('button', { name: '确定' }).click();
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

async function configureSetup(page, { targetLayoutModeName = null, pageNumberEnabled = null } = {}) {
  await page.getByRole('button', { name: '参数设置。' }).click();
  await expect(page.getByText('参数设置:')).toBeVisible({ timeout: 30000 });

  if (targetLayoutModeName) {
    await page.getByRole('combobox', { name: '卡牌模式' }).click();
    await page.getByRole('option', { name: targetLayoutModeName }).click();
  }

  if (pageNumberEnabled !== null) {
    const pageNumberCheckbox = page.getByRole('checkbox', { name: '页码' });
    const isChecked = await pageNumberCheckbox.isChecked();
    if (isChecked !== pageNumberEnabled) {
      await pageNumberCheckbox.click();
    }
    if (pageNumberEnabled) {
      await expect(pageNumberCheckbox).toBeChecked();
    } else {
      await expect(pageNumberCheckbox).not.toBeChecked();
    }
  }

  await page.getByRole('button', { name: '确定' }).click();
  await expect(page.getByText('参数设置:')).toBeHidden({ timeout: 30000 });
}

async function exportPngToZip(page, exportStem) {
  const zipPath = path.join(FIXTURE_IMAGE_DIR, `${exportStem}.zip`);

  await page.getByRole('button', { name: '导出PNG。' }).click();
  await expect(page.getByText('选择文件')).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('textbox', { name: '文件名' })).toBeVisible({ timeout: 30000 });

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

async function resetProject(page) {
  await page.getByTestId('toolbar-new-project-button').click();
  await expect(page.getByText('文件数 0 / 卡牌数 0')).toBeVisible({ timeout: 30000 });
}

async function createSavedProject(page, { projectStem, fileNames, targetLayoutModeName = null, pageNumberEnabled = true }) {
  const projectPath = path.join(FIXTURE_IMAGE_DIR, `${projectStem}.cpnp`);
  fs.rmSync(projectPath, { force: true });

  await importNumericFixtures(page, fileNames);
  await configureSetup(page, { targetLayoutModeName, pageNumberEnabled });

  await saveProjectToFile(page, projectStem);
  await expect.poll(
    () => fs.existsSync(projectPath),
    { timeout: 30000, message: `expected project ${path.basename(projectPath)} to exist on disk` },
  ).toBe(true);

  return projectPath;
}

test('opening another saved project while preview is already active refreshes preview counts and page text without stale cache leakage @business', async () => {
  const stamp = Date.now();
  const sourceProjectStem = `e2e-open-project-preview-source-${stamp}`;
  const sourceProjectFileName = `${sourceProjectStem}.cpnp`;
  const sourceProjectPath = path.join(FIXTURE_IMAGE_DIR, sourceProjectFileName);
  const targetProjectStem = `e2e-open-project-preview-target-${stamp}`;
  const targetProjectFileName = `${targetProjectStem}.cpnp`;
  const targetProjectPath = path.join(FIXTURE_IMAGE_DIR, targetProjectFileName);
  let session;

  try {
    session = await launchApp({ defaultPath: FIXTURE_IMAGE_DIR });
    const { page } = session;

    await createSavedProject(page, {
      projectStem: sourceProjectStem,
      fileNames: ['1.png'],
    });

    await resetProject(page);

    await createSavedProject(page, {
      projectStem: targetProjectStem,
      fileNames: TARGET_PROJECT_IMAGE_NAMES,
      targetLayoutModeName: '对贴',
    });

    await resetProject(page);

    await openProjectFromFile(page, sourceProjectFileName);
    await expect(page.getByText('文件数 1 / 卡牌数 1')).toBeVisible({ timeout: 30000 });

    await openPreview(page);
    await expect.poll(
      async () => getPreviewSvgText(page),
      {
        timeout: 30000,
        message: 'expected source project preview to show 1/1 before opening the target project',
      },
    ).toContain('1/1');

    await openProjectFromFile(page, targetProjectFileName);
    await expect(page.getByRole('button', { name: '上一页' })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(`文件数 ${TARGET_PROJECT_IMAGE_NAMES.length} / 卡牌数 ${TARGET_PROJECT_IMAGE_NAMES.length}`)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('/ 4')).toBeVisible({ timeout: 30000 });

    await expect.poll(
      async () => getPreviewSvgText(page),
      {
        timeout: 30000,
        message: 'expected target project preview to rerender to 1/3 after opening it from an already active preview session',
      },
    ).toContain('1/3');

    const previewTextAfterOpen = await getPreviewSvgText(page);
    expect(previewTextAfterOpen).not.toContain('1/1');
  } finally {
    try {
      fs.rmSync(sourceProjectPath, { force: true });
    } catch {
      // ignore cleanup failures for test artifacts
    }
    try {
      fs.rmSync(targetProjectPath, { force: true });
    } catch {
      // ignore cleanup failures for test artifacts
    }
    await closeApp(session);
  }
});

test('opening another saved project can immediately continue into PNG export with the newly loaded renderer-main parameters @business', async () => {
  const stamp = Date.now();
  const sourceProjectStem = `e2e-open-project-export-source-${stamp}`;
  const sourceProjectFileName = `${sourceProjectStem}.cpnp`;
  const sourceProjectPath = path.join(FIXTURE_IMAGE_DIR, sourceProjectFileName);
  const targetProjectStem = `e2e-open-project-export-target-${stamp}`;
  const targetProjectFileName = `${targetProjectStem}.cpnp`;
  const targetProjectPath = path.join(FIXTURE_IMAGE_DIR, targetProjectFileName);
  const exportStem = `e2e-open-project-export-result-${stamp}`;
  const exportZipPath = path.join(FIXTURE_IMAGE_DIR, `${exportStem}.zip`);
  let session;

  try {
    session = await launchApp({ defaultPath: FIXTURE_IMAGE_DIR });
    const { page } = session;

    await createSavedProject(page, {
      projectStem: sourceProjectStem,
      fileNames: ['1.png'],
    });

    await resetProject(page);

    await createSavedProject(page, {
      projectStem: targetProjectStem,
      fileNames: TARGET_PROJECT_IMAGE_NAMES,
      targetLayoutModeName: '对贴',
    });

    await resetProject(page);

    await openProjectFromFile(page, sourceProjectFileName);
    await expect(page.getByText('文件数 1 / 卡牌数 1')).toBeVisible({ timeout: 30000 });

    await openProjectFromFile(page, targetProjectFileName);
    const zipPath = await exportPngToZip(page, exportStem);
    const zipEntries = await getZipEntryNames(zipPath);

    expect(zipEntries).toEqual(['page0.png', 'page1.png', 'page2.png']);
    await expect(page.getByText(`文件数 ${TARGET_PROJECT_IMAGE_NAMES.length} / 卡牌数 ${TARGET_PROJECT_IMAGE_NAMES.length}`)).toBeVisible({ timeout: 30000 });
  } finally {
    try {
      fs.rmSync(sourceProjectPath, { force: true });
    } catch {
      // ignore cleanup failures for test artifacts
    }
    try {
      fs.rmSync(targetProjectPath, { force: true });
    } catch {
      // ignore cleanup failures for test artifacts
    }
    try {
      fs.rmSync(exportZipPath, { force: true });
    } catch {
      // ignore cleanup failures for test artifacts
    }
    await closeApp(session);
  }
});

test('a reopened project can immediately change layout config and export with the updated renderer-main parameters @business', async () => {
  const stamp = Date.now();
  const projectStem = `e2e-open-project-config-change-${stamp}`;
  const projectFileName = `${projectStem}.cpnp`;
  const projectPath = path.join(FIXTURE_IMAGE_DIR, projectFileName);
  const exportStem = `e2e-open-project-config-change-export-${stamp}`;
  const exportZipPath = path.join(FIXTURE_IMAGE_DIR, `${exportStem}.zip`);
  let session;

  try {
    session = await launchApp({ defaultPath: FIXTURE_IMAGE_DIR });
    const { page } = session;

    await createSavedProject(page, {
      projectStem,
      fileNames: TARGET_PROJECT_IMAGE_NAMES,
      targetLayoutModeName: '对贴',
      pageNumberEnabled: false,
    });

    const savedProjectContent = fs.readFileSync(projectPath, 'utf8');
    expect(savedProjectContent).toContain('"sides":"fold in half"');
    expect(savedProjectContent).toContain('"pageNumber":false');

    await resetProject(page);

    await openProjectFromFile(page, projectFileName);
    await expect(page.getByText(`文件数 ${TARGET_PROJECT_IMAGE_NAMES.length} / 卡牌数 ${TARGET_PROJECT_IMAGE_NAMES.length}`)).toBeVisible({ timeout: 30000 });

    await configureSetup(page, {
      targetLayoutModeName: '双面',
      pageNumberEnabled: true,
    });

    const zipPath = await exportPngToZip(page, exportStem);
    const zipEntries = await getZipEntryNames(zipPath);
    expect(zipEntries).toHaveLength(4);
    expect(zipEntries).toEqual(['page0.png', 'page1.png', 'page2.png', 'page3.png']);

    await openPreview(page);
    await expect(page.getByText('/ 6')).toBeVisible({ timeout: 30000 });
    await expect.poll(
      async () => getPreviewSvgText(page),
      {
        timeout: 30000,
        message: 'expected reopened project preview to reflect the immediately updated double-sided layout and enabled page number',
      },
    ).toContain('1/2');

    const previewText = await getPreviewSvgText(page);
    expect(previewText).not.toContain('1/3');
  } finally {
    try {
      fs.rmSync(projectPath, { force: true });
    } catch {
      // ignore cleanup failures for test artifacts
    }
    try {
      fs.rmSync(exportZipPath, { force: true });
    } catch {
      // ignore cleanup failures for test artifacts
    }
    await closeApp(session);
  }
});


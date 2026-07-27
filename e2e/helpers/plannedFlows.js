// Shared planning notes for future E2E helpers.
//
// This file is intentionally lightweight for now. It exists so future helpers
// can grow in a predictable place without mixing planning comments into the
// Electron lifecycle helper.
//
// Potential helper candidates:
// - importNumericFixtures(page, count)
// - openSetupDialog(page)
// - changeLayoutMode(page, modeLabel)
// - switchToPreview(page)
// - openExportPdfDialog(page)
// - openExportPngDialog(page)
// - fillSaveDialog(page, fileName)
// - selectCard(page, index)
// - dragCard(page, fromIndex, toIndex)
//
// Once the second real business case is implemented, this file can either:
// 1. become a real helper module, or
// 2. be split into focused helpers per surface area.

module.exports = {};



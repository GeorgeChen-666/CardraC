const { test } = require('@playwright/test');

// Planned business E2E.
//
// Keep this file skipped until we decide the exact stable interaction path
// for drag-sort and bulk actions in the live Electron UI.
//
// Intended scope:
// 1. import multiple numeric image fixtures
// 2. verify initial card order in edit view
// 3. drag one card to a new position
// 4. select card(s) and trigger one bulk action
// 5. assert visible order / count / card content changes

test.describe.skip('planned editor backlog flows @backlog', () => {
  test('reorders cards and applies a bulk action @backlog', async () => {
    // Implementation notes:
    // - launch Electron with launchApp({ defaultPath })
    // - reuse numeric image fixtures under e2e/fixtures/images/numeric-images
    // - prefer stable selectors like:
    //   - data-testid="card-list"
    //   - data-testid="card-drag-handle-{index}"
    //   - Selection({count}) bulk menu labels
    // - start with a low-risk bulk action such as duplicate or remove
  });
});



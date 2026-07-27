# E2E Test Plan

## Directory layout

- `e2e/helpers/`
  - Electron launch / cleanup helpers
  - shared business helpers can be added here later
- `e2e/fixtures/`
  - deterministic input data for import / preview / export flows
- `e2e/tests/smoke/`
  - fastest baseline scenarios
  - should stay small and stable
- `e2e/tests/business/`
  - deeper end-to-end user flows
  - can be slower and cover more state transitions

## Current implemented coverage

- `smoke/import-image-and-preview.spec.js`
  - import one fixture image
  - confirm footer count updates
  - switch to preview view
- `business/settings-update-preview.spec.js`
  - import one fixture image
  - open `参数设置` and enable `页码`
  - verify the preview SVG changes after the real Electron render pipeline reruns
  - this specifically covers renderer -> main-process -> preview rendering collaboration that renderer unit tests cannot fully prove
- `business/export-save-dialogs.spec.js`
  - import one fixture image
  - export PDF through the in-app save dialog and assert a real `.pdf` file is written
  - export PNG through the in-app save dialog and assert the packaged `.zip` output is written
  - this covers renderer toolbar -> file browser save UI -> main-process export/render -> filesystem write -> renderer success notification
- `business/project-save-and-reopen.spec.js`
  - import one fixture image and enable `页码`
  - save a real `.cpnp` project file through the in-app save dialog
  - create a new project to clear in-memory state
  - reopen the saved `.cpnp` through the in-app open dialog
  - verify footer counts and preview SVG are restored after the full persistence round-trip
  - this is the highest-value basic-functionality E2E because it covers renderer toolbar -> file browser -> main-process save/load -> filesystem -> renderer state refill -> preview rerender
- `business/project-reopen-and-export.spec.js`
  - save a real `.cpnp` project, clear the app state, reopen it, and then export PDF
  - verify the restored project is not only visible again, but can continue using the export pipeline successfully
  - this extends the persistence round-trip into a second cross-process action, proving recovered state remains usable by the main-process export/render path
- `business/project-save-overwrite-confirm.spec.js`
  - save a real `.cpnp` project, modify configuration, then save again to the same name
  - verify the overwrite confirmation dialog appears from real filesystem state
  - cover both `是` and `否` branches
  - confirm overwrite, then reopen the project and verify the overwritten configuration is what gets restored
  - decline overwrite, then reopen the project and verify the previous file content is preserved
  - this protects the core overwrite-save branch of the persistence pipeline, not just the happy-path first save
- `business/multi-image-layout-mode-affects-preview.spec.js`
  - import 9 numeric fixture images and enable `页码`
  - verify default `双面` mode preview text and page navigator total
  - switch `卡牌模式` to `对贴`
  - verify the preview SVG page text and navigator total both change after the real main-process pagination/rerender path runs
- `business/layout-change-immediately-affects-export.spec.js`
  - import 9 numeric fixture images
  - export PNG once in default mode and inspect the generated zip entry count
  - switch `卡牌模式` and immediately export again
  - verify the second export reflects the new layout mode instead of stale main-process parameters
- `business/preview-then-export-stays-consistent.spec.js`
  - warm up preview in one layout mode, then switch layout mode and verify preview rerenders
  - export immediately after preview settles
  - verify export page count matches the updated preview mode
  - verify export completion does not push preview back to stale render results
  - import 9 numeric fixture images
  - export PNG once in default mode and inspect the generated zip entry count
  - switch `卡牌模式` and immediately export again
  - verify the second export reflects the new layout mode instead of stale main-process parameters
- `business/open-project-immediate-preview-export.spec.js`
  - save one small source project and one multi-image target project with a clearly different layout result
  - reopen the source project, warm preview state, then open the target project directly from that live session
  - verify preview page text and page navigator totals refresh to the target project instead of leaking the previous preview cache/result
  - open the target project and immediately continue into PNG export
  - verify the exported zip page count matches the newly opened project, proving the next renderer -> main action sees the new parameters instead of the previous project state
  - reopen a saved fold-in-half project, immediately change `卡牌模式` back to `双面` and enable `页码`, then export PNG without any extra settling wait
  - verify the export zip and follow-up preview both reflect the updated config instead of the just-opened project config
- `business/large-image-background-loading-export.spec.js`
  - generate a runtime-only large-image fixture set by upscaling the numeric images so the main process has real high-quality background work to do
  - import those large images and verify the footer backend job indicator shows `加载高质量图片`
  - export PNG immediately after import and verify the real zip output is still correct, proving the export path waits for async high-quality image loading to finish
  - switch to preview immediately after import and verify preview still becomes available correctly after the background loading completes
  - verify the background job indicator disappears once high-quality loading finishes
- `business/large-image-reload-immediate-preview-export.spec.js`
  - generate one runtime-only large image from an existing numeric fixture and import it
  - capture baseline preview and baseline exported PNG page content
  - overwrite the same source path with visibly different large-image content and trigger `手动重载图像`
  - immediately switch back to preview and verify the rendered preview pixels change instead of reusing stale cached content
  - immediately export PNG again and verify the exported page pixels also change while the page structure stays the same
- `business/large-image-partial-reload-preview-export.spec.js`
  - generate a full runtime-only large-image set and import multiple cards at once
  - switch to a layout where the imported cards span multiple preview/export pages
  - capture baseline hashes for preview pages and exported PNG pages
  - overwrite only one source image path with different content and trigger `手动重载图像`
  - verify at least one unaffected preview/export page stays byte-for-byte stable while the affected preview/export page changes

## Planned next coverage

### 1. Layout settings affecting preview

Goal:
- open `参数设置`
- change one layout-related option such as `卡牌模式`, `页码`, or `横置`
- confirm preview updates without app restart

Why:
- this is the most valuable next step for layout regression coverage
- it validates the connection between setup state and rendered output

Suggested assertions:
- dialog opens and closes correctly
- preview navigation remains available after the change
- total preview page text or page selector changes as expected

### 2. Export save dialogs

Goal:
- import fixture images
- open `导出PDF。` and `导出PNG。`
- verify the in-app save dialog opens in save mode

Why:
- export is a primary user outcome
- it reuses the same file browser surface that future open/save scenarios will depend on

Suggested assertions:
- dialog title `选择文件` is visible
- bottom save fields `文件名` / `扩展名` are visible
- action buttons `保存` / `取消` are visible
- optional overwrite confirmation can be covered once a deterministic output fixture path is prepared

### 3. Card ordering and bulk actions

Goal:
- import multiple images
- verify card list order
- drag-sort cards
- select cards and run one bulk action

Why:
- this is high-value editor behavior
- regressions here are hard to catch with unit tests alone

Suggested assertions:
- visible order changes after drag
- selection state updates
- bulk action result is reflected in card count / card content

### 4. File browser navigation and sorting

Goal:
- open the in-app file browser
- switch sort modes / view modes
- verify expected file order or visible item changes

Why:
- shared foundation for import / export / open / save flows

### 5. Language switching

Goal:
- switch language from toolbar
- confirm visible labels change

Why:
- cheap and user-visible regression detector

## Backlog coverage

### Print drawer validation

Goal:
- open print drawer
- validate page range input
- verify validation messages and disabled/enabled print behavior

Why:
- strong user-facing flow with lots of form validation
- can be tested without actually printing

Suggested assertions:
- invalid range shows `Format incorrect.`
- valid range removes validation error
- drawer actions remain responsive

## Naming conventions

- smoke: `e2e/tests/smoke/*.spec.js`
- broader business flows: `e2e/tests/business/*.spec.js`
- deferred exploration can still live under `e2e/tests/business/` but should use a `@backlog` tag until promoted
- file names should describe user intent, for example:
  - `settings-update-preview.spec.js`
  - `export-save-dialogs.spec.js`
  - `card-order-and-bulk-actions.spec.js`
  - `print-drawer-validation.spec.js`

## Script entrypoints

- `npm run e2e`
  - run all discovered E2E tests
- `npm run e2e:smoke`
  - run only smoke tests via `@smoke`
- `npm run e2e:business`
  - run business tests via `@business`
- `npm run e2e:backlog`
  - run deferred placeholders via `@backlog`
- `npm run e2e:list`
  - list discovered tests

## Notes for future implementation

- Prefer existing `data-testid` hooks when available.
- For top toolbar icon buttons, add stable selectors later if tooltip-based selection becomes brittle.
- Keep business specs independent: each spec should launch and clean up the Electron app on its own.
- Reuse `e2e/helpers/electronApp.js` for startup and shutdown.



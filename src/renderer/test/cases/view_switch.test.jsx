// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, test } from 'vitest';
import { MainPage } from '../pages/MainPage';
import {
  bootstrapRendererCase,
  cleanupRendererCase,
  renderRendererCase,
} from '../setup/rendererCaseBootstrap';
import { viewSwitchCases } from '../fixtures/viewSwitchCases';

describe('视图切换', () => {
  afterEach(() => {
    cleanupRendererCase();
  });

  beforeEach(() => {
    bootstrapRendererCase();
  });

  test.each(viewSwitchCases)('$name', async ({ initialView, initialExpectation, transitions }) => {
    bootstrapRendererCase({ currentView: initialView });
    const { Main } = await import('../../parts/Main');

    renderRendererCase(<Main />);
    const page = new MainPage();

    page.assertMatches(initialExpectation);

    for (const transition of transitions) {
      await page.footer.switchView(transition.targetViewLabel);
      page.assertMatches(transition.expectedView);
    }
  });
});














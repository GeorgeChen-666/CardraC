import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';
import { BasePage } from './BasePage';

export class FooterBar extends BasePage {
  constructor() {
    super();
    this.user = userEvent.setup();
  }

  async switchView(label) {
    await this.user.click(this.getButton(label));
  }

  assertMatches(expectation) {
    expectation.visibleButtons?.forEach((label) => {
      expect(this.getButton(label)).toBeTruthy();
    });

    expectation.hiddenButtons?.forEach((label) => {
      expect(this.queryButton(label)).toBeNull();
    });

    if (expectation.summaryText) {
      expect(this.getText(expectation.summaryText)).toBeTruthy();
    }

    if (expectation.currentView) {
      const chip = this.getButton(expectation.currentView);
      expect(chip.className).toContain('MuiChip-filled');
    }
  }
}
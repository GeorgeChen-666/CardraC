import { expect } from 'vitest';
import { BasePage } from './BasePage';

export class MenuBar extends BasePage {
  assertMatches(expectation) {
    expectation.visibleButtons?.forEach((label) => {
      expect(this.getButton(label)).toBeTruthy();
    });

    expectation.hiddenButtons?.forEach((label) => {
      expect(this.queryButton(label)).toBeNull();
    });

    expectation.visibleTexts?.forEach((label) => {
      expect(this.getText(label)).toBeTruthy();
    });

    expectation.hiddenTexts?.forEach((label) => {
      expect(this.queryText(label)).toBeNull();
    });

    expectation.visibleInputs?.forEach((value) => {
      expect(this.getInputByDisplayValue(value)).toBeTruthy();
    });

    expectation.hiddenInputs?.forEach((value) => {
      expect(this.queryInputByDisplayValue(value)).toBeNull();
    });
  }
}


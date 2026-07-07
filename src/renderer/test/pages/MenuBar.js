import { expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { BasePage } from './BasePage';

export class MenuBar extends BasePage {
  constructor() {
    super();
    this.user = userEvent.setup();
  }

  async clickButton(label) {
    await this.user.click(this.getButton(label));
  }

  isButtonDisabled(label) {
    return this.getButton(label).disabled;
  }

  getDialog(testId) {
    return screen.getByTestId(testId);
  }

  queryDialog(testId) {
    return screen.queryByTestId(testId);
  }

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
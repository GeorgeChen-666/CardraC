import { expect } from 'vitest';
import { BasePage } from '../BasePage';

export class BodySection extends BasePage {
  assertMatches(expectation) {
    expectation.visibleTestIds?.forEach((testId) => {
      expect(this.getByTestId(testId)).toBeTruthy();
    });

    expectation.hiddenTestIds?.forEach((testId) => {
      expect(this.queryByTestId(testId)).toBeNull();
    });
  }
}



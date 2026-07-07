import { screen } from '@testing-library/react';

export class BasePage {
  getButton(label) {
    return screen.getByRole('button', { name: label });
  }

  queryButton(label) {
    return screen.queryByRole('button', { name: label });
  }

  getText(label) {
    return screen.getByText(label);
  }

  queryText(label) {
    return screen.queryByText(label);
  }

  getInputByDisplayValue(value) {
    return screen.getByDisplayValue(value);
  }

  queryInputByDisplayValue(value) {
    return screen.queryByDisplayValue(value);
  }

  getByTestId(testId) {
    return screen.getByTestId(testId);
  }

  queryByTestId(testId) {
    return screen.queryByTestId(testId);
  }
}


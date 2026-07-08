import { screen } from '@testing-library/react';

export class BasePage {
  getButton(label) {
    return screen.getByRole('button', { name: label });
  }

  queryButton(label) {
    return screen.queryByRole('button', { name: label });
  }

  getMenuItem(label) {
    return screen.getByRole('menuitem', { name: label });
  }

  queryMenuItem(label) {
    return screen.queryByRole('menuitem', { name: label });
  }

  getCheckbox(label) {
    return screen.getByRole('checkbox', { name: label });
  }

  queryCheckbox(label) {
    return screen.queryByRole('checkbox', { name: label });
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


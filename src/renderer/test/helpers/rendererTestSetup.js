import React from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import { defaultTheme } from '../../theme/default';
import { useGlobalStore } from '../../state/store';
import { initialState } from '../../../shared/constants';

export const resetRendererStore = () => {
  useGlobalStore.getState().fillState(structuredClone(initialState));
};

export const mergeRendererState = (partialState, path = '') => {
  useGlobalStore.getState().mergeState(partialState, path);
};

export const renderWithRendererProviders = (ui) => render(
  React.createElement(
    ThemeProvider,
    { theme: defaultTheme },
    React.createElement(SnackbarProvider, null, ui),
  )
);



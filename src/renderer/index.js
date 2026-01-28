import React from 'react';
import * as ReactDOM from 'react-dom/client';
import './state/store';
import { defaultTheme } from './theme/default';
import { ThemeProvider } from '@mui/material';
import './global.css'
import "toastr";
import { SnackbarProvider } from 'notistack';
import { Main } from './parts/Main';

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);

//StrictMode
root.render(
  <ThemeProvider theme={defaultTheme}>
    <SnackbarProvider>
      <Main />
    </SnackbarProvider>
  </ThemeProvider>
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://cra.link/PWA
// serviceWorker.unregister();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();

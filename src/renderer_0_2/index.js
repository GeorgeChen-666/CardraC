import { ColorModeScript } from '@chakra-ui/react';
import React from 'react';
import * as ReactDOM from 'react-dom/client';
import './State/store';
import { defaultTheme } from './Theme/default';
import IconToolbar from './Parts/Toolbar';
import { ThemeProvider } from '@mui/material';
import './global.css'
import "toastr";
import { Notification } from './Parts/Notification';

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);

//StrictMode
root.render(
  <ThemeProvider theme={defaultTheme}>
    <Notification />
    <IconToolbar />
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

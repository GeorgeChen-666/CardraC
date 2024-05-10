import { ColorModeScript } from '@chakra-ui/react';
import React, { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import {StoreProvider} from './store'
import App from './App';
import * as serviceWorker from './serviceWorker';
import './global.css';

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);

//StrictMode
root.render(
  <StoreProvider>
    <ColorModeScript />
    <App />
  </StoreProvider>
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://cra.link/PWA
serviceWorker.unregister();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();

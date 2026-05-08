
import React from 'react';
import ReactDOM from 'react-dom/client';
import './src/i18n/config';
import App from './App';
import { initSentry } from './src/services/sentry';

initSentry();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

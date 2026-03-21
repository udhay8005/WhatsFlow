/**
 * @file main.jsx
 * @description React application entry point.
 *              Mounts the root App component inside ThemeProvider and AppWrapper,
 *              with React.StrictMode enabled for development-time warnings.
 * @module main
 * @author Udhaya Chandra SA
 * @version 1.0.0
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import AppWrapper from './components/AppWrapper.jsx';

import { ThemeProvider } from './contexts/ThemeContext';

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AppWrapper>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </AppWrapper>
  </React.StrictMode>
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@openlearn/ui/styles.css';
import './app.css';
import { App } from './app.js';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('OpenLearn dashboard root is missing');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

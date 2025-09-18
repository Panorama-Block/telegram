import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import WebApp from '@twa-dev/sdk';

// Be defensive: only call ready() if available
WebApp?.ready?.();

window.addEventListener('error', (e) => {
  const pre = document.createElement('pre');
  pre.style.cssText = 'color:#f33;padding:12px;white-space:pre-wrap';
  pre.textContent = 'Global error: ' + (e.error?.stack || e.message);
  document.body.appendChild(pre);
});
window.addEventListener('unhandledrejection', (e) => {
  const pre = document.createElement('pre');
  pre.style.cssText = 'color:#f33;padding:12px;white-space:pre-wrap';
  pre.textContent = 'Unhandled rejection: ' + (e.reason?.stack || String(e.reason));
  document.body.appendChild(pre);
});


const container = document.getElementById('app'); // <-- was 'root'
if (!container) {
  // Optional: log instead of crashing the webview
  console.error('Root element #app not found');
} else {
  createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
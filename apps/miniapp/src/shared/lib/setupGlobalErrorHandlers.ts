export function setupGlobalErrorHandlers() {
  window.addEventListener('error', (e) => {
    const pre = document.createElement('pre');
    pre.style.cssText = 'color:#f33;padding:12px;white-space:pre-wrap';
    pre.textContent = 'Global error: ' + (e.error instanceof Error ? e.error.stack : e.message);
    document.body.appendChild(pre);
  });

  window.addEventListener('unhandledrejection', (e) => {
    const pre = document.createElement('pre');
    pre.style.cssText = 'color:#f33;padding:12px;white-space:pre-wrap';
    pre.textContent = 'Unhandled rejection: ' + (e.reason instanceof Error ? e.reason.stack : String(e.reason));
    document.body.appendChild(pre);
  });
}

import React from 'react';
import { createRoot } from 'react-dom/client';
import App  from './App'
// Defer heavy SDK imports to avoid early module-evaluation crashes
// import WebApp from '@twa-dev/sdk';
// import { TonConnectUIProvider } from '@tonconnect/ui-react';

// Minimal bootstrap marker to prove script executed
console.log('[miniapp] bootstrap start');

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


async function mount() {
  const container = document.getElementById('app');
  if (!container) {
    // Optional: log instead of crashing the webview
    console.error('Root element #app not found (will retry on DOMContentLoaded)');
    return false;
  }
  // Build manifest URL relative to gateway prefix (/miniapp/)
  // Use dynamic manifest that adapts to current host
  const manifestUrl = `${window.location.origin}/miniapp/manifest.json`;
  console.log('[miniapp] manifest:', manifestUrl);
  class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: any }> {
    constructor(props: any) {
      super(props);
      this.state = { error: null };
    }
    static getDerivedStateFromError(error: any) {
      return { error };
    }
    override componentDidCatch(error: any, info: React.ErrorInfo) {
      // also mirror to DOM for quick visibility
      const pre = document.createElement('pre');
      pre.style.cssText = 'color:#f33;padding:12px;white-space:pre-wrap';
      pre.textContent = 'Render error: ' + (error?.stack || String(error)) + '\n' + (info?.componentStack || '');
      document.body.appendChild(pre);
    }
    override render() {
      if (this.state.error) {
        return React.createElement('div', { style: { padding: 16, color: '#f33', fontFamily: 'system-ui' } }, 'Render error: ', String(this.state.error));
      }
      return this.props.children as any;
    }
  }
  // Dynamically import webview SDK and TonConnect to avoid early hard failures
  try {
    const [
      { default: WebApp },
      { TonConnectUIProvider },
      thirdwebReact,
      { default: App },
      { Buffer },
    ] = await Promise.all([
      import('@twa-dev/sdk'),
      import('@tonconnect/ui-react'),
      import('thirdweb/react'),
      import('./App'),
      import('buffer'),
    ]);
    // Provide Node Buffer/global shims expected by some TON libs
    (globalThis as any).global = (globalThis as any).global || globalThis;
    (globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;
    (globalThis as any).process = (globalThis as any).process || { env: {} };
    WebApp?.ready?.();
    createRoot(container).render(
      <React.StrictMode>
        <ErrorBoundary>
          <TonConnectUIProvider manifestUrl={manifestUrl}>
            {/* Thirdweb provider for EVM wallets */}
            {React.createElement((thirdwebReact as any).ThirdwebProvider, {
              clientId: (import.meta as any).env?.VITE_THIRDWEB_CLIENT_ID || '',
              activeChain: undefined, // optional; user can pick network in ConnectButton
            }, React.createElement(App))}
          </TonConnectUIProvider>
        </ErrorBoundary>
      </React.StrictMode>,
    );
  } catch (e: any) {
    const pre = document.createElement('pre');
    pre.style.cssText = 'color:#f33;padding:12px;white-space:pre-wrap';
    pre.textContent = '[miniapp] bootstrap import error: ' + (e?.stack || String(e));
    document.body.appendChild(pre);
    console.error('[miniapp] bootstrap import error', e);
    // Render minimal app without TonConnect as a fallback
    createRoot(container).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>,
    );
  }
  return true;
}

if (!mount()) {
  window.addEventListener('DOMContentLoaded', () => {
    mount();
  }, { once: true });
}

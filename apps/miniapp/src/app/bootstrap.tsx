import React from 'react';
import { createRoot } from 'react-dom/client';

import { AppProviders } from './providers';
import { ErrorBoundary } from '../shared/lib/ErrorBoundary';
import { setupGlobalErrorHandlers } from '../shared/lib/setupGlobalErrorHandlers';

let globalHandlersReady = false;

function ensureGlobalHandlers() {
  if (!globalHandlersReady) {
    setupGlobalErrorHandlers();
    globalHandlersReady = true;
  }
}

function attachGlobalShims(BufferModule: { Buffer: any }) {
  const { Buffer } = BufferModule;
  (globalThis as any).global = (globalThis as any).global || globalThis;
  (globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;
  (globalThis as any).process = (globalThis as any).process || { env: {} };
}

async function renderWithProviders(container: HTMLElement, manifestUrl: string) {
  const [
    { default: WebApp },
    tonConnect,
    thirdwebReact,
    { default: App },
    bufferModule,
  ] = await Promise.all([
    import('@twa-dev/sdk'),
    import('@tonconnect/ui-react'),
    import('thirdweb/react'),
    import('./App'),
    import('buffer'),
  ]);

  attachGlobalShims(bufferModule);
  WebApp?.ready?.();

  const thirdwebClientId = (import.meta as any).env?.VITE_THIRDWEB_CLIENT_ID || '';

  createRoot(container).render(
    <React.StrictMode>
      <ErrorBoundary>
        <AppProviders
          manifestUrl={manifestUrl}
          TonConnectUIProvider={tonConnect.TonConnectUIProvider}
          thirdwebReact={thirdwebReact}
          thirdwebClientId={thirdwebClientId}
        >
          <App />
        </AppProviders>
      </ErrorBoundary>
    </React.StrictMode>,
  );
}

async function renderFallback(container: HTMLElement) {
  const { default: App } = await import('./App');
  createRoot(container).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}

export async function bootstrapMiniApp(): Promise<boolean> {
  ensureGlobalHandlers();
  const container = document.getElementById('app');
  if (!container) {
    console.error('Root element #app not found (will retry on DOMContentLoaded)');
    return false;
  }

  const manifestUrl = `${window.location.origin}/miniapp/manifest.json`;
  console.log('[miniapp] bootstrap start', { manifestUrl });

  try {
    await renderWithProviders(container, manifestUrl);
  } catch (err) {
    const pre = document.createElement('pre');
    pre.style.cssText = 'color:#f33;padding:12px;white-space:pre-wrap';
    pre.textContent = '[miniapp] bootstrap import error: ' + (err instanceof Error ? err.stack : String(err));
    document.body.appendChild(pre);
    console.error('[miniapp] bootstrap import error', err);
    await renderFallback(container);
  }

  return true;
}

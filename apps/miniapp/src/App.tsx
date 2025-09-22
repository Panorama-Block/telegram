import { useEffect, useMemo, useState } from 'react';
import React, { Suspense } from 'react';
const TonBalanceCardLazy = React.lazy(() => import('./ton/Balance').then(m => ({ default: m.TonBalanceCard })));
const EvmConnectButton = React.lazy(() => import('./web3/EvmConnectButton').then(m => ({ default: m.EvmConnectButton })));
const SwapCard = React.lazy(() => import('./swap/SwapCard').then(m => ({ default: m.SwapCard })));

type UserData = {
  telegram_user_id: number;
  username?: string;
  language_code?: string;
  zico_user_id: string;
  valid: boolean;
};

function useInitData() {
  return useMemo(() => {
    const fromTg = (window as any)?.Telegram?.WebApp?.initData as string | undefined;
    if (fromTg && fromTg.length > 0) return fromTg;
    const fromQuery = new URLSearchParams(location.search).get('initData');
    return fromQuery || '';
  }, []);
}

export default function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const initData = useInitData();
  const debugMode = useMemo(() => new URLSearchParams(location.search).get('debug') === '1', []);

  useEffect(() => {
    const tg = (window as any)?.Telegram?.WebApp;
    tg?.ready?.();
    tg?.expand?.();
  }, []);

  useEffect(() => {
    let aborted = false;
    async function run() {
      try {
        if (!initData) throw new Error('initData não encontrado');
        const baseEnv = (import.meta as any)?.env?.VITE_GATEWAY_BASE as string | undefined;
        const origin = window.location.origin;
        const base = (baseEnv && baseEnv.length > 0 ? baseEnv : origin).replace(/\/+$/,'');
        const url = `${base}/auth/telegram/verify`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ initData }),
        });
        if (!res.ok) throw new Error(`Erro na verificação: ${res.status}`);
        const json = (await res.json()) as UserData;
        if (!aborted) setUser(json);
      } catch (e: any) {
        if (!aborted) setError(e?.message || 'Erro desconhecido');
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    run();
    return () => { aborted = true; };
  }, [initData]);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ marginBottom: 12 }}>Validando sessão...</div>
        <div style={{ width: 32, height: 32, border: '3px solid #eee', borderTopColor: 'var(--tg-theme-button-color, #007acc)', borderRadius: '50%', margin: '0 auto', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#ef4444' }}>
        <h3>Erro na verificação</h3>
        <div style={{ marginTop: 8 }}>{error}</div>
      </div>
    );
  }

  const username = user?.username || 'user';
  return (
    <div style={{ padding: 20, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      {debugMode && (
        <pre style={{ background: '#111', color: '#0f0', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap' }}>
{`DEBUG
href: ${location.href}
origin: ${location.origin}
hasTG: ${Boolean((window as any)?.Telegram?.WebApp)}
initDataLen: ${initData?.length ?? 0}
UA: ${navigator.userAgent}
VITE_GATEWAY_BASE: ${(import.meta as any).env?.VITE_GATEWAY_BASE ?? 'unset'}
`}
        </pre>
      )}
      <h1>👋 Hello, {username}!</h1>
      <p style={{ color: 'var(--tg-theme-hint-color, #666)' }}>
        Telegram ID: {user?.telegram_user_id}
      </p>
      <Suspense fallback={<div style={{marginTop:12}}>Loading TON widget…</div>}>
        <TonBalanceCardLazy />
      </Suspense>
      <Suspense fallback={<div style={{marginTop:12}}>Loading EVM wallet…</div>}>
        <EvmConnectButton />
      </Suspense>
      <Suspense fallback={<div style={{marginTop:12}}>Loading Swap…</div>}>
        <SwapCard />
      </Suspense>
    </div>
  );
}

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createThirdwebClient } from 'thirdweb';
import { createWallet } from 'thirdweb/wallets';
import { signLoginPayload } from 'thirdweb/auth';

export default function WalletExternalPage() {
  const search = useSearchParams();
  const [status, setStatus] = useState('Abrindo carteira...');
  const [error, setError] = useState<string | null>(null);
  const [deepLinkUrl, setDeepLinkUrl] = useState<string | null>(null);

  const clientId = process.env.VITE_THIRDWEB_CLIENT_ID || '';
  const bot = process.env.VITE_TELEGRAM_BOT_USERNAME || '';
  const authApiBase = (process.env.VITE_AUTH_API_BASE || '').replace(/\/+$/, '');

  const client = useMemo(() => (clientId ? createThirdwebClient({ clientId }) : null), [clientId]);

  useEffect(() => {
    (async () => {
      try {
        if (!clientId || !client) throw new Error('THIRDWEB_CLIENT_ID ausente');
        if (!authApiBase) throw new Error('AUTH_API_BASE ausente');
        const walletId = (search.get('wallet') || 'metamask').toLowerCase();

        setStatus('Conectando carteira...');
        let accountAddress: string | undefined;
        let connectedAccount: any | undefined;

        if (walletId === 'metamask') {
          // Tentar injeção no in-app browser da MetaMask
          const mm = createWallet('io.metamask', { preferDeepLink: true });
          try {
            const acc = await mm.connect({ client });
            connectedAccount = acc;
            accountAddress = acc.address;
          } catch {
            // Se estiver fora do app da MetaMask, oferecer deep link
            const dappUrl = `${window.location.origin}/miniapp/auth/wallet-external?wallet=metamask`;
            const deep = `https://metamask.app.link/dapp/${dappUrl.replace(/^https?:\/\//, '')}`;
            setStatus('Abra o MetaMask para continuar...');
            setDeepLinkUrl(deep);
            return;
          }
        } else {
          // Fallback genérico via WalletConnect poderia ser adicionado aqui
          throw new Error('Wallet não suportada');
        }

        if (!accountAddress) throw new Error('Conta não conectada');

        // Autenticar com backend
        setStatus('Autenticando com backend...');
        const loginPayload = { address: accountAddress };

        const loginResponse = await fetch(`${authApiBase}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loginPayload),
        });
        if (!loginResponse.ok) {
          const errorText = await loginResponse.text();
          throw new Error(`Erro ao gerar payload: ${errorText}`);
        }
        const { payload } = await loginResponse.json();

        let signature = '';
        try {
          const res = await signLoginPayload({ account: connectedAccount, payload });
          signature = typeof res === 'string' ? res : (res as any).signature;
        } catch {
          throw new Error('Falha ao assinar payload');
        }

        const verifyResponse = await fetch(`${authApiBase}/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload, signature }),
        });
        if (!verifyResponse.ok) {
          const errorText = await verifyResponse.text();
          throw new Error(`Erro na verificação: ${errorText}`);
        }
        const { token } = await verifyResponse.json();
        localStorage.setItem('authToken', token);

        // Criar sessão para retorno ao Telegram
        if (bot) {
          try {
            const clientKey = `walletToken-${clientId}`;
            const walletCookie = localStorage.getItem(clientKey);
            const createResp = await fetch(`${authApiBase}/auth/miniapp/session/create`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token, walletCookie, ttlSeconds: 600 }),
            });
            if (createResp.ok) {
              const { nonce } = await createResp.json();
              const deep = `https://t.me/${bot}?startapp=code:${encodeURIComponent(nonce)}`;
              setDeepLinkUrl(deep);
              setStatus('Autenticação concluída. Volte ao Telegram.');
              return;
            }
          } catch {}
        }

        setStatus('Concluído. Você pode voltar ao Telegram.');
      } catch (err: any) {
        console.error('[WALLET EXTERNAL] error:', err);
        setError(err?.message || 'Falha');
      }
    })();
  }, [client, clientId, authApiBase, bot, search]);

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 480, width: '100%', padding: 24, background: '#0d1117', color: '#fff', borderRadius: 12, border: '1px solid rgba(6,182,212,0.3)' }}>
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Conectar Carteira</h2>
        <p style={{ margin: 0, color: '#9ca3af' }}>{status}</p>
        {error && <p style={{ marginTop: 12, color: '#ef4444' }}>Erro: {error}</p>}
        {!error && deepLinkUrl && (
          <div style={{ marginTop: 16 }}>
            <a
              href={deepLinkUrl}
              style={{ display: 'inline-block', padding: '12px 16px', background: '#2481cc', color: '#fff', borderRadius: 10, fontWeight: 600, textDecoration: 'none' }}
            >
              Abrir MetaMask
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

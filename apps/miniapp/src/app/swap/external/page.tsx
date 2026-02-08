'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createThirdwebClient, defineChain, prepareTransaction, sendTransaction, type Address, type Hex } from 'thirdweb';
import { inAppWallet, createWallet } from 'thirdweb/wallets';
import { getTokenDecimals } from '@/features/swap/utils';
import { swapApi } from '@/features/swap/api';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';

export default function SwapExternalPage() {
  const search = useSearchParams();
  const [status, setStatus] = useState('Preparing execution...');
  const [error, setError] = useState<string | null>(null);
  const [txHashes, setTxHashes] = useState<Array<{ hash: string; chainId: number }>>([]);
  const [deepLinkUrl, setDeepLinkUrl] = useState<string | null>(null);

  const clientId = THIRDWEB_CLIENT_ID;
  const authApiBase = (process.env.VITE_AUTH_API_BASE || '').replace(/\/+$/, '');
  const bot = process.env.VITE_TELEGRAM_BOT_USERNAME || '';

  const client = useMemo(() => (clientId ? createThirdwebClient({ clientId }) : null), [clientId]);

  useEffect(() => {
    (async () => {
      try {
        if (!client || !clientId) throw new Error('Invalid configuration');
        const fromChainId = Number(search.get('fromChainId'));
        const toChainId = Number(search.get('toChainId'));
        const fromToken = String(search.get('fromToken'));
        const toToken = String(search.get('toToken'));
        const amount = String(search.get('amount'));
        const nonce = search.get('nonce');

        // If a nonce is provided, consume the session so walletCookie/token are hydrated
        if (nonce && authApiBase) {
          setStatus('Restoring session...');
          try {
            const resp = await fetch(`${authApiBase}/auth/miniapp/session/consume`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nonce }),
            });
            if (resp.ok) {
              const { token, walletCookie } = await resp.json();
              if (walletCookie) {
                localStorage.setItem(`walletToken-${clientId}`, walletCookie);
              }
              if (token) {
                localStorage.setItem('authToken', token);
              }
            }
          } catch (e) {
            console.warn('[SwapExternal] Failed to consume session', e);
          }
        }

        // Connect the account: prefer in-app via cookie, otherwise fall back to injected wallets
        setStatus('Connecting wallet...');
        let account: any | null = null;
        try {
          const w = inAppWallet();
          account = await w.autoConnect({ client });
        } catch {}
        if (!account && (window as any).ethereum) {
          const mm = createWallet('io.metamask');
          account = await mm.connect({ client });
        }
        if (!account) throw new Error('Unable to connect wallet');

        // Recalculate and prepare
        setStatus('Calculating quote...');
        const quoteRes = await swapApi.quote({
          fromChainId,
          toChainId,
          fromToken,
          toToken,
          amount,
          unit: 'token',
          smartAccountAddress: account.address,
        });
        if (!quoteRes.success || !quoteRes.quote) throw new Error(quoteRes.message || 'Quote failed');

        setStatus('Preparing transactions...');
        // No need to recompute decimals because the API already returns wei in the quote
        const prepRes = await swapApi.prepare({
          fromChainId,
          toChainId,
          fromToken,
          toToken,
          amount: quoteRes.quote.amount, // wei string from the quote
          sender: account.address,
        });
        const prepared = prepRes.prepared;
        const txs: any[] = [];
        if (prepared?.transactions) txs.push(...prepared.transactions);
        if (prepared?.steps) for (const s of prepared.steps) if (s.transactions) txs.push(...s.transactions);
        if (!txs.length) throw new Error('No transactions returned to execute');

        setStatus('Executing...');
        const hashes: Array<{ hash: string; chainId: number }> = [] as any;
        for (const t of txs) {
          const tx = prepareTransaction({
            to: t.to as Address,
            chain: defineChain(t.chainId),
            client,
            data: t.data as Hex,
            value: t.value != null ? BigInt(t.value as any) : 0n,
            gas: t.gasLimit != null ? BigInt(t.gasLimit as any) : undefined,
            maxFeePerGas: t.maxFeePerGas != null ? BigInt(t.maxFeePerGas as any) : undefined,
            maxPriorityFeePerGas:
              t.maxPriorityFeePerGas != null ? BigInt(t.maxPriorityFeePerGas as any) : undefined,
          });
          const result = await sendTransaction({ account, transaction: tx });
          if (!result?.transactionHash) throw new Error('Transaction missing hash');
          hashes.push({ hash: result.transactionHash, chainId: t.chainId });
        }
        setTxHashes(hashes);

        // Deep link de volta ao Telegram
        if (bot) {
          setDeepLinkUrl(`https://t.me/${bot}?startapp=finish:ok`);
        }
        setStatus('Completed');
      } catch (e: any) {
        console.error('[SwapExternal] error:', e);
        setError(e?.message || 'Failed');
      }
    })();
  }, [client, clientId, search, authApiBase, bot]);

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 600, width: '100%', padding: 24, background: '#0d1117', color: '#fff', borderRadius: 12, border: '1px solid rgba(6,182,212,0.3)' }}>
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Executing Swap</h2>
        <p style={{ margin: 0, color: '#9ca3af' }}>{status}</p>
        {error && <p style={{ marginTop: 12, color: '#ef4444' }}>Error: {error}</p>}
        {txHashes.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Transactions:</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {txHashes.map(({ hash, chainId }) => (
                <li key={hash} style={{ fontFamily: 'monospace', fontSize: 12 }}>{hash} (chain {chainId})</li>
              ))}
            </ul>
          </div>
        )}
        {deepLinkUrl && (
          <div style={{ marginTop: 16 }}>
            <a href={deepLinkUrl} style={{ display: 'inline-block', padding: '12px 16px', background: '#2481cc', color: '#fff', borderRadius: 10, fontWeight: 600, textDecoration: 'none' }}>
              Return to Telegram
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

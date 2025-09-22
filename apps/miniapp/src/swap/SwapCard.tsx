import React, { useEffect, useMemo, useState } from 'react';

import {
  createThirdwebClient,
  defineChain,
  prepareTransaction,
  sendTransaction,
  type Address,
  type Hex,
} from 'thirdweb';
import { networks, type Network } from './tokens';
import { explorerTxUrl, formatAmountHuman, getTokenDecimals, isNative, normalizeToApi, parseAmountToWei } from './utils';
import { swapApi, SwapApiError } from './api';
import type { PreparedTx } from './types';
import { useActiveAccount } from 'thirdweb/react';

function formatForDebug(value: unknown): string {
  if (value === null || typeof value === 'undefined') return String(value);
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{props.title}</div>
      <div>{props.children}</div>
    </div>
  );
}

export function SwapCard() {
  const account = useActiveAccount();
  const clientId = (import.meta as any).env?.VITE_THIRDWEB_CLIENT_ID as string | undefined;
  const client = useMemo(() => (clientId ? createThirdwebClient({ clientId }) : null), [clientId]);
  const supportedChains = useMemo(() => networks.map((n) => n.chainId), []);

  const defaultFromChain = 8453; // Base
  const defaultToChain = 8453;   // start same-chain by default
  const [fromChainId, setFromChainId] = useState<number>(defaultFromChain);
  const [toChainId, setToChainId] = useState<number>(defaultToChain);

  const fromNet: Network | undefined = networks.find((n) => n.chainId === fromChainId);
  const toNet: Network | undefined = networks.find((n) => n.chainId === toChainId);

  const [fromToken, setFromToken] = useState<string>(() => fromNet?.tokens[0]?.address ?? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
  const [toToken, setToToken] = useState<string>(() => toNet?.tokens[0]?.address ?? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
  const [amount, setAmount] = useState<string>('');

  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<any | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [txHashes, setTxHashes] = useState<Array<{ hash: string; chainId: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<{
    context: 'quote' | 'prepare' | 'status';
    url?: string;
    payload?: unknown;
    status?: number;
    response?: unknown;
    causeMessage?: string;
  } | null>(null);

  // Reset token defaults when chain changes
  useEffect(() => {
    const next = networks.find((n) => n.chainId === fromChainId);
    const first = next?.tokens?.[0];
    if (first) setFromToken(first.address);
  }, [fromChainId]);
  useEffect(() => {
    const next = networks.find((n) => n.chainId === toChainId);
    const first = next?.tokens?.[0];
    if (first) setToToken(first.address);
  }, [toChainId]);

  const canQuote = useMemo(() => {
    return Boolean(fromChainId && toChainId && fromToken && toToken && amount && Number(amount) > 0);
  }, [fromChainId, toChainId, fromToken, toToken, amount]);

  async function onQuote() {
    setError(null);
    setQuote(null);
    setTxHashes([]);
    setDebugInfo(null);
    if (!canQuote) return;
    try {
      setQuoting(true);
      const body = {
        fromChainId,
        toChainId,
        fromToken: normalizeToApi(fromToken),
        toToken: normalizeToApi(toToken),
        amount: amount.trim(), // token units
        smartAccountAddress: account?.address,
      };
      const res = await swapApi.quote(body);
      if (!res.success || !res.quote) throw new Error(res.message || 'Failed to get quote');
      setQuote(res.quote);
    } catch (e: any) {
      if (e instanceof SwapApiError) {
        setDebugInfo({
          context: 'quote',
          url: e.url,
          payload: e.payload,
          status: e.status,
          response: e.responseBody,
          causeMessage: e.cause instanceof Error ? e.cause.message : undefined,
        });
      }
      setError(e?.message || 'Failed to get quote');
    } finally {
      setQuoting(false);
    }
  }

  function flattenPrepared(prepared: any): PreparedTx[] {
    const out: PreparedTx[] = [];
    if (!prepared) return out;
    if (Array.isArray(prepared.transactions)) out.push(...prepared.transactions);
    if (Array.isArray(prepared.steps)) {
      for (const s of prepared.steps) {
        if (Array.isArray(s.transactions)) out.push(...s.transactions);
      }
    }
    return out;
  }

  async function onSwap() {
    setError(null);
    setTxHashes([]);
    if (!account?.address) {
      setError('Connect a wallet first.');
      return;
    }
    if (!clientId) {
      setError('Missing THIRDWEB client id.');
      return;
    }
    if (!client) {
      setError('Missing THIRDWEB client configuration.');
      return;
    }
    setDebugInfo(null);
    try {
      setPreparing(true);
      const decimals = await getTokenDecimals({ client, chainId: fromChainId, token: fromToken });
      const wei = parseAmountToWei(amount, decimals);
      if (wei <= 0n) throw new Error('Invalid amount');

      const prep = await swapApi.prepare({
        fromChainId,
        toChainId,
        fromToken: normalizeToApi(fromToken),
        toToken: normalizeToApi(toToken),
        amount: wei.toString(),
        sender: account.address,
      });
      const seq = flattenPrepared(prep.prepared);
      if (!seq.length) throw new Error('No transactions returned by prepare');
      setPreparing(false);

      setExecuting(true);
      const hashes: Array<{ hash: string; chainId: number }> = [];
      for (const t of seq) {
        if (t.chainId !== fromChainId) {
          throw new Error(`Wallet chain mismatch. Please switch to chain ${t.chainId} and retry.`);
        }
        const tx = prepareTransaction({
          to: t.to as Address,
          chain: defineChain(t.chainId),
          client,
          data: t.data as Hex,
          value: t.value ? BigInt(t.value as any) : 0n,
        });
        const sent = await sendTransaction({ account, transaction: tx });
        hashes.push({ hash: sent.transactionHash, chainId: t.chainId });
      }
      setTxHashes(hashes);
    } catch (e: any) {
      if (e instanceof SwapApiError) {
        setDebugInfo({
          context: 'prepare',
          url: e.url,
          payload: e.payload,
          status: e.status,
          response: e.responseBody,
          causeMessage: e.cause instanceof Error ? e.cause.message : undefined,
        });
      }
      setError(e?.message || 'Swap failed');
    } finally {
      setPreparing(false);
      setExecuting(false);
    }
  }

  const receivePreview = useMemo(() => {
    if (!quote) return null;
    const dec = isNative(toToken) ? 18 : 18; // UI preview only; precise format requires actual token decimals
    try {
      return formatAmountHuman(BigInt(quote.estimatedReceiveAmount || '0'), dec);
    } catch {
      return null;
    }
  }, [quote, toToken]);

  return (
    <div style={{
      marginTop: 16,
      background: 'var(--tg-theme-secondary-bg-color, #f6f7f9)',
      borderRadius: 12,
      padding: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Swap</h3>
        <span style={{ color: '#666', fontSize: 12 }}>Chains: {supportedChains.join(', ')}</span>
      </div>

      <Section title="From">
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={fromChainId} onChange={(e) => setFromChainId(Number(e.target.value))}>
            {networks.map((n) => (
              <option key={n.chainId} value={n.chainId}>{n.name}</option>
            ))}
          </select>
          <select value={fromToken} onChange={(e) => setFromToken(e.target.value)}>
            {fromNet?.tokens.map((t) => (
              <option key={t.address} value={t.address}>{t.symbol}</option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="any"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
      </Section>

      <Section title="To">
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={toChainId} onChange={(e) => setToChainId(Number(e.target.value))}>
            {networks.map((n) => (
              <option key={n.chainId} value={n.chainId}>{n.name}</option>
            ))}
          </select>
          <select value={toToken} onChange={(e) => setToToken(e.target.value)}>
            {toNet?.tokens.map((t) => (
              <option key={t.address} value={t.address}>{t.symbol}</option>
            ))}
          </select>
        </div>
      </Section>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={onQuote} disabled={!canQuote || quoting}>
          {quoting ? 'Quoting…' : 'Get Quote'}
        </button>
        <button onClick={onSwap} disabled={!quote || preparing || executing}>
          {preparing ? 'Preparing…' : executing ? 'Swapping…' : 'Swap'}
        </button>
      </div>

      {error && (
        <div style={{ color: '#ef4444', marginTop: 8 }}>
          <div>{error}</div>
          {debugInfo && (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                borderRadius: 8,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.35)',
                color: '#7f1d1d',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Debug info ({debugInfo.context})</div>
              {debugInfo.url && (
                <div style={{ wordBreak: 'break-all' }}>Request URL: <code>{debugInfo.url}</code></div>
              )}
              {typeof debugInfo.status === 'number' && (
                <div>Status code: {debugInfo.status}</div>
              )}
              {typeof debugInfo.payload !== 'undefined' && (
                <div style={{ marginTop: 6 }}>
                  Payload:
                  <pre
                    style={{
                      marginTop: 4,
                      padding: 8,
                      background: 'rgba(127,29,29,0.08)',
                      borderRadius: 6,
                      overflowX: 'auto',
                    }}
                  >
                    {formatForDebug(debugInfo.payload)}
                  </pre>
                </div>
              )}
              {typeof debugInfo.response !== 'undefined' && (
                <div style={{ marginTop: 6 }}>
                  Response:
                  <pre
                    style={{
                      marginTop: 4,
                      padding: 8,
                      background: 'rgba(127,29,29,0.08)',
                      borderRadius: 6,
                      overflowX: 'auto',
                    }}
                  >
                    {formatForDebug(debugInfo.response)}
                  </pre>
                </div>
              )}
              {debugInfo.causeMessage && (
                <div style={{ marginTop: 6 }}>Cause: {debugInfo.causeMessage}</div>
              )}
            </div>
          )}
        </div>
      )}

      {quote && (
        <div style={{ marginTop: 12, color: 'var(--tg-theme-hint-color, #555)' }}>
          <div>Estimated receive: {receivePreview ?? '?'} {toNet?.tokens.find(t => t.address === toToken)?.symbol}</div>
          {quote.exchangeRate && <div>Rate: {quote.exchangeRate}</div>}
          {typeof quote.estimatedDuration !== 'undefined' && (
            <div>ETA: {quote.estimatedDuration} ms</div>
          )}
        </div>
      )}

      {txHashes.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Transactions</div>
          {txHashes.map((t) => {
            const url = explorerTxUrl(t.chainId, t.hash);
            return (
              <div key={t.hash} style={{ fontFamily: 'monospace', fontSize: 12 }}>
                {url ? (<a href={url} target="_blank" rel="noreferrer">{t.hash}</a>) : t.hash} (chain {t.chainId})
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SwapCard;

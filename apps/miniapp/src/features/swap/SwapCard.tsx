import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import {
  createThirdwebClient,
  defineChain,
  prepareTransaction,
  sendTransaction,
  type Address,
  type Hex,
} from 'thirdweb';

import { Button, Card, Input, Label, Select } from '../../shared/ui';
import { networks, type Network } from './tokens';
import {
  explorerTxUrl,
  formatAmountHuman,
  getTokenDecimals,
  isNative,
  normalizeToApi,
  parseAmountToWei,
} from './utils';
import { swapApi, SwapApiError } from './api';
import type { PreparedTx } from './types';

function ArrowUpDownIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 5L12 19"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M16 9L12 5L8 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 15L12 19L16 15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowDownIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 5V19"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M16 15L12 19L8 15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatForDebug(value: unknown): string {
  if (value === null || typeof value === 'undefined') return String(value);
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function resolveUserFacingError(err: unknown): string {
  const message = (() => {
    if (!err) return 'Erro desconhecido';
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  })();

  const lower = message.toLowerCase();
  if (lower.includes('insufficient funds') || lower.includes('have 0 want')) {
    return 'Saldo insuficiente para cobrir o valor da transação e as taxas de rede. Ajuste o montante ou adicione fundos.';
  }
  if (lower.includes('gas required exceeds allowance')) {
    return 'A transação exige mais gas do que está disponível. Tente reduzir o valor ou aumente seu saldo.';
  }
  if (lower.includes('user rejected') || lower.includes('user denied')) {
    return 'Assinatura recusada pelo usuário.';
  }

  return message;
}

const panelStyle: React.CSSProperties = {
  borderRadius: 16,
  padding: 16,
  background: 'rgba(148, 163, 184, 0.08)',
  border: '1px solid rgba(148, 163, 184, 0.2)',
};

const selectGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
};

export function SwapCard() {
  const account = useActiveAccount();
  const clientId = (import.meta as any).env?.VITE_THIRDWEB_CLIENT_ID as string | undefined;
  const client = useMemo(() => (clientId ? createThirdwebClient({ clientId }) : null), [clientId]);
  const supportedChains = useMemo(() => networks.map((n) => n.chainId), []);

  const defaultFromChain = 8453; // Base
  const defaultToChain = 8453;
  const [fromChainId, setFromChainId] = useState<number>(defaultFromChain);
  const [toChainId, setToChainId] = useState<number>(defaultToChain);

  const fromNet: Network | undefined = networks.find((n) => n.chainId === fromChainId);
  const toNet: Network | undefined = networks.find((n) => n.chainId === toChainId);

  const [fromToken, setFromToken] = useState<string>(
    () => fromNet?.tokens[0]?.address ?? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  );
  const [toToken, setToToken] = useState<string>(
    () => toNet?.tokens[0]?.address ?? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  );
  const [amount, setAmount] = useState<string>('');

  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<any | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [txHashes, setTxHashes] = useState<Array<{ hash: string; chainId: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<{
    context: 'quote' | 'prepare';
    url?: string;
    payload?: unknown;
    status?: number;
    response?: unknown;
    causeMessage?: string;
  } | null>(null);
  const quoteRequestRef = useRef(0);
  const [toTokenDecimals, setToTokenDecimals] = useState<number>(18);

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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!toNet) {
        setToTokenDecimals(18);
        return;
      }

      if (isNative(toToken)) {
        setToTokenDecimals(toNet.nativeCurrency?.decimals ?? 18);
        return;
      }

      if (!client) {
        setToTokenDecimals(18);
        return;
      }

      try {
        const decimals = await getTokenDecimals({ client, chainId: toChainId, token: toToken });
        if (!cancelled) {
          setToTokenDecimals(decimals);
        }
      } catch {
        if (!cancelled) {
          setToTokenDecimals(18);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [client, toChainId, toNet, toToken]);

  const canSubmit = useMemo(() => {
    return Boolean(fromChainId && toChainId && fromToken && toToken && amount && Number(amount) > 0);
  }, [fromChainId, toChainId, fromToken, toToken, amount]);

  useEffect(() => {
    const requestId = ++quoteRequestRef.current;

    if (!canSubmit) {
      setQuote(null);
      setQuoting(false);
      return undefined;
    }

    setQuote(null);
    setTxHashes([]);

    const timer = window.setTimeout(() => {
      void performQuote(requestId);
    }, 350);

    return () => {
      clearTimeout(timer);
    };
  }, [canSubmit, fromChainId, toChainId, fromToken, toToken, amount, account?.address]);

  async function performQuote(requestId: number) {
    if (!canSubmit) return;
    setError(null);
    setDebugInfo(null);
    try {
      setQuoting(true);
      const body = {
        fromChainId,
        toChainId,
        fromToken: normalizeToApi(fromToken),
        toToken: normalizeToApi(toToken),
        amount: amount.trim(),
        smartAccountAddress: account?.address,
      };
      const res = await swapApi.quote(body);
      if (quoteRequestRef.current !== requestId) {
        return;
      }
      if (!res.success || !res.quote) throw new Error(res.message || 'Failed to get quote');
      setQuote(res.quote);
    } catch (e: any) {
      if (quoteRequestRef.current !== requestId) {
        return;
      }
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
      setError(resolveUserFacingError(e));
    } finally {
      if (quoteRequestRef.current === requestId) {
        setQuoting(false);
      }
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
    if (!clientId || !client) {
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
          throw new Error(`Wallet chain mismatch. Switch to chain ${t.chainId} and retry.`);
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
      setError(resolveUserFacingError(e));
    } finally {
      setPreparing(false);
      setExecuting(false);
    }
  }

  function swapSides() {
    setFromChainId(toChainId);
    setFromToken(toToken);
    setToChainId(fromChainId);
    setToToken(fromToken);
    setQuote(null);
    setTxHashes([]);
  }

  const receivePreview = useMemo(() => {
    if (!quote) return null;

    const symbol = (() => {
      if (!toNet) return undefined;
      if (isNative(toToken)) {
        return toNet.nativeCurrency?.symbol;
      }
      return toNet.tokens?.find((t) => t.address === toToken)?.symbol;
    })();

    const amountOut = quote.toAmount || quote.estimatedReceiveAmount;
    if (!amountOut) return null;

    try {
      const formatted = formatAmountHuman(BigInt(amountOut), toTokenDecimals);
      return `${formatted} ${symbol ?? ''}`.trim();
    } catch {
      return null;
    }
  }, [quote, toNet, toToken, toTokenDecimals]);

  async function handlePrimaryAction() {
    if (!quote) return;
    await onSwap();
  }

  const primaryLabel = quote
    ? executing
      ? 'Executing swap…'
      : preparing
        ? 'Preparing transactions…'
        : 'Swap Tokens'
    : quoting
      ? 'Calculando cotação…'
      : 'Aguardando cotação…';

  const primaryVariant = quote ? 'accent' : 'primary';

  return (
    <Card padding={20} tone="muted">
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--tg-theme-text-color, #111)' }}>
          Token Swap
        </h2>
        <p style={{ marginTop: 6, color: 'var(--tg-theme-hint-color, #687280)', fontSize: 14 }}>
          Bridge and swap assets seamlessly across supported networks.
        </p>
      </div>

      <div style={panelStyle}>
        <Label style={{ marginBottom: 12 }}>From</Label>
        <div style={selectGrid}>
          <div>
            <Label htmlFor="from-chain" style={{ fontSize: 12 }}>Chain</Label>
            <Select
              id="from-chain"
              value={String(fromChainId)}
              onChange={(e) => setFromChainId(Number(e.target.value))}
            >
              <option value="" disabled>Select chain</option>
              {networks.map((net) => (
                <option key={net.chainId} value={net.chainId}>
                  {net.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="from-token" style={{ fontSize: 12 }}>Token</Label>
            <Select
              id="from-token"
              value={fromToken}
              onChange={(e) => setFromToken(e.target.value)}
              disabled={!fromNet}
            >
              <option value="" disabled>Select token</option>
              {fromNet?.tokens.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <Label htmlFor="amount" style={{ fontSize: 12 }}>Amount</Label>
          <Input
            id="amount"
            type="number"
            min="0"
            step="any"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ fontSize: 18, fontWeight: 600 }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
        <Button
          variant="outline"
          size="icon"
          onClick={swapSides}
          disabled={!canSubmit}
          style={{
            borderWidth: 2,
            background: 'transparent',
          }}
        >
          <ArrowUpDownIcon />
        </Button>
      </div>

      <div style={{ ...panelStyle, marginTop: 16 }}>
        <Label style={{ marginBottom: 12 }}>To</Label>
        <div style={selectGrid}>
          <div>
            <Label htmlFor="to-chain" style={{ fontSize: 12 }}>Chain</Label>
            <Select
              id="to-chain"
              value={String(toChainId)}
              onChange={(e) => setToChainId(Number(e.target.value))}
            >
              <option value="" disabled>Select chain</option>
              {networks.map((net) => (
                <option key={net.chainId} value={net.chainId}>
                  {net.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="to-token" style={{ fontSize: 12 }}>Token</Label>
            <Select
              id="to-token"
              value={toToken}
              onChange={(e) => setToToken(e.target.value)}
              disabled={!toNet}
            >
              <option value="" disabled>Select token</option>
              {toNet?.tokens.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 12,
            border: '1px solid rgba(148, 163, 184, 0.3)',
            background: 'var(--tg-theme-bg-color, #fff)',
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: 'var(--tg-theme-hint-color, #687280)' }}>You will receive</p>
          <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 600 }}>
            {receivePreview ?? '—'}
          </p>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <Button
          onClick={handlePrimaryAction}
          variant={primaryVariant}
          size="lg"
          block
          disabled={!canSubmit || quoting || preparing || executing}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <ArrowDownIcon />
            {primaryLabel}
          </span>
        </Button>
      </div>

      {error && (
        <div style={{ color: '#ef4444', marginTop: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {debugInfo && (
        <details style={{ marginTop: 16, fontSize: 13 }}>
          <summary>Debug info ({debugInfo.context})</summary>
          {debugInfo.url && <div style={{ marginTop: 6 }}>URL: {debugInfo.url}</div>}
          {debugInfo.status && <div>Status: {debugInfo.status}</div>}
          {typeof debugInfo.payload !== 'undefined' && (
            <pre
              style={{
                marginTop: 6,
                whiteSpace: 'pre-wrap',
                background: '#111',
                color: '#0f0',
                padding: 8,
                borderRadius: 8,
              }}
            >
              {formatForDebug(debugInfo.payload)}
            </pre>
          )}
          {typeof debugInfo.response !== 'undefined' && (
            <pre
              style={{
                marginTop: 6,
                whiteSpace: 'pre-wrap',
                background: '#111',
                color: '#0f0',
                padding: 8,
                borderRadius: 8,
              }}
            >
              {formatForDebug(debugInfo.response)}
            </pre>
          )}
          {debugInfo.causeMessage && <div>Cause: {debugInfo.causeMessage}</div>}
        </details>
      )}

      {txHashes.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>Transactions</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {txHashes.map(({ hash, chainId }) => (
              <a
                key={hash}
                href={explorerTxUrl(chainId, hash)}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  color: 'var(--tg-theme-button-color, #007acc)',
                }}
              >
                {hash}
              </a>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default SwapCard;

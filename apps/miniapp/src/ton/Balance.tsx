import React, { useEffect, useMemo, useState } from 'react';
import { TonConnectButton, useTonAddress, useTonWallet } from '@tonconnect/ui-react';
// Defer TON-related imports to runtime to ensure polyfills (Buffer) are present

type TonClientType = any; // keep light – types not critical for runtime here

function useTonClient(networkHint: 'mainnet' | 'testnet'): TonClientType | null {
  const [client, setClient] = useState<TonClientType | null>(null);
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const [{ getHttpEndpoint }, { TonClient }] = await Promise.all([
          import('@orbs-network/ton-access'),
          import('@ton/ton'),
        ]);
        const endpoint = await getHttpEndpoint({ network: networkHint });
        if (!aborted) setClient(new TonClient({ endpoint }));
      } catch (e) {
        console.error('Failed to resolve TON endpoint', e);
        if (!aborted) setClient(null);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [networkHint]);
  return client;
}

export function TonBalanceCard() {
  const wallet = useTonWallet();
  const rawAddress = useTonAddress(); // user-friendly address (bounceable)

  const network: 'mainnet' | 'testnet' = useMemo(() => {
    // wallet?.account?.chain can be -239 (testnet) or -3 (mainnet) depending on SDK versions.
    // ui-react exposes wallet?.account?.chain as string in newer versions; be permissive.
    // Fallback to mainnet if unknown.
    const chain: any = (wallet as any)?.account?.chain;
    if (chain === 'testnet' || chain === -239) return 'testnet';
    if (chain === 'mainnet' || chain === -3) return 'mainnet';
    return 'mainnet';
  }, [wallet]);

  const client = useTonClient(network);
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    async function load() {
      if (!client || !rawAddress) return;
      setLoading(true);
      setError(null);
      try {
        const { Address, fromNano } = await import('@ton/core');
        const addr = Address.parse(rawAddress);
        const bal = await client.getBalance(addr);
        if (!aborted) setBalance(fromNano(bal));
      } catch (e: any) {
        if (!aborted) setError(e?.message || 'Failed to fetch balance');
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    load();
    // refresh when client/address changes
  }, [client, rawAddress]);

  return (
    <div style={{
      marginTop: 16,
      background: 'var(--tg-theme-secondary-bg-color, #f6f7f9)',
      borderRadius: 12,
      padding: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h3 style={{ margin: 0 }}>TON Wallet</h3>
        <TonConnectButton />
      </div>
      {!wallet && (
        <p style={{ color: 'var(--tg-theme-hint-color, #666)', marginTop: 12 }}>
          Connect your TON wallet (Telegram Wallet supported)
        </p>
      )}
      {wallet && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color, #666)' }}>
            Network: {network}
          </div>
          <div style={{ wordBreak: 'break-all', marginTop: 4 }}>
            Address: {rawAddress}
          </div>
          <div style={{ marginTop: 8 }}>
            {loading ? (
              <span>Loading balance...</span>
            ) : error ? (
              <span style={{ color: '#ef4444' }}>Error: {error}</span>
            ) : balance !== null ? (
              <strong>{balance} TON</strong>
            ) : (
              <span>—</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

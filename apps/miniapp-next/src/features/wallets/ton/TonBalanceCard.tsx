import React, { useEffect, useMemo, useState } from 'react';
import { TonConnectButton, useTonAddress, useTonWallet } from '@tonconnect/ui-react';

import { Card } from '../../../shared/ui';

type TonClientType = any;

type NetworkHint = 'mainnet' | 'testnet';

function useTonClient(networkHint: NetworkHint): TonClientType | null {
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
        if (!aborted) {
          setClient(new TonClient({ endpoint }));
        }
      } catch (e) {
        console.error('Failed to resolve TON endpoint', e);
        if (!aborted) {
          setClient(null);
        }
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
  const rawAddress = useTonAddress();

  const network: NetworkHint = useMemo(() => {
    const chain: any = (wallet as any)?.account?.chain;
    if (chain === 'testnet' || chain === -239) {
      return 'testnet';
    }
    if (chain === 'mainnet' || chain === -3) {
      return 'mainnet';
    }
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
        if (!aborted) {
          setBalance(fromNano(bal));
        }
      } catch (e: any) {
        if (!aborted) {
          setError(e?.message || 'Failed to fetch balance');
        }
      } finally {
        if (!aborted) {
          setLoading(false);
        }
      }
    }

    load();
  }, [client, rawAddress]);

  return (
    <Card
      title="TON Wallet"
      action={<TonConnectButton />}
    >
      {!wallet && (
        <p style={{ color: 'var(--tg-theme-hint-color, #666)', margin: 0 }}>
          Connect your TON wallet (Telegram Wallet supported)
        </p>
      )}

      {wallet && (
        <div>
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
    </Card>
  );
}

export default TonBalanceCard;

'use client';

import { useMemo } from 'react';
import { useActiveAccount } from 'thirdweb/react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AvaxUnlockRequest {
  index: number;
  shareAmount: string;
  unlockTimestamp: number;
  unlockTimeISO: string;
  redeemable: boolean;
}

export interface AvaxStakingPosition {
  userAddress: string;
  sAvaxBalance: string;
  exchangeRate: string;
  apy: number | null;
  pendingUnlocks: AvaxUnlockRequest[];
}

export interface AvaxStakingTx {
  to: string;
  data: string;
  value: string;
  chainId: number;
}

/* ------------------------------------------------------------------ */
/*  API Client                                                         */
/* ------------------------------------------------------------------ */

// Routes through the Next.js /api/lending proxy → lending-service → execution layer
const LENDING_API = '/api/lending';

export class AvaxStakingApiClient {
  private userAddress: string | null;

  constructor(userAddress: string | null) {
    this.userAddress = userAddress;
  }

  async getPosition(): Promise<AvaxStakingPosition | null> {
    if (!this.userAddress) return null;
    const res = await fetch(`${LENDING_API}/liquid-staking/position/${this.userAddress}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data as AvaxStakingPosition;
  }

  async prepareStake(amountWei: string): Promise<AvaxStakingTx | null> {
    if (!this.userAddress) throw new Error('Wallet not connected');
    const res = await fetch(`${LENDING_API}/liquid-staking/prepare-stake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: this.userAddress, amount: amountWei }),
    });
    const json = await res.json();
    if (!res.ok || json.data?.error) throw new Error(json.data?.error ?? `HTTP ${res.status}`);
    return (json.data?.stake ?? null) as AvaxStakingTx | null;
  }

  async prepareRequestUnlock(sAvaxAmountWei: string): Promise<AvaxStakingTx | null> {
    if (!this.userAddress) throw new Error('Wallet not connected');
    const res = await fetch(`${LENDING_API}/liquid-staking/prepare-request-unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: this.userAddress, sAvaxAmount: sAvaxAmountWei }),
    });
    const json = await res.json();
    if (!res.ok || json.data?.error) throw new Error(json.data?.error ?? `HTTP ${res.status}`);
    const steps: AvaxStakingTx[] = json.data?.bundle?.steps ?? [];
    return steps[0] ?? null;
  }

  async prepareRedeem(userUnlockIndex: number): Promise<AvaxStakingTx | null> {
    if (!this.userAddress) throw new Error('Wallet not connected');
    const res = await fetch(`${LENDING_API}/liquid-staking/prepare-redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: this.userAddress, userUnlockIndex }),
    });
    const json = await res.json();
    if (!res.ok || json.data?.error) throw new Error(json.data?.error ?? `HTTP ${res.status}`);
    return (json.data?.redeem ?? null) as AvaxStakingTx | null;
  }
}

/* ------------------------------------------------------------------ */
/*  React Hook                                                         */
/* ------------------------------------------------------------------ */

export const useAvaxStakingApi = () => {
  const account = useActiveAccount();
  const addr = account?.address ?? null;
  return useMemo(() => new AvaxStakingApiClient(addr), [addr]);
};

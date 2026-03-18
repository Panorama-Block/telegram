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
  avaxEquivalent?: string;
  exchangeRate: string;
  pendingUnlocks: AvaxUnlockRequest[];
}

export interface AvaxStakingTx {
  to: string;
  data: string;
  value: string;
  chainId: number;
}

/* ------------------------------------------------------------------ */
/*  API Client — calls execution layer directly via Next.js proxy     */
/*  /api/liquid-staking/benqi/* → execution_service/avax/liquid-staking/*  */
/* ------------------------------------------------------------------ */

const API_BASE = '/api/liquid-staking/benqi';

export class AvaxStakingApiClient {
  private userAddress: string | null;

  constructor(userAddress: string | null) {
    this.userAddress = userAddress;
  }

  async getPosition(): Promise<AvaxStakingPosition | null> {
    if (!this.userAddress) return null;
    const res = await fetch(`${API_BASE}/position/${this.userAddress}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data as AvaxStakingPosition;
  }

  async prepareStake(amountWei: string): Promise<AvaxStakingTx | null> {
    if (!this.userAddress) throw new Error('Wallet not connected');
    const res = await fetch(`${API_BASE}/prepare-stake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress: this.userAddress, amount: amountWei }),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
    // Execution layer returns { bundle: { steps: [...] }, metadata }
    const steps: AvaxStakingTx[] = json.bundle?.steps ?? [];
    return steps[0] ?? null;
  }

  async prepareRequestUnlock(sAvaxAmountWei: string): Promise<AvaxStakingTx | null> {
    if (!this.userAddress) throw new Error('Wallet not connected');
    const res = await fetch(`${API_BASE}/prepare-request-unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress: this.userAddress, sAvaxAmount: sAvaxAmountWei }),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
    const steps: AvaxStakingTx[] = json.bundle?.steps ?? [];
    return steps[0] ?? null;
  }

  async prepareRedeem(userUnlockIndex: number): Promise<AvaxStakingTx | null> {
    if (!this.userAddress) throw new Error('Wallet not connected');
    const res = await fetch(`${API_BASE}/prepare-redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress: this.userAddress, userUnlockIndex }),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
    const steps: AvaxStakingTx[] = json.bundle?.steps ?? [];
    return steps[0] ?? null;
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

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
  apy: number | null;
  pendingUnlocks: AvaxUnlockRequest[];
}

export interface AvaxStakingTx {
  to: string;
  data: string;
  value: string;
  chainId: number;
  gasLimit?: string;
}

export interface AvaxStakingPreparedOperation {
  correlationId: string;
  evidenceVersion: string;
  evidenceEnabled: boolean;
  preparedPayloadHash: string;
  bundle: {
    steps: AvaxStakingTx[];
  };
  metadata: {
    action: 'stake';
    avaxAmount: string;
    estimatedSAvax: string;
  };
}

export interface AvaxUnlockPreparedOperation {
  correlationId: string;
  evidenceVersion: string;
  evidenceEnabled: boolean;
  preparedPayloadHash: string;
  bundle: {
    steps: AvaxStakingTx[];
  };
  metadata: {
    action: 'requestUnlock';
    sAvaxAmount: string;
    estimatedAvax: string;
    cooldownDays: number;
  };
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

  async prepareStake(amountWei: string): Promise<AvaxStakingPreparedOperation | null> {
    if (!this.userAddress) throw new Error('Wallet not connected');
    const res = await fetch(`${API_BASE}/prepare-stake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress: this.userAddress, amount: amountWei }),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
    return json as AvaxStakingPreparedOperation;
  }

  async prepareRequestUnlock(sAvaxAmountWei: string): Promise<AvaxUnlockPreparedOperation | null> {
    if (!this.userAddress) throw new Error('Wallet not connected');
    const res = await fetch(`${API_BASE}/prepare-request-unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress: this.userAddress, sAvaxAmount: sAvaxAmountWei }),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
    return json as AvaxUnlockPreparedOperation;
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

'use client';

/**
 * Metronome Synth — frontend API client.
 *
 * Built on the shared `createDefiHttp` primitive (see shared/lib/defiApiBase.ts).
 * All Metronome feature code should import from here — do not hit `fetch` directly.
 */

import { useMemo } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { createDefiHttp, type DefiHttp } from '@/shared/lib/defiApiBase';
import { API_ENDPOINTS, METRONOME_CONFIG, resolveMetronomeBase } from './config';
import type {
  MetronomeMarkets,
  PrepareDepositRequest,
  PrepareMintRequest,
  PrepareRepayRequest,
  PrepareResponse,
  PrepareUnwindRequest,
  PrepareWithdrawRequest,
  UserPosition,
} from './types';

export class MetronomeApiClient {
  readonly http: DefiHttp;
  readonly userAddress: string | null;

  constructor(userAddress: string | null) {
    this.userAddress = userAddress;
    this.http = createDefiHttp({
      baseUrl:   resolveMetronomeBase(),
      label:     'metronome',
      timeoutMs: METRONOME_CONFIG.REQUEST_TIMEOUT_MS,
    });
  }

  /** GET /modules/metronome/markets */
  getMarkets(): Promise<MetronomeMarkets> {
    return this.http.get<MetronomeMarkets>(API_ENDPOINTS.MARKETS);
  }

  /**
   * GET /modules/metronome/position/:userAddress
   *
   * Returns an empty envelope (all zeros) if the per-user proxy is not yet
   * predictable — the frontend can render "no position" without branching.
   */
  getPosition(userAddress?: string): Promise<UserPosition> {
    const addr = userAddress ?? this.userAddress;
    if (!addr) throw new Error('metronome.getPosition: no user address');
    return this.http.get<UserPosition>(`${API_ENDPOINTS.POSITION}/${addr}`);
  }

  /* ────────── Prepare-* (write path) ────────── */

  prepareDeposit(req: PrepareDepositRequest): Promise<PrepareResponse> {
    return this.http.post<PrepareResponse>(API_ENDPOINTS.PREPARE_DEPOSIT, req);
  }

  prepareWithdraw(req: PrepareWithdrawRequest): Promise<PrepareResponse> {
    return this.http.post<PrepareResponse>(API_ENDPOINTS.PREPARE_WITHDRAW, req);
  }

  prepareMint(req: PrepareMintRequest): Promise<PrepareResponse> {
    return this.http.post<PrepareResponse>(API_ENDPOINTS.PREPARE_MINT, req);
  }

  prepareRepay(req: PrepareRepayRequest): Promise<PrepareResponse> {
    return this.http.post<PrepareResponse>(API_ENDPOINTS.PREPARE_REPAY, req);
  }

  prepareUnwind(req: PrepareUnwindRequest): Promise<PrepareResponse> {
    return this.http.post<PrepareResponse>(API_ENDPOINTS.PREPARE_UNWIND, req);
  }
}

/**
 * React hook: returns a memoized MetronomeApiClient bound to the active wallet.
 *
 * The client is stable per userAddress — safe to reference in useEffect
 * dependency arrays and to pass into useDefiData's fetcher.
 */
export function useMetronomeApi(): MetronomeApiClient {
  const account = useActiveAccount();
  const userAddress = account?.address ?? null;
  return useMemo(() => new MetronomeApiClient(userAddress), [userAddress]);
}

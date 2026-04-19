import type { YieldAction } from '@/features/yield/types';
import { normalizePoolId, normalizeYieldAction } from '@/features/yield/normalizers';
import { normalizeAvaxLpAction, normalizeAvaxLpPoolId } from '@/features/avax-lp/normalizers';
import type { AvaxLpAction } from '@/features/avax-lp/types';

export type LendingMode = 'supply' | 'borrow';
export type LendingFlow = 'open' | 'close';
export type StakingMode = 'stake' | 'unstake';
export type OpenWidgetTarget = 'lending' | 'staking' | 'yield' | 'avax-lp';
export type OpenWidgetNetwork = 'avalanche' | 'ethereum' | 'base';

export type OpenWidgetPlan =
  | {
      target: 'lending';
      network: 'avalanche';
      metadata: Record<string, unknown> | null;
    }
  | {
      target: 'staking';
      network: 'ethereum';
      metadata: Record<string, unknown> | null;
    }
  | {
      target: 'yield';
      network: 'base';
      metadata: Record<string, unknown> | null;
    }
  | {
      target: 'avax-lp';
      network: 'avalanche';
      metadata: Record<string, unknown> | null;
    };

export function parseLendingMode(value: unknown): LendingMode | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'supply' || normalized === 'borrow') return normalized;
  return undefined;
}

export function parseLendingFlow(value: unknown): LendingFlow | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'open' || normalized === 'close') return normalized;
  return undefined;
}

export function parseStakingMode(value: unknown): StakingMode | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'stake' || normalized === 'unstake') return normalized;
  return undefined;
}

export function deriveLendingModeFromAction(action: unknown): LendingMode | undefined {
  if (typeof action !== 'string') return undefined;
  const normalized = action.trim().toLowerCase();
  if (normalized === 'supply' || normalized === 'withdraw') return 'supply';
  if (normalized === 'borrow' || normalized === 'repay') return 'borrow';
  return undefined;
}

export function deriveLendingFlowFromAction(action: unknown): LendingFlow | undefined {
  if (typeof action !== 'string') return undefined;
  const normalized = action.trim().toLowerCase();
  if (normalized === 'supply' || normalized === 'borrow') return 'open';
  if (normalized === 'withdraw' || normalized === 'repay') return 'close';
  return undefined;
}

export function resolveOpenWidgetTarget(openParamRaw: string | null): OpenWidgetTarget | null {
  if (typeof openParamRaw !== 'string') return null;
  const normalized = openParamRaw.trim().toLowerCase();
  if (normalized === 'lending' || normalized === 'staking' || normalized === 'yield' || normalized === 'avax-lp') return normalized as OpenWidgetTarget;
  return null;
}

export function buildOpenWidgetPlan(searchParams: URLSearchParams): OpenWidgetPlan | null {
  const target = resolveOpenWidgetTarget(searchParams.get('open'));
  if (!target) return null;

  if (target === 'lending') {
    return {
      target,
      network: 'avalanche',
      metadata: parseLendingQueryMetadata(searchParams),
    };
  }

  if (target === 'yield') {
    return {
      target,
      network: 'base',
      metadata: parseYieldQueryMetadata(searchParams),
    };
  }

  if (target === 'avax-lp') {
    return {
      target,
      network: 'avalanche',
      metadata: parseAvaxLpQueryMetadata(searchParams),
    };
  }

  return {
    target,
    network: 'ethereum',
    metadata: parseStakingQueryMetadata(searchParams),
  };
}

export function buildOpenWidgetQueryKey(target: OpenWidgetTarget, searchParams: URLSearchParams): string {
  return `${target}:${searchParams.toString()}`;
}

export function parseLendingQueryMetadata(searchParams: URLSearchParams): Record<string, unknown> | null {
  const amount = searchParams.get('amount');
  const asset = searchParams.get('asset');
  const mode = parseLendingMode(searchParams.get('mode'));
  const flow = parseLendingFlow(searchParams.get('flow'));

  const metadata: Record<string, unknown> = {};
  if (amount) metadata.amount = amount;
  if (asset) metadata.asset = asset;
  if (mode) metadata.mode = mode;
  if (flow) metadata.flow = flow;
  return Object.keys(metadata).length > 0 ? metadata : null;
}

export function parseStakingQueryMetadata(searchParams: URLSearchParams): Record<string, unknown> | null {
  const amount = searchParams.get('amount');
  const mode = parseStakingMode(searchParams.get('mode'));

  const metadata: Record<string, unknown> = {};
  if (amount) metadata.amount = amount;
  if (mode) metadata.mode = mode;
  return Object.keys(metadata).length > 0 ? metadata : null;
}

export function parseYieldAction(value: unknown): YieldAction | undefined {
  return normalizeYieldAction(value);
}

export function parseYieldPoolId(value: unknown): string | undefined {
  return normalizePoolId(value);
}

export function parseYieldQueryMetadata(searchParams: URLSearchParams): Record<string, unknown> | null {
  const amount = searchParams.get('amount');
  const action = parseYieldAction(searchParams.get('action'));
  const poolId = parseYieldPoolId(searchParams.get('pool_id'));

  const metadata: Record<string, unknown> = {};
  if (amount) metadata.amount = amount;
  if (action) metadata.action = action;
  if (poolId) metadata.pool_id = poolId;
  return Object.keys(metadata).length > 0 ? metadata : null;
}

export function parseAvaxLpAction(value: unknown): AvaxLpAction | undefined {
  return normalizeAvaxLpAction(value);
}

export function parseAvaxLpPoolId(value: unknown): number | undefined {
  return normalizeAvaxLpPoolId(value);
}

export function parseAvaxLpQueryMetadata(searchParams: URLSearchParams): Record<string, unknown> | null {
  const amount = searchParams.get('amount');
  const action = parseAvaxLpAction(searchParams.get('action'));
  const poolId = parseAvaxLpPoolId(searchParams.get('pool_id'));

  const metadata: Record<string, unknown> = {};
  if (amount) metadata.amount = amount;
  if (action) metadata.action = action;
  if (poolId !== undefined) metadata.pool_id = poolId;
  return Object.keys(metadata).length > 0 ? metadata : null;
}

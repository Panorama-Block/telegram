import type { AvaxLpAction } from './types';

const ACTION_ALIASES: Record<string, AvaxLpAction> = {
  add: 'add',
  add_liquidity: 'add',
  enter: 'add',
  provide: 'add',

  remove: 'remove',
  remove_liquidity: 'remove',
  exit: 'remove',
  withdraw: 'remove',

  stake: 'stake',
  deposit: 'stake',

  unstake: 'unstake',
  undeposit: 'unstake',

  claim: 'claim',
  claim_rewards: 'claim',
  harvest: 'claim',
};

export function normalizeAvaxLpAction(value: unknown): AvaxLpAction | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  return ACTION_ALIASES[normalized];
}

export function normalizeAvaxLpPoolId(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = parseInt(trimmed, 10);
    if (Number.isFinite(parsed) && parsed >= 0 && String(parsed) === trimmed) return parsed;
  }
  return undefined;
}

export function normalizeAvaxLpIntentMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!metadata) return null;

  const normalized: Record<string, unknown> = { ...metadata };

  const normalizedAction = normalizeAvaxLpAction(metadata.action);
  if (normalizedAction) {
    normalized.action = normalizedAction;
  }

  const rawPoolId = metadata.pool_id ?? metadata.poolId;
  const normalizedPoolId = normalizeAvaxLpPoolId(rawPoolId);
  if (normalizedPoolId !== undefined) {
    normalized.pool_id = normalizedPoolId;
    normalized.poolId = normalizedPoolId;
  } else if (rawPoolId !== undefined) {
    delete normalized.pool_id;
    delete normalized.poolId;
  }

  return normalized;
}

import type { YieldAction, YieldPool } from './types';

type PoolLike = Pick<YieldPool, 'id' | 'stable' | 'tokenA' | 'tokenB'>;

const ACTION_ALIASES: Record<string, YieldAction> = {
  enter: 'enter',
  add_liquidity: 'enter',
  add: 'enter',
  stake: 'enter',

  exit: 'exit',
  remove_liquidity: 'exit',
  remove: 'exit',
  unstake: 'exit',

  claim: 'claim',
  claim_rewards: 'claim',
  claim_reward: 'claim',
};

const POOL_ALIAS_TO_CANONICAL: Record<string, string> = {
  'WETH-USDC': 'weth-usdc-volatile',
  'WETH/USDC': 'weth-usdc-volatile',
  'WETH-USDC-VOLATILE': 'weth-usdc-volatile',

  'WETH-AERO': 'weth-aero-volatile',
  'WETH/AERO': 'weth-aero-volatile',
  'WETH-AERO-VOLATILE': 'weth-aero-volatile',

  'USDC-USDBC': 'usdc-usdbc-stable',
  'USDC/USDBC': 'usdc-usdbc-stable',
  'USDC-USDBC-STABLE': 'usdc-usdbc-stable',
};

const YIELD_ACTION_LABELS: Record<YieldAction, string> = {
  enter: 'Enter',
  exit: 'Exit',
  claim: 'Claim',
};

function normalizeTokenPairKey(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[_\s]+/g, '-')
    .replace(/\//g, '-')
    .replace(/-+/g, '-');
}

function extractPairSymbols(input: string): { tokenA: string; tokenB: string; stableHint: boolean | null } | null {
  const normalized = normalizeTokenPairKey(input);
  const stableHint = normalized.includes('STABLE')
    ? true
    : normalized.includes('VOLATILE')
      ? false
      : null;

  const cleaned = normalized
    .replace(/-STABLE/g, '')
    .replace(/-VOLATILE/g, '');
  const parts = cleaned.split('-').filter(Boolean);
  if (parts.length < 2) return null;

  return { tokenA: parts[0], tokenB: parts[1], stableHint };
}

function findPoolByPair(tokens: { tokenA: string; tokenB: string; stableHint: boolean | null }, pools: PoolLike[]): PoolLike | null {
  const candidates = pools.filter((pool) => {
    const a = pool.tokenA.symbol.toUpperCase();
    const b = pool.tokenB.symbol.toUpperCase();
    const samePair =
      (a === tokens.tokenA && b === tokens.tokenB)
      || (a === tokens.tokenB && b === tokens.tokenA);
    if (!samePair) return false;

    if (tokens.stableHint == null) return true;
    return pool.stable === tokens.stableHint;
  });

  if (candidates.length === 0) return null;

  // Prefer volatile pool when no explicit hint is provided.
  if (tokens.stableHint == null) {
    const volatile = candidates.find((pool) => !pool.stable);
    if (volatile) return volatile;
  }

  return candidates[0] ?? null;
}

export function normalizeYieldAction(value: unknown): YieldAction | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  return ACTION_ALIASES[normalized];
}

export function formatYieldActionLabel(action: YieldAction): string {
  return YIELD_ACTION_LABELS[action];
}

export function normalizePoolId(value: unknown, pools: PoolLike[] = []): string | undefined {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim();
  if (!raw) return undefined;

  const lower = raw.toLowerCase();

  const directPool = pools.find((pool) => pool.id.toLowerCase() === lower);
  if (directPool) return directPool.id;

  if (/-stable$/.test(lower) || /-volatile$/.test(lower)) {
    return lower;
  }

  const aliasKey = normalizeTokenPairKey(raw);
  const canonicalByAlias = POOL_ALIAS_TO_CANONICAL[aliasKey];
  if (canonicalByAlias) return canonicalByAlias;

  const tokens = extractPairSymbols(raw);
  if (tokens && pools.length > 0) {
    const resolved = findPoolByPair(tokens, pools);
    if (resolved) return resolved.id;
  }

  return lower;
}

export function normalizeYieldIntentMetadata(
  metadata: Record<string, unknown> | null | undefined,
  pools: PoolLike[] = [],
): Record<string, unknown> | null {
  if (!metadata) return null;

  const normalized: Record<string, unknown> = { ...metadata };

  const normalizedAction = normalizeYieldAction(metadata.action);
  if (normalizedAction) {
    normalized.action = normalizedAction;
  }

  const normalizedPoolId = normalizePoolId(metadata.pool_id ?? metadata.poolId, pools);
  if (normalizedPoolId) {
    normalized.pool_id = normalizedPoolId;
    normalized.poolId = normalizedPoolId;
  }

  return normalized;
}

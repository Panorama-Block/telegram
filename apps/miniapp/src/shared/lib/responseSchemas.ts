/**
 * Zod schemas for critical API response types.
 * Used to validate backend responses at runtime before passing to React state.
 *
 * Usage in API clients:
 *   const data = await res.json();
 *   const parsed = QuoteResponseSchema.safeParse(data);
 *   if (!parsed.success) { console.warn('Invalid quote response', parsed.error); }
 */
import { z } from 'zod';

// ── Shared Primitives ──────────────────────────────────────────────

const TokenInfoSchema = z.object({
  symbol: z.string(),
  address: z.string(),
  decimals: z.number(),
});

const PreparedTransactionSchema = z.object({
  to: z.string(),
  data: z.string(),
  value: z.string(),
  chainId: z.number(),
  description: z.string().optional(),
});

const TransactionBundleSchema = z.object({
  steps: z.array(PreparedTransactionSchema),
  totalSteps: z.number(),
  summary: z.string(),
});

// ── Error Response ─────────────────────────────────────────────────

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

// ── Swap ───────────────────────────────────────────────────────────

export const QuoteResponseSchema = z.object({
  success: z.boolean(),
  quote: z.object({
    fromChainId: z.number(),
    toChainId: z.number(),
    fromToken: z.string(),
    toToken: z.string(),
    amount: z.string(),
    estimatedReceiveAmount: z.string(),
    estimatedDuration: z.number().optional(),
    exchangeRate: z.string().optional(),
    fees: z.object({
      bridgeFee: z.string().optional(),
      gasFee: z.string().optional(),
      totalFee: z.string().optional(),
      totalFeeUsd: z.string().optional(),
    }).optional(),
    provider: z.string().optional(),
  }).optional(),
  message: z.string().optional(),
});

export const PrepareResponseSchema = z.object({
  prepared: z.object({
    transactions: z.array(z.object({
      to: z.string(),
      data: z.string(),
      value: z.union([z.string(), z.number(), z.null()]).optional(),
      chainId: z.number(),
      gasLimit: z.union([z.string(), z.number(), z.null()]).optional(),
    })).optional(),
    steps: z.array(z.object({
      name: z.string().optional(),
      chainId: z.number(),
      transactions: z.array(z.object({
        to: z.string(),
        data: z.string(),
        value: z.union([z.string(), z.number(), z.null()]).optional(),
        chainId: z.number(),
      })),
    })).optional(),
    metadata: z.record(z.unknown()).optional(),
  }).optional(),
  provider: z.string().optional(),
  message: z.string().optional(),
});

export const StatusResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    status: z.string(),
    transactionHash: z.string(),
    chainId: z.number(),
    userAddress: z.string().optional(),
  }).optional(),
});

// ── Yield / Staking ────────────────────────────────────────────────

export const YieldPoolSchema = z.object({
  id: z.string(),
  name: z.string(),
  tokenA: TokenInfoSchema,
  tokenB: TokenInfoSchema,
  stable: z.boolean(),
  poolAddress: z.string(),
  gaugeAddress: z.string(),
  gaugeAlive: z.boolean(),
  rewardToken: TokenInfoSchema,
  totalStaked: z.string(),
  rewardRate: z.string(),
});

export const PoolProtocolInfoSchema = z.object({
  poolId: z.string(),
  poolName: z.string(),
  poolAddress: z.string(),
  gaugeAddress: z.string(),
  stable: z.boolean(),
  rewardRatePerSecond: z.string(),
  totalStaked: z.string(),
  estimatedAPR: z.string(),
  totalLiquidityUsd: z.string().nullable().optional(),
});

export const UserPositionSchema = z.object({
  poolId: z.string(),
  poolName: z.string(),
  poolAddress: z.string(),
  gaugeAddress: z.string(),
  tokenA: TokenInfoSchema,
  tokenB: TokenInfoSchema,
  stable: z.boolean(),
  stakedBalance: z.string(),
  walletLpBalance: z.string(),
  earnedRewards: z.string(),
  rewardToken: TokenInfoSchema,
});

export const PortfolioSchema = z.object({
  userAddress: z.string(),
  totalPositions: z.number(),
  assets: z.array(z.object({
    poolId: z.string(),
    poolName: z.string(),
    tokenA: TokenInfoSchema.extend({ balance: z.string() }),
    tokenB: TokenInfoSchema.extend({ balance: z.string() }),
    lpStaked: z.string(),
    pendingRewards: z.string(),
    rewardTokenSymbol: z.string(),
  })),
  walletBalances: z.record(z.string()),
});

export const YieldPrepareResponseSchema = z.object({
  bundle: TransactionBundleSchema,
  metadata: z.record(z.unknown()),
});

// ── Lending ────────────────────────────────────────────────────────

export const LendingTokenSchema = z.object({
  symbol: z.string(),
  address: z.string(),
  qTokenAddress: z.string(),
  decimals: z.number(),
  supplyAPY: z.string(),
  borrowAPY: z.string(),
  collateralFactor: z.string(),
  availableLiquidity: z.string(),
  icon: z.string().optional(),
});

export const LendingPositionSchema = z.object({
  supplied: z.array(z.object({
    symbol: z.string(),
    qTokenAddress: z.string(),
    underlyingBalance: z.string(),
    qTokenBalance: z.string(),
  })),
  borrowed: z.array(z.object({
    symbol: z.string(),
    qTokenAddress: z.string(),
    borrowBalance: z.string(),
  })),
  healthFactor: z.string().nullable(),
});

// ── Validation Helper ──────────────────────────────────────────────

/**
 * Validates a response against a Zod schema.
 * On failure, logs a warning and returns the raw data (graceful degradation).
 *
 * @param schema  Zod schema to validate against
 * @param data    Raw response data
 * @param label   Label for the warning log (e.g. "QuoteResponse")
 * @returns       Parsed data (typed) or raw data on validation failure
 */
export function validateResponse<T>(
  schema: z.ZodType<T>,
  data: unknown,
  label: string,
): { data: T; valid: boolean } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { data: result.data, valid: true };
  }

  console.warn(
    `[validateResponse] ${label} schema mismatch:`,
    result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', '),
  );
  return { data: data as T, valid: false };
}

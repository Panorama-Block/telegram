/**
 * Liquidity Provision Feature - Main Export
 *
 * This is the main entry point for the liquidity provision feature.
 * Import everything you need from this single file.
 */

// Types
export type {
  LiquidityToken,
  PriceRange,
  LiquidityQuoteRequest,
  LiquidityQuoteResponse,
  LiquidityPrepareRequest,
  LiquidityPreparedTx,
  LiquidityPrepareResponse,
  LiquidityPositionStatus,
  FeeTier,
} from './types';

export { FEE_TIERS } from './types';

// Mock API
export {
  getLiquidityQuote,
  prepareLiquidityTransaction,
  getLiquidityPositionStatus,
  generateMockTxHash,
} from './mockApi';

// Hook
export { useLiquidityFlow } from './useLiquidityFlow';

// Re-export components for convenience
export { LiquidityPreviewCard } from '@/components/ui/LiquidityPreviewCard';
export { LiquiditySuccessCard } from '@/components/ui/LiquiditySuccessCard';

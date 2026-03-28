/**
 * Demo mode configuration for deterministic UI output.
 * Aligns with backend config/demo.ts canonical flow.
 */

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

/** Default token pair for demo swap flow (Base chain) */
export const DEMO_SWAP_DEFAULTS = {
  fromToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
  toToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',   // USDC on Base
  amount: '0.001',
  chainId: 8453,
} as const;

/** Default pool for demo staking flow */
export const DEMO_STAKING_DEFAULTS = {
  poolId: 'vAMM-WETH/USDC',
  amountA: '0.001',
  amountB: '2.0',
  slippageBps: 200, // 2% for demo stability
} as const;

/** Wider timeouts for demo environments (free RPCs are slower) */
export const DEMO_TIMEOUTS = {
  apiRequestMs: 20_000,
  walletConfirmMs: 90_000,
} as const;

/**
 * Check if app is running in demo mode.
 * UI should use this to show demo-safe defaults and controlled error messages.
 */
export function isDemoMode(): boolean {
  return DEMO_MODE;
}

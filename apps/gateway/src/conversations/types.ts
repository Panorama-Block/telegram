import type { Conversation } from '@grammyjs/conversations';
import type { BotContext } from '../bot/context.js';

/**
 * Shorthand types for conversation builders.
 * OC = outside context (BotContext), C = inside context (Context from grammy).
 */
export type BotConversation = Conversation<BotContext>;

/** Common token list for swap/DCA selection. */
export const POPULAR_TOKENS = [
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'USDC', name: 'USD Coin' },
  { symbol: 'USDT', name: 'Tether' },
  { symbol: 'DAI', name: 'Dai' },
  { symbol: 'WETH', name: 'Wrapped ETH' },
  { symbol: 'cbETH', name: 'Coinbase ETH' },
  { symbol: 'AERO', name: 'Aerodrome' },
] as const;

/** Common chain options. */
export const CHAINS = [
  { id: 8453, name: 'Base', symbol: 'ETH' },
  { id: 1, name: 'Ethereum', symbol: 'ETH' },
  { id: 42161, name: 'Arbitrum', symbol: 'ETH' },
  { id: 43114, name: 'Avalanche', symbol: 'AVAX' },
] as const;

/** Max wait time for a single step (2 minutes). */
export const STEP_TIMEOUT_MS = 2 * 60 * 1000;

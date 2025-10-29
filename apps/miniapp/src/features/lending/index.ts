/*
 * Lending Service Module
 * 
 * This module provides a complete interface for DeFi lending operations
 * including token management, position tracking, and transaction execution.
 * 
 * @example
 * ```typescript
 * import { useLendingApi, LendingToken } from './features/lending';
 * 
 * function MyComponent() {
 *   const lendingApi = useLendingApi();
 *   const [tokens, setTokens] = useState<LendingToken[]>([]);
 *   
 *   useEffect(() => {
 *     lendingApi.getTokens().then(setTokens);
 *   }, []);
 *   
 *   return <div>{ Your UI }</div>;
 * }
 */

// Main API client and hook
export { default as LendingApiClient, useLendingApi } from './api';

// Type definitions
export * from './types';

// Configuration constants
export { VALIDATION_FEE, LENDING_CONFIG, API_ENDPOINTS } from './config';

// Re-export commonly used types for convenience
export type {
  LendingToken,
  LendingPosition,
  LendingAction,
  ValidationResponse,
  SwapResponse,
  TransactionData,
  AuthData,
  CacheStatus,
  LendingConfig,
  LendingError,
  LendingActionType,
  LendingStatus,
  LendingTransaction,
  LendingQuote,
  LendingStats
} from './types';

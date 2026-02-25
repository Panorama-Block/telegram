/**
 * Unified transaction data type shared between lending and staking features.
 * Represents unsigned transaction data returned by backends for client-side signing.
 */
export interface TransactionData {
  /** Contract address to call */
  to: string;

  /** Encoded function call data */
  data: string;

  /** Transaction value in wei */
  value: string;

  /** Gas limit */
  gasLimit: string;

  /** Gas price in wei (optional, let wallet estimate if omitted) */
  gasPrice?: string;

  /** Target chain ID (e.g. 43114 for Avalanche, 1 for Ethereum) */
  chainId: number;
}

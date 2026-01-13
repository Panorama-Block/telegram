/**
 * DCA Service API Client
 * Integrates with panorama-block-backend DCA service
 * Uses Next.js API route as proxy to avoid CORS issues
 */

import { authenticatedFetch } from '@/shared/lib/telegram-auth';

const gatewayBase =
  (process.env.NEXT_PUBLIC_GATEWAY_BASE || process.env.VITE_GATEWAY_BASE || '').replace(/\/+$/, '');

// Use gateway as única porta pública
export const DCA_API_URL = gatewayBase
  ? `${gatewayBase}/api/dca`
  : 'http://localhost:8443/api/dca';

export interface SmartAccountPermissions {
  approvedTargets: string[];
  nativeTokenLimitPerTransaction: string;
  startTimestamp: number;
  endTimestamp: number;
}

export interface SmartAccount {
  address: string;
  userId: string;
  name: string;
  createdAt: number;
  sessionKeyAddress: string;
  expiresAt: number;
  permissions: SmartAccountPermissions;
}

export interface CreateAccountRequest {
  userId: string;
  name: string;
  permissions: {
    approvedTargets: string[];
    nativeTokenLimit: string;
    durationDays: number;
  };
}

export interface CreateAccountResponse {
  smartAccountAddress: string;
  sessionKeyAddress: string;
  expiresAt: Date;
}

export interface DCAStrategy {
  strategyId?: string; // Optional for backwards compatibility
  smartAccountId: string;
  fromToken: string;
  toToken: string;
  fromChainId: number;
  toChainId: number;
  amount: string;
  interval: 'daily' | 'weekly' | 'monthly';
  lastExecuted: number;
  nextExecution: number;
  isActive: boolean;
}

export interface CreateStrategyRequest {
  smartAccountId: string;
  fromToken: string;
  toToken: string;
  fromChainId: number;
  toChainId: number;
  amount: string;
  interval: 'daily' | 'weekly' | 'monthly';
}

export interface ExecutionHistory {
  timestamp: number;
  txHash: string;
  amount: string;
  fromToken: string;
  toToken: string;
  status: 'success' | 'failed';
  error?: string;
}

export class DCAApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'DCAApiError';
  }
}

/**
 * Create a new smart account
 * 🔒 SECURE: Uses Telegram authentication
 */
export async function createSmartAccount(request: CreateAccountRequest): Promise<CreateAccountResponse> {
  try {
    const response = await authenticatedFetch(`${DCA_API_URL}/create-account`, {
      method: 'POST',
      body: JSON.stringify(request),
    }, request.userId);

    if (!response.ok) {
      const error = await response.json();
      throw new DCAApiError(error.error || 'Failed to create smart account', response.status);
    }

    const data = await response.json();
    return {
      ...data,
      expiresAt: new Date(data.expiresAt)
    };
  } catch (error: any) {
    if (error instanceof DCAApiError) {
      throw error;
    }
    throw new DCAApiError(error.message || 'Network error');
  }
}

/**
 * Get all smart accounts for a user
 * 🔒 SECURE: Uses Telegram authentication
 */
export async function getUserAccounts(userId: string): Promise<SmartAccount[]> {
  try {
    const response = await authenticatedFetch(`${DCA_API_URL}/accounts/${userId}`, {}, userId);

    if (!response.ok) {
      const error = await response.json();
      throw new DCAApiError(error.error || 'Failed to fetch accounts', response.status);
    }

    const data = await response.json();
    return data.accounts;
  } catch (error: any) {
    if (error instanceof DCAApiError) {
      throw error;
    }
    throw new DCAApiError(error.message || 'Network error');
  }
}

/**
 * Get a single smart account
 * 🔒 SECURE: Uses Telegram authentication
 */
export async function getSmartAccount(address: string, userId?: string): Promise<SmartAccount> {
  try {
    const response = await authenticatedFetch(`${DCA_API_URL}/account/${address}`, {}, userId);

    if (!response.ok) {
      const error = await response.json();
      throw new DCAApiError(error.error || 'Failed to fetch account', response.status);
    }

    return await response.json();
  } catch (error: any) {
    if (error instanceof DCAApiError) {
      throw error;
    }
    throw new DCAApiError(error.message || 'Network error');
  }
}

/**
 * Delete a smart account
 * 🔒 SECURE: Uses Telegram authentication
 */
export async function deleteSmartAccount(address: string, userId: string): Promise<void> {
  try {
    const response = await authenticatedFetch(`${DCA_API_URL}/account/${address}`, {
      method: 'DELETE',
      body: JSON.stringify({ userId }),
    }, userId);

    if (!response.ok) {
      const error = await response.json();
      throw new DCAApiError(error.error || 'Failed to delete account', response.status);
    }
  } catch (error: any) {
    if (error instanceof DCAApiError) {
      throw error;
    }
    throw new DCAApiError(error.message || 'Network error');
  }
}

/**
 * Create a DCA strategy
 * 🔒 SECURE: Uses Telegram authentication
 */
export async function createStrategy(request: CreateStrategyRequest, userId?: string): Promise<{ strategyId: string; nextExecution: Date }> {
  try {
    const response = await authenticatedFetch(`${DCA_API_URL}/create-strategy`, {
      method: 'POST',
      body: JSON.stringify(request),
    }, userId);

    if (!response.ok) {
      const error = await response.json();
      throw new DCAApiError(error.error || 'Failed to create strategy', response.status);
    }

    const data = await response.json();
    return {
      ...data,
      nextExecution: new Date(data.nextExecution)
    };
  } catch (error: any) {
    if (error instanceof DCAApiError) {
      throw error;
    }
    throw new DCAApiError(error.message || 'Network error');
  }
}

/**
 * Get all strategies for a smart account
 * 🔒 SECURE: Uses Telegram authentication
 */
export async function getAccountStrategies(smartAccountId: string, userId?: string): Promise<DCAStrategy[]> {
  try {
    const response = await authenticatedFetch(`${DCA_API_URL}/strategies/${smartAccountId}`, {}, userId);

    if (!response.ok) {
      const error = await response.json();
      throw new DCAApiError(error.error || 'Failed to fetch strategies', response.status);
    }

    const data = await response.json();
    return data.strategies;
  } catch (error: any) {
    if (error instanceof DCAApiError) {
      throw error;
    }
    throw new DCAApiError(error.message || 'Network error');
  }
}

/**
 * Toggle strategy active status
 * 🔒 SECURE: Uses Telegram authentication
 */
export async function toggleStrategy(strategyId: string, isActive: boolean, userId?: string): Promise<void> {
  try {
    const response = await authenticatedFetch(`${DCA_API_URL}/strategy/${strategyId}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }, userId);

    if (!response.ok) {
      const error = await response.json();
      throw new DCAApiError(error.error || 'Failed to toggle strategy', response.status);
    }
  } catch (error: any) {
    if (error instanceof DCAApiError) {
      throw error;
    }
    throw new DCAApiError(error.message || 'Network error');
  }
}

/**
 * Delete a strategy
 * 🔒 SECURE: Uses Telegram authentication
 */
export async function deleteStrategy(strategyId: string, userId?: string): Promise<void> {
  try {
    const response = await authenticatedFetch(`${DCA_API_URL}/strategy/${strategyId}`, {
      method: 'DELETE',
    }, userId);

    if (!response.ok) {
      const error = await response.json();
      throw new DCAApiError(error.error || 'Failed to delete strategy', response.status);
    }
  } catch (error: any) {
    if (error instanceof DCAApiError) {
      throw error;
    }
    throw new DCAApiError(error.message || 'Network error');
  }
}

/**
 * Get execution history for a smart account
 * 🔒 SECURE: Uses Telegram authentication
 */
export async function getExecutionHistory(smartAccountId: string, limit = 100, userId?: string): Promise<ExecutionHistory[]> {
  try {
    const response = await authenticatedFetch(`${DCA_API_URL}/history/${smartAccountId}?limit=${limit}`, {}, userId);

    if (!response.ok) {
      const error = await response.json();
      throw new DCAApiError(error.error || 'Failed to fetch history', response.status);
    }

    const data = await response.json();
    return data.history;
  } catch (error: any) {
    if (error instanceof DCAApiError) {
      throw error;
    }
    throw new DCAApiError(error.message || 'Network error');
  }
}

/**
 * Sign and execute a transaction using backend session key
 * SECURITY: Private key never leaves backend!
 */
export interface SignAndExecuteRequest {
  smartAccountAddress: string;
  userId: string;
  to: string;
  value: string; // Amount in ETH
  chainId: number;
  data?: string;
}

export interface SignAndExecuteResponse {
  transactionHash: string;
  success: boolean;
  error?: string;
}

export async function signAndExecuteTransaction(
  request: SignAndExecuteRequest
): Promise<SignAndExecuteResponse> {
  try {
    const response = await authenticatedFetch(`${DCA_API_URL}/transaction/sign-and-execute`, {
      method: 'POST',
      body: JSON.stringify(request),
    }, request.userId);

    if (!response.ok) {
      const error = await response.json();
      throw new DCAApiError(error.error || 'Failed to sign transaction', response.status);
    }

    return await response.json();
  } catch (error: any) {
    if (error instanceof DCAApiError) {
      throw error;
    }
    throw new DCAApiError(error.message || 'Network error');
  }
}

/**
 * Validate if a transaction would be allowed by session key permissions
 */
export async function validateTransactionPermissions(
  smartAccountAddress: string,
  to: string,
  value: string,
  userId?: string
): Promise<{ valid: boolean; reason?: string }> {
  try {
    const response = await authenticatedFetch(`${DCA_API_URL}/transaction/validate`, {
      method: 'POST',
      body: JSON.stringify({ smartAccountAddress, to, value }),
    }, userId);

    if (!response.ok) {
      const error = await response.json();
      throw new DCAApiError(error.error || 'Failed to validate transaction', response.status);
    }

    return await response.json();
  } catch (error: any) {
    if (error instanceof DCAApiError) {
      throw error;
    }
    throw new DCAApiError(error.message || 'Network error');
  }
}

/**
 * Withdraw funds from smart account to main wallet
 * Uses backend signing for security
 */
export interface WithdrawRequest {
  smartAccountAddress: string;
  userId: string; // Your main wallet address
  amount: string; // Amount in ETH to withdraw
  chainId: number;
}

export async function withdrawFromSmartAccount(
  request: WithdrawRequest
): Promise<SignAndExecuteResponse> {
  try {
    // Withdraw = send ETH from smart account back to main wallet (userId)
    const result = await signAndExecuteTransaction({
      smartAccountAddress: request.smartAccountAddress,
      userId: request.userId,
      to: request.userId, // Send back to main wallet
      value: request.amount,
      chainId: request.chainId,
    });

    return result;
  } catch (error: any) {
    if (error instanceof DCAApiError) {
      throw error;
    }
    throw new DCAApiError(error.message || 'Failed to withdraw funds');
  }
}

/**
 * Check session key ETH balance
 * Returns balance in ETH (not Wei)
 */
export async function getSessionKeyBalance(
  sessionKeyAddress: string,
  chainId: number
): Promise<string> {
  try {
    // Import Thirdweb functions dynamically to avoid SSR issues
    const { createThirdwebClient, defineChain, getRpcClient, eth_getBalance } = await import('thirdweb');
    const { THIRDWEB_CLIENT_ID } = await import('@/shared/config/thirdweb');

    const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID || '' });
    const chain = defineChain(chainId);
    const rpcRequest = getRpcClient({ client, chain });

    // Get balance in Wei
    const balanceWei = await eth_getBalance(rpcRequest, {
      address: sessionKeyAddress as `0x${string}`,
    });

    // Convert Wei to ETH
    const balanceEth = Number(balanceWei) / 1e18;

    return balanceEth.toFixed(6);
  } catch (error: any) {
    console.error('Error fetching session key balance:', error);
    throw new DCAApiError(error.message || 'Failed to fetch session key balance');
  }
}

/**
 * Withdraw ERC20 token from smart account
 */
export interface WithdrawTokenRequest {
  smartAccountAddress: string;
  userId: string;
  tokenAddress: string;
  amount: string;
  decimals?: number;
  chainId: number;
}

export async function withdrawTokenFromSmartAccount(
  request: WithdrawTokenRequest
): Promise<SignAndExecuteResponse> {
  try {
    console.log('[withdrawTokenFromSmartAccount] Sending request:', request);

    const response = await authenticatedFetch(`${DCA_API_URL}/transaction/withdraw-token`, {
      method: 'POST',
      body: JSON.stringify(request),
    }, request.userId);

    console.log('[withdrawTokenFromSmartAccount] Response status:', response.status);

    if (!response.ok) {
      let errorMessage = 'Failed to withdraw token';
      try {
        const error = await response.json();
        errorMessage = error.error || error.message || errorMessage;
      } catch (parseError) {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new DCAApiError(errorMessage, response.status);
    }

    const data = await response.json();
    console.log('[withdrawTokenFromSmartAccount] Success:', data);
    return data;
  } catch (error: any) {
    console.error('[withdrawTokenFromSmartAccount] Error:', error);
    if (error instanceof DCAApiError) {
      throw error;
    }
    const errorMessage = error?.message || error?.toString() || 'Failed to withdraw token';
    throw new DCAApiError(errorMessage);
  }
}

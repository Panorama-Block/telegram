import { parseEnv } from '../env.js';

export interface SmartAccountInfo {
  address: string;
  sessionKeyAddress: string;
  userId: string;
  name: string;
  createdAt: number;
  expiresAt: number;
}

export interface CreateAccountResult {
  smartAccountAddress: string;
  sessionKeyAddress: string;
  expiresAt: number;
}

export interface TransactionResult {
  transactionHash: string;
  success: boolean;
}

/**
 * Client for dca-service smart account and transaction endpoints.
 * Used for creating smart accounts and executing transactions via session keys.
 */
export class DcaClient {
  private readonly baseUrl: string;
  private readonly timeoutMs = 30000;

  constructor() {
    const env = parseEnv();
    this.baseUrl = env.DCA_API_BASE;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          ...options.headers,
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`DCA service error ${res.status}: ${text}`);
      }

      return await res.json() as T;
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error(`DCA request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async createSmartAccount(
    userId: string,
    name: string,
    telegramInitData?: string,
  ): Promise<CreateAccountResult> {
    const headers: Record<string, string> = {};
    if (telegramInitData) {
      headers['x-telegram-init-data'] = telegramInitData;
    } else {
      // Dev bypass
      headers['x-dev-user-id'] = userId;
    }

    return this.request<CreateAccountResult>('/dca/create-account', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId,
        name,
        permissions: {
          approvedTargets: ['*'],
          nativeTokenLimit: '0.5',
          durationDays: 365,
        },
      }),
    });
  }

  async getAccounts(userId: string): Promise<SmartAccountInfo[]> {
    return this.request<SmartAccountInfo[]>(`/dca/accounts/${encodeURIComponent(userId)}`, {
      headers: { 'x-dev-user-id': userId },
    });
  }

  async getAccountBalance(address: string): Promise<{ balance: string; balanceUsd: string }> {
    try {
      const result = await this.request<{ balance: string; balanceUsd: string }>(
        `/dca/account/${encodeURIComponent(address)}/balance`,
      );
      return result;
    } catch {
      // Fallback: if endpoint doesn't exist, return zeros
      return { balance: '0', balanceUsd: '$0.00' };
    }
  }

  async signAndExecute(
    smartAccountAddress: string,
    userId: string,
    to: string,
    value: string,
    data?: string,
    chainId = 8453,
  ): Promise<TransactionResult> {
    return this.request<TransactionResult>('/transaction/sign-and-execute', {
      method: 'POST',
      headers: { 'x-dev-user-id': userId },
      body: JSON.stringify({
        smartAccountAddress,
        userId,
        to,
        value,
        data: data || '0x',
        chainId,
      }),
    });
  }
}

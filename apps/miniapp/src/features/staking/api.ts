'use client';

import { useActiveAccount } from 'thirdweb/react';

export interface StakingToken {
  symbol: string;
  address: string;
  icon?: string;
  decimals: number;
  stakingAPY: number;
  totalStaked: string;
  totalRewards: string;
  minimumStake: string;
  lockPeriod: number; // in days
  isActive: boolean;
}

export interface StakingPosition {
  id: string;
  userAddress: string;
  stakedAmount: string;
  stETHBalance: string;
  wstETHBalance: string;
  rewards: string;
  apy: number;
  timestamp: string;
  status: 'active' | 'inactive';
}

export interface StakingTransaction {
  id: string;
  userAddress: string;
  type: 'stake' | 'unstake' | 'claim';
  amount: string;
  token: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
}

export interface ProtocolInfo {
  totalStaked: string;
  totalRewards: string;
  currentAPY: number;
  stETHPrice: string;
  wstETHPrice: string;
  lastUpdate: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    userAddress: string;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
  };
}

export interface StakingResponse {
  success: boolean;
  data: StakingTransaction;
}

export interface PositionResponse {
  success: boolean;
  data: StakingPosition;
}

class StakingApiClient {
  private baseUrl: string;
  private account: any;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(account: any) {
    this.baseUrl = process.env.NEXT_PUBLIC_STAKING_API_URL || 'http://localhost:3004';
    this.account = account;
  }

  private async authenticate(): Promise<void> {
    if (!this.account?.address) {
      throw new Error('Account not connected');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/lido/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: this.account.address })
      });

      const authData: AuthResponse = await response.json();
      
      if (authData.success) {
        this.accessToken = authData.data.accessToken;
        this.refreshToken = authData.data.refreshToken;
        
        // Store tokens in localStorage for persistence
        localStorage.setItem('staking_access_token', this.accessToken);
        localStorage.setItem('staking_refresh_token', this.refreshToken);
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      throw new Error('Failed to authenticate with staking service');
    }
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/lido/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });

      const authData: AuthResponse = await response.json();
      
      if (authData.success) {
        this.accessToken = authData.data.accessToken;
        this.refreshToken = authData.data.refreshToken;
        
        // Update stored tokens
        localStorage.setItem('staking_access_token', this.accessToken);
        localStorage.setItem('staking_refresh_token', this.refreshToken);
      } else {
        throw new Error('Token refresh failed');
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      // Clear tokens and re-authenticate
      this.clearTokens();
      await this.authenticate();
    }
  }

  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('staking_access_token');
    localStorage.removeItem('staking_refresh_token');
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    // Try to get tokens from localStorage first
    if (!this.accessToken) {
      this.accessToken = localStorage.getItem('staking_access_token');
      this.refreshToken = localStorage.getItem('staking_refresh_token');
    }

    // If no tokens, authenticate
    if (!this.accessToken) {
      await this.authenticate();
    }

    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  private async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...options.headers }
      });

      // If unauthorized, try to refresh token
      if (response.status === 401) {
        await this.refreshAccessToken();
        const newHeaders = await this.getAuthHeaders();
        const retryResponse = await fetch(url, {
          ...options,
          headers: { ...newHeaders, ...options.headers }
        });
        return await retryResponse.json();
      }

      return await response.json();
    } catch (error) {
      console.error('Authenticated request error:', error);
      throw error;
    }
  }

  async getTokens(): Promise<StakingToken[]> {
    try {
      const protocolInfo = await this.getProtocolInfo();
      
      // Convert protocol info to staking tokens
      return [
        {
          symbol: 'ETH',
          address: '0x0000000000000000000000000000000000000000',
          decimals: 18,
          stakingAPY: protocolInfo.currentAPY,
          totalStaked: protocolInfo.totalStaked,
          totalRewards: protocolInfo.totalRewards,
          minimumStake: '0.001', // 0.001 ETH minimum
          lockPeriod: 0, // No lock period for liquid staking
          isActive: true,
        },
        {
          symbol: 'stETH',
          address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
          decimals: 18,
          stakingAPY: protocolInfo.currentAPY,
          totalStaked: protocolInfo.totalStaked,
          totalRewards: protocolInfo.totalRewards,
          minimumStake: '0.001',
          lockPeriod: 0,
          isActive: true,
        },
        {
          symbol: 'wstETH',
          address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
          decimals: 18,
          stakingAPY: protocolInfo.currentAPY,
          totalStaked: protocolInfo.totalStaked,
          totalRewards: protocolInfo.totalRewards,
          minimumStake: '0.001',
          lockPeriod: 0,
          isActive: true,
        }
      ];
    } catch (error) {
      console.error('Error fetching staking tokens:', error);
      throw new Error('Failed to fetch staking tokens');
    }
  }

  async getUserPosition(): Promise<StakingPosition | null> {
    if (!this.account?.address) return null;

    try {
      const response = await this.makeAuthenticatedRequest(
        `${this.baseUrl}/api/lido/position/${this.account.address}`
      );

      return response.success ? response.data : null;
    } catch (error) {
      console.error('Error fetching user position:', error);
      return null;
    }
  }

  async getProtocolInfo(): Promise<ProtocolInfo> {
    try {
      const response = await fetch(`${this.baseUrl}/api/lido/protocol/info`);
      const data = await response.json();
      
      if (data.success) {
        return data.data;
      } else {
        throw new Error('Failed to fetch protocol info');
      }
    } catch (error) {
      console.error('Error fetching protocol info:', error);
      throw new Error('Failed to fetch protocol info');
    }
  }

  async stake(amount: string): Promise<StakingTransaction> {
    if (!this.account?.address) {
      throw new Error('Account not connected');
    }

    try {
      const response = await this.makeAuthenticatedRequest(
        `${this.baseUrl}/api/lido/stake`,
        {
          method: 'POST',
          body: JSON.stringify({
            userAddress: this.account.address,
            amount: amount
          })
        }
      );

      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.message || 'Staking failed');
      }
    } catch (error) {
      console.error('Error staking:', error);
      throw new Error('Failed to stake tokens');
    }
  }

  async unstake(amount: string): Promise<StakingTransaction> {
    if (!this.account?.address) {
      throw new Error('Account not connected');
    }

    try {
      const response = await this.makeAuthenticatedRequest(
        `${this.baseUrl}/api/lido/unstake`,
        {
          method: 'POST',
          body: JSON.stringify({
            userAddress: this.account.address,
            amount: amount
          })
        }
      );

      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.message || 'Unstaking failed');
      }
    } catch (error) {
      console.error('Error unstaking:', error);
      throw new Error('Failed to unstake tokens');
    }
  }

  async claimRewards(): Promise<StakingTransaction> {
    if (!this.account?.address) {
      throw new Error('Account not connected');
    }

    try {
      const response = await this.makeAuthenticatedRequest(
        `${this.baseUrl}/api/lido/claim-rewards`,
        {
          method: 'POST',
          body: JSON.stringify({
            userAddress: this.account.address
          })
        }
      );

      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.message || 'Claim rewards failed');
      }
    } catch (error) {
      console.error('Error claiming rewards:', error);
      throw new Error('Failed to claim rewards');
    }
  }

  async getTransactionHistory(limit: number = 50): Promise<StakingTransaction[]> {
    if (!this.account?.address) return [];

    try {
      const response = await this.makeAuthenticatedRequest(
        `${this.baseUrl}/api/lido/history/${this.account.address}?limit=${limit}`
      );

      return response.success ? response.data : [];
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      return [];
    }
  }

  async getTransactionStatus(transactionHash: string): Promise<StakingTransaction | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/lido/transaction/${transactionHash}`);
      const data = await response.json();
      
      return data.success ? data.data : null;
    } catch (error) {
      console.error('Error fetching transaction status:', error);
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.makeAuthenticatedRequest(`${this.baseUrl}/api/lido/auth/logout`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      this.clearTokens();
    }
  }
}

export const useStakingApi = () => {
  const account = useActiveAccount();
  return new StakingApiClient(account);
};

export default StakingApiClient;

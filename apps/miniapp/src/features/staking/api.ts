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
  
  // Cache for Lido protocol data to prevent infinite loops
  private lidoDataCache: any = null;
  private lidoDataCacheTime: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const authData: AuthResponse = await response.json();
      
      if (authData.success && authData.data) {
        this.accessToken = authData.data.accessToken;
        this.refreshToken = authData.data.refreshToken;
        
        // Store tokens in localStorage for persistence
        localStorage.setItem('staking_access_token', this.accessToken);
        localStorage.setItem('staking_refresh_token', this.refreshToken);
      } else {
        throw new Error('Authentication failed: Invalid response from server');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to authenticate with staking service: ${error.message}`);
      }
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
      // Get Lido protocol data from their API
      const lidoData = await this.fetchLidoProtocolData();

      return [
        {
          symbol: 'ETH',
          address: '0x0000000000000000000000000000000000000000',
          decimals: 18,
          stakingAPY: lidoData.apy || 4.2,
          totalStaked: lidoData.totalStaked || '0',
          totalRewards: lidoData.totalRewards || '0',
          minimumStake: '1000000000000000', // 0.001 ETH in wei
          lockPeriod: 0,
          isActive: true,
        },
        {
          symbol: 'stETH',
          address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
          decimals: 18,
          stakingAPY: lidoData.apy || 4.2,
          totalStaked: lidoData.totalStaked || '0',
          totalRewards: lidoData.totalRewards || '0',
          minimumStake: '1000000000000000', // 0.001 ETH in wei
          lockPeriod: 0,
          isActive: true,
        },
        {
          symbol: 'wstETH',
          address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
          decimals: 18,
          stakingAPY: lidoData.apy || 4.2,
          totalStaked: lidoData.totalStaked || '0',
          totalRewards: lidoData.totalRewards || '0',
          minimumStake: '1000000000000000', // 0.001 ETH in wei
          lockPeriod: 0,
          isActive: true,
        }
      ];
    } catch (error) {
      console.error('Error fetching staking tokens:', error);
      throw new Error('Failed to fetch staking tokens');
    }
  }

  private async fetchLidoProtocolData(): Promise<any> {
    // Check if we have valid cached data
    const now = Date.now();
    if (this.lidoDataCache && (now - this.lidoDataCacheTime) < this.CACHE_DURATION) {
      console.log('Using cached Lido data');
      return this.lidoDataCache;
    }

    try {
      console.log('Fetching fresh Lido protocol data...');
      
      // Try to get Lido protocol data from their API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch('https://stake.lido.fi/api/stats', {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      const result = {
        apy: data.apr || 4.2,
        totalStaked: data.totalStaked || '0',
        totalRewards: data.totalRewards || '0'
      };
      
      // Cache the result
      this.lidoDataCache = result;
      this.lidoDataCacheTime = now;
      
      return result;
    } catch (error) {
      console.error('Error fetching Lido protocol data:', error);
      
      // If we have cached data, use it even if expired
      if (this.lidoDataCache) {
        console.log('Using expired cached data due to API error');
        return this.lidoDataCache;
      }
      
      // Try alternative API endpoint with timeout
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const altResponse = await fetch('https://api.lido.fi/v1/protocol/staking/apr/last', {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (altResponse.ok) {
          const altData = await altResponse.json();
          const result = {
            apy: altData.apr || 4.2,
            totalStaked: '0',
            totalRewards: '0'
          };
          
          // Cache the result
          this.lidoDataCache = result;
          this.lidoDataCacheTime = now;
          
          return result;
        }
      } catch (altError) {
        console.error('Error fetching alternative Lido data:', altError);
      }
      
      // Return fallback data
      const fallbackData = {
        apy: 4.2,
        totalStaked: '0',
        totalRewards: '0'
      };
      
      // Cache fallback data to prevent repeated failures
      this.lidoDataCache = fallbackData;
      this.lidoDataCacheTime = now;
      
      return fallbackData;
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

  async stake(amount: string): Promise<StakingTransaction> {
    if (!this.account?.address) {
      throw new Error('Account not connected');
    }

    // Validate amount
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Invalid amount. Please enter a positive number.');
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
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to stake tokens');
    }
  }

  async unstake(amount: string): Promise<StakingTransaction> {
    if (!this.account?.address) {
      throw new Error('Account not connected');
    }

    // Validate amount
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Invalid amount. Please enter a positive number.');
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
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to unstake tokens');
    }
  }


  async logout(): Promise<void> {
    try {
      // Clear tokens from localStorage
      this.clearTokens();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }

  // Method to clear cache (useful for testing or manual refresh)
  clearLidoDataCache(): void {
    this.lidoDataCache = null;
    this.lidoDataCacheTime = 0;
    console.log('Lido data cache cleared');
  }

  // Method to get cache status (useful for debugging)
  getCacheStatus(): { hasCache: boolean; cacheAge: number; isExpired: boolean } {
    const now = Date.now();
    const cacheAge = this.lidoDataCacheTime ? now - this.lidoDataCacheTime : 0;
    const isExpired = cacheAge > this.CACHE_DURATION;
    
    return {
      hasCache: !!this.lidoDataCache,
      cacheAge,
      isExpired
    };
  }
}

export const useStakingApi = () => {
  const account = useActiveAccount();
  return new StakingApiClient(account);
};

export default StakingApiClient;

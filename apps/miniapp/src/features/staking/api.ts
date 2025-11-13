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
  transactionData?: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    chainId: number;
  };
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
    
    // Try to load existing tokens from localStorage
    this.accessToken = localStorage.getItem('staking_access_token');
    this.refreshToken = localStorage.getItem('staking_refresh_token');
    
    // Clear tokens if they exist but account changed
    if (this.accessToken && account?.address) {
      try {
        const payload = JSON.parse(atob(this.accessToken.split('.')[1]));
        if (payload.address !== account.address) {
          console.log('🔄 Account changed, clearing old tokens');
          this.clearTokens();
        }
      } catch {
        console.log('🔄 Invalid token format, clearing tokens');
        this.clearTokens();
      }
    }
  }

  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('staking_access_token');
    localStorage.removeItem('staking_refresh_token');
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

  private async generateSignature(message: string): Promise<string> {
    if (!this.account) {
      throw new Error('Account not connected');
    }

    try {
      // Smart wallet signature using thirdweb
      const signature = await this.account.signMessage({ message });
      return signature;
    } catch (error) {
      console.error('Error signing message:', error);
      throw new Error('Failed to sign message');
    }
  }

  private async getAuthData(message: string) {
    const signature = await this.generateSignature(message);
    return {
      address: this.account.address,
      signature,
      message,
      timestamp: Date.now(),
      // Smart wallet specific data
      walletType: 'smart_wallet',
      chainId: 1, // Ethereum mainnet
      // No private key needed for smart wallets
      isSmartWallet: true
    };
  }

  private async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<any> {
    try {
      // Generate a unique message for this request
      const message = `Staking request at ${Date.now()}`;
      const authData = await this.getAuthData(message);
      
      const response = await fetch(url, {
        ...options,
        headers: { 
          'Content-Type': 'application/json',
          ...options.headers 
        },
        body: JSON.stringify({
          ...JSON.parse(options.body?.toString() || '{}'),
          authData
        })
      });

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
          minimumStake: '1000000000000000000', // 1 ETH in wei
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
      console.error('Error fetching staking tokens, using fallback data:', error);
      // Return fallback data instead of throwing error
      return [
        {
          symbol: 'ETH',
          address: '0x0000000000000000000000000000000000000000',
          decimals: 18,
          stakingAPY: 4.2,
          totalStaked: '0',
          totalRewards: '0',
          minimumStake: '1000000000000000000',
          lockPeriod: 0,
          isActive: true,
        },
        {
          symbol: 'stETH',
          address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
          decimals: 18,
          stakingAPY: 4.2,
          totalStaked: '0',
          totalRewards: '0',
          minimumStake: '1000000000000000',
          lockPeriod: 0,
          isActive: true,
        }
      ];
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
      // Ensure we're authenticated first
      if (!this.accessToken) {
        console.log('🔐 No access token found, authenticating...');
        await this.authenticate();
        console.log('✅ Authentication successful, token:', this.accessToken?.substring(0, 20) + '...');
      } else {
        console.log('🔑 Using existing token:', this.accessToken.substring(0, 20) + '...');
      }

      // Create specific message for getting position
      const message = `Get staking position\nTimestamp: ${Date.now()}`;
      const authData = await this.getAuthData(message);
      
      const response = await fetch(`${this.baseUrl}/api/lido/position/${this.account.address}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: JSON.stringify({ authData })
      });

      const result = await response.json();

      return result.success ? result.data : null;
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
      // Ensure we're authenticated first
      if (!this.accessToken) {
        console.log('🔐 No access token found, authenticating...');
        await this.authenticate();
        console.log('✅ Authentication successful, token:', this.accessToken?.substring(0, 20) + '...');
      } else {
        console.log('🔑 Using existing token:', this.accessToken.substring(0, 20) + '...');
      }

      // Create specific message for staking
      const message = `Stake ${amount} ETH\nTimestamp: ${Date.now()}`;
      const authData = await this.getAuthData(message);
      
      console.log('📤 Sending stake request:', {
        url: `${this.baseUrl}/api/lido/stake`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken?.substring(0, 20)}...`
        },
        body: {
          userAddress: this.account.address,
          amount: amount,
          authData: {
            address: authData.address,
            signature: authData.signature.substring(0, 20) + '...',
            message: authData.message,
            timestamp: authData.timestamp,
            walletType: authData.walletType,
            chainId: authData.chainId,
            isSmartWallet: authData.isSmartWallet
          }
        }
      });

      const response = await fetch(`${this.baseUrl}/api/lido/stake`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: JSON.stringify({
          userAddress: this.account.address,
          amount: amount,
          authData
        })
      });

      console.log('📥 Stake response status:', response.status);

      const result = await response.json();
      console.log('📥 Stake response data:', result);

      // If 401, try to refresh token or re-authenticate
      if (response.status === 401) {
        console.log('🔐 Token expired or invalid, re-authenticating...');
        await this.authenticate();
        
        // Retry with new token
        const retryResponse = await fetch(`${this.baseUrl}/api/lido/stake`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.accessToken}`
          },
          body: JSON.stringify({
            userAddress: this.account.address,
            amount: amount,
            authData
          })
        });
        
        const retryResult = await retryResponse.json();
        
        if (retryResult.success) {
          return retryResult.data;
        } else {
          throw new Error(retryResult.message || 'Staking failed after re-authentication');
        }
      }

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.message || 'Staking failed');
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
      // Ensure we're authenticated first
      if (!this.accessToken) {
        console.log('🔐 No access token found, authenticating...');
        await this.authenticate();
        console.log('✅ Authentication successful, token:', this.accessToken?.substring(0, 20) + '...');
      } else {
        console.log('🔑 Using existing token:', this.accessToken.substring(0, 20) + '...');
      }

      // Create specific message for unstaking
      const message = `Unstake ${amount} stETH\nTimestamp: ${Date.now()}`;
      const authData = await this.getAuthData(message);
      
      const response = await fetch(`${this.baseUrl}/api/lido/unstake`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: JSON.stringify({
          userAddress: this.account.address,
          amount: amount,
          authData
        })
      });

      const result = await response.json();

      // If 401, try to refresh token or re-authenticate
      if (response.status === 401) {
        console.log('🔐 Token expired or invalid, re-authenticating...');
        await this.authenticate();
        
        // Retry with new token
        const retryResponse = await fetch(`${this.baseUrl}/api/lido/unstake`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.accessToken}`
          },
          body: JSON.stringify({
            userAddress: this.account.address,
            amount: amount,
            authData
          })
        });
        
        const retryResult = await retryResponse.json();
        
        if (retryResult.success) {
          return retryResult.data;
        } else {
          throw new Error(retryResult.message || 'Unstaking failed after re-authentication');
        }
      }

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.message || 'Unstaking failed');
      }
    } catch (error) {
      console.error('Error unstaking:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to unstake tokens');
    }
  }

  async executeTransaction(txData: any): Promise<string> {
    try {
      if (!this.account) {
        throw new Error('Account not connected');
      }

      console.log('Raw transaction data received:', txData);

      // Extract transaction data
      const toAddress = txData.to;
      const value = txData.value;
      const data = txData.data;
      const gas = txData.gasLimit || txData.gas;

      console.log('Extracted transaction data:', {
        toAddress,
        value,
        data,
        gas
      });

      // Validate required fields
      if (!toAddress || !data) {
        throw new Error(`Invalid transaction data: missing to address (${toAddress}) or data (${data})`);
      }

      // Ensure to address is valid (42 characters starting with 0x)
      if (!toAddress || !/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
        throw new Error(`Invalid to address: ${toAddress}`);
      }
      
      // Ensure data is valid hex
      if (!data || !/^0x[a-fA-F0-9]+$/.test(data)) {
        throw new Error(`Invalid data: ${data}`);
      }

      // Get current gas price from the network
      let gasPrice;
      try {
        // Use a free gas price API
        const gasPriceResponse = await fetch('https://api.etherscan.io/api?module=gastracker&action=gasoracle');
        const gasPriceData = await gasPriceResponse.json();
        if (gasPriceData.status === '1' && gasPriceData.result) {
          // Use standard gas price (gwei to wei)
          const standardGasPrice = parseInt(gasPriceData.result.Standard) * 1e9; // Convert gwei to wei
          gasPrice = `0x${standardGasPrice.toString(16)}`;
          console.log('Using gas price from Etherscan:', gasPriceData.result.Standard, 'gwei');
        }
      } catch {
        console.log('Could not fetch gas price, using fallback');
        // Fallback to a reasonable gas price (20 gwei)
        const fallbackGasPrice = 20 * 1e9; // 20 gwei in wei
        gasPrice = `0x${fallbackGasPrice.toString(16)}`;
        console.log('Using fallback gas price: 20 gwei');
      }

      // Format transaction data for thirdweb/MetaMask
      // Convert value to hex properly handling BigInt
      let valueHex = '0x0';
      if (value) {
        try {
          // Handle both string and number inputs, and both decimal and hex strings
          const valueStr = typeof value === 'string' ? value : value.toString();
          // If already hex, use it; otherwise convert from decimal
          if (valueStr.startsWith('0x')) {
            valueHex = valueStr;
          } else {
            // Convert decimal string to BigInt then to hex
            const bigIntValue = BigInt(valueStr);
            valueHex = `0x${bigIntValue.toString(16)}`;
          }
        } catch (error) {
          console.error('Error converting value to hex:', error);
          throw new Error(`Invalid value format: ${value}`);
        }
      }

      // Convert gasLimit to hex properly
      let gasLimitHex = '0x5208'; // Default 21000
      if (gas) {
        try {
          const gasStr = typeof gas === 'string' ? gas : gas.toString();
          if (gasStr.startsWith('0x')) {
            gasLimitHex = gasStr;
          } else {
            // Use BigInt for gas to handle large values
            const bigIntGas = BigInt(gasStr);
            gasLimitHex = `0x${bigIntGas.toString(16)}`;
          }
        } catch (error) {
          console.error('Error converting gas to hex:', error);
          // Fallback to default
        }
      }

      const formattedTxData = {
        to: toAddress,
        value: valueHex,
        data: data,
        gasLimit: gasLimitHex,
        ...(gasPrice && { gasPrice }) // Only add gasPrice if we have it
      };

      console.log('Formatted transaction data for thirdweb:', formattedTxData);

      // Validate final transaction data
      if (!formattedTxData.to || !formattedTxData.data) {
        throw new Error('Invalid transaction data after formatting');
      }

      console.log('Sending transaction to thirdweb...');
      console.log('Account address:', this.account.address);
      console.log('Account type:', typeof this.account);
      
      try {
        // Execute transaction using thirdweb
        const tx = await this.account.sendTransaction(formattedTxData);
        console.log('Transaction sent, waiting for receipt...', tx);
        
        // Check if we got a transaction hash
        if (tx && tx.transactionHash) {
          console.log('✅ Transaction hash received:', tx.transactionHash);
          console.log('Transaction submitted successfully!');
          console.log('You can check the transaction status on a block explorer.');
          
          return tx.transactionHash;
        } else if (tx && typeof tx === 'string') {
          // Sometimes thirdweb returns just the hash as a string
          console.log('✅ Transaction hash received (string):', tx);
          return tx;
        } else {
          console.error('❌ No transaction hash in response:', tx);
          throw new Error('No transaction hash received from thirdweb');
        }
      } catch (txError) {
        console.error('❌ Thirdweb transaction error:', txError);
        console.error('Error details:', {
          message: txError instanceof Error ? txError.message : 'Unknown error',
          code: (txError as any)?.code,
          data: (txError as any)?.data
        });
        throw txError;
      }
    } catch (error) {
      console.error('Error executing transaction:', error);
      throw new Error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

'use client';

import { useMemo } from 'react';
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
  type: 'stake' | 'unstake' | 'unstake_approval' | 'claim';
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
  // For multi-step transactions (like unstake which requires approval first)
  requiresFollowUp?: boolean;
  followUpAction?: 'unstake';
}

export interface ProtocolInfo {
  totalStaked: string;
  totalRewards: string;
  currentAPY: number;
  stETHPrice: string;
  wstETHPrice: string;
  lastUpdate: string;
}

export interface StakingResponse {
  success: boolean;
  data: StakingTransaction;
}

export interface PositionResponse {
  success: boolean;
  data: StakingPosition;
}

export interface CacheStatus {
  hasCache: boolean;
  cacheAge: number;
  isExpired: boolean;
}

class StakingApiClient {
  private baseUrl: string;
  private account: any;

  // Cache for Lido protocol data to prevent infinite loops
  private lidoDataCache: any = null;
  private lidoDataCacheTime: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor(account: any) {
    const gatewayBase =
      (process.env.NEXT_PUBLIC_GATEWAY_BASE || process.env.VITE_GATEWAY_BASE || '').replace(/\/+$/, '');
    this.baseUrl = gatewayBase ? `${gatewayBase}/api/staking` : 'http://localhost:8443/api/staking';

    this.account = account;
  }

  private toWei(amount: string, decimals: number = 18): string {
    const num = parseFloat(amount);
    if (isNaN(num)) return '0';
    // Use BigInt for precise conversion to avoid floating point errors
    const factor = BigInt(10 ** decimals);
    const wholePart = Math.floor(num);
    const decimalPart = num - wholePart;
    const weiValue = BigInt(wholePart) * factor + BigInt(Math.floor(decimalPart * (10 ** decimals)));
    return weiValue.toString();
  }

  private getAddressFromToken(): string | null {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
      if (!token) return null;

      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

      return payload.sub || payload.address || null;
    } catch (error) {
      console.error('[STAKING] Error parsing JWT:', error);
      return null;
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Get JWT from auth-service (centralized authentication)
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    return headers;
  }

  private async generateSignature(message: string): Promise<string> {
    // Check if we have a JWT token first (centralized auth)
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

    // If we have a JWT token, use placeholder signature (backend validates JWT via auth-service)
    if (authToken) {
      return '0x0000000000000000000000000000000000000000000000000000000000000000';
    }

    // Only try to sign with account if we don't have JWT (pure wallet users)
    if (this.account) {
      try {
        const signature = await this.account.signMessage({ message });
        return signature;
      } catch (error) {
        console.error('[STAKING] Error signing message:', error);
        throw new Error('Failed to sign message');
      }
    }

    throw new Error('No authentication method available. Please authenticate first.');
  }

  private async getAuthData(message: string) {
    const signature = await this.generateSignature(message);
    const userAddress = this.account?.address || this.getAddressFromToken() || '';

    if (!userAddress) {
      throw new Error('User address not found. Please connect wallet or authenticate.');
    }

    return {
      address: userAddress,
      signature,
      message,
      timestamp: Date.now(),
      walletType: this.account ? 'smart_wallet' : 'jwt',
      chainId: 1, // Ethereum mainnet
      isSmartWallet: !!this.account
    };
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
    const userAddress = this.account?.address || this.getAddressFromToken();
    if (!userAddress) return null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Use centralized auth headers
      const headers = this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/position/${userAddress}`, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('[STAKING] Error fetching position:', response.status);
        return null;
      }

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      console.error('[STAKING] Error fetching user position:', error);
      return null;
    }
  }

  async stake(amount: string): Promise<StakingTransaction> {
    const userAddress = this.account?.address || this.getAddressFromToken();
    if (!userAddress) {
      throw new Error('Please connect your wallet or authenticate first.');
    }

    // Validate amount
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Invalid amount. Please enter a positive number.');
    }

    try {
      // Note: Backend expects amount in ETH (not wei), it handles conversion internally
      const message = `Stake ${amount} ETH\nTimestamp: ${Date.now()}`;
      const authData = await this.getAuthData(message);

      const headers = this.getAuthHeaders();

      console.log('[STAKING] Sending stake request:', {
        url: `${this.baseUrl}/stake`,
        userAddress,
        amount
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${this.baseUrl}/stake`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userAddress,
          amount,
          authData
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('[STAKING] Stake response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('[STAKING] Stake error:', response.status, errorText);

        if (response.status === 401) {
          throw new Error('Authentication expired. Please re-authenticate.');
        }

        throw new Error(`Staking failed: ${errorText}`);
      }

      const result = await response.json();
      console.log('[STAKING] Stake response data:', result);

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.message || 'Staking failed');
      }
    } catch (error) {
      console.error('[STAKING] Error staking:', error);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Staking request timeout. Please try again later.`);
        }
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          throw new Error(`Cannot connect to staking service. Please check if the service is running.`);
        }
        throw error;
      }
      throw new Error('Failed to stake tokens: Unknown error');
    }
  }

  async unstake(amount: string): Promise<StakingTransaction> {
    const userAddress = this.account?.address || this.getAddressFromToken();
    if (!userAddress) {
      throw new Error('Please connect your wallet or authenticate first.');
    }

    // Validate amount
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Invalid amount. Please enter a positive number.');
    }

    try {
      // Note: Backend expects amount in ETH (not wei), it handles conversion internally
      const message = `Unstake ${amount} stETH\nTimestamp: ${Date.now()}`;
      const authData = await this.getAuthData(message);

      const headers = this.getAuthHeaders();

      console.log('[STAKING] Sending unstake request:', {
        url: `${this.baseUrl}/unstake`,
        userAddress,
        amount
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${this.baseUrl}/unstake`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userAddress,
          amount,
          authData
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('[STAKING] Unstake response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('[STAKING] Unstake error:', response.status, errorText);

        if (response.status === 401) {
          throw new Error('Authentication expired. Please re-authenticate.');
        }

        throw new Error(`Unstaking failed: ${errorText}`);
      }

      const result = await response.json();
      console.log('[STAKING] Unstake response data:', result);

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.message || 'Unstaking failed');
      }
    } catch (error) {
      console.error('[STAKING] Error unstaking:', error);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Unstaking request timeout. Please try again later.`);
        }
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          throw new Error(`Cannot connect to staking service. Please check if the service is running.`);
        }
        throw error;
      }
      throw new Error('Failed to unstake tokens: Unknown error');
    }
  }

  async executeTransaction(txData: any): Promise<string> {
    try {
      if (!this.account) {
        throw new Error('Account not connected. Please connect your wallet first.');
      }

      if (!this.account.sendTransaction) {
        throw new Error('Account does not support sendTransaction. Please ensure your wallet is properly connected.');
      }

      console.log('Raw transaction data received:', txData);

      // IMPORTANT: Lido staking is on Ethereum Mainnet (chainId 1)
      // The transaction data from backend should have chainId: 1
      const expectedChainId = txData.chainId || 1; // Default to Ethereum mainnet
      console.log('Expected chainId for transaction:', expectedChainId);

      if (expectedChainId !== 1) {
        console.warn('⚠️ Transaction data has unexpected chainId:', expectedChainId);
        console.warn('Lido staking should be on Ethereum mainnet (chainId 1)');
      }

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

      // Let thirdweb calculate gas price automatically (same as lending)
      // This allows the wallet/provider to use the most efficient gas price
      // and results in lower network fees

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

      // Convert gas to hex properly (only if provided by backend)
      // Use 'gas' instead of 'gasLimit' for thirdweb compatibility (same as lending)
      // If not provided, let thirdweb estimate automatically for accurate fees
      let gasHex: string | undefined;
      if (gas) {
        try {
          const gasStr = typeof gas === 'string' ? gas : gas.toString();
          if (gasStr.startsWith('0x')) {
            gasHex = gasStr;
          } else {
            // Use BigInt for gas to handle large values
            const bigIntGas = BigInt(gasStr);
            gasHex = `0x${bigIntGas.toString(16)}`;
          }
          console.log('Using gas from backend:', gasHex);
        } catch (error) {
          console.error('Error converting gas to hex:', error);
          // If conversion fails, let thirdweb estimate
        }
      } else {
        console.log('No gas provided, letting thirdweb estimate automatically');
      }

      const formattedTxData: any = {
        to: toAddress,
        value: valueHex,
        data: data,
        // IMPORTANT: Specify chainId to ensure transaction goes to correct network
        // Lido staking is on Ethereum mainnet (chainId 1)
        chainId: 1
      };

      // Only set gas if we have it from backend (same format as lending)
      // Otherwise let thirdweb estimate automatically for accurate fees
      if (gasHex) {
        formattedTxData.gas = gasHex;
      }

      // Don't set gasPrice - let thirdweb calculate it automatically (same as lending)
      // This results in optimal fees as the wallet/provider can optimize based on current network conditions

      console.log('Formatted transaction data for thirdweb:', formattedTxData);
      console.log('Transaction will be sent to Ethereum mainnet (chainId: 1)');

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

  // Method to clear cache (useful for testing or manual refresh)
  clearLidoDataCache(): void {
    this.lidoDataCache = null;
    this.lidoDataCacheTime = 0;
    console.log('[STAKING] Lido data cache cleared');
  }

  // Method to get cache status (useful for debugging)
  getCacheStatus(): CacheStatus {
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
  return useMemo(() => new StakingApiClient(account), [account]);
};

export default StakingApiClient;

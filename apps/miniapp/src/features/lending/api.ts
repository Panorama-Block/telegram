'use client';

import { useActiveAccount } from 'thirdweb/react';

export interface LendingToken {
  symbol: string;
  address: string;
  icon?: string;
  decimals: number;
  supplyAPY: number;
  borrowAPY: number;
  totalSupply: string;
  totalBorrowed: string;
  availableLiquidity: string;
  collateralFactor: number;
  isCollateral: boolean;
}

export interface LendingPosition {
  token: LendingToken;
  suppliedAmount: string;
  borrowedAmount: string;
  collateralValue: string;
  borrowValue: string;
  healthFactor: number;
  liquidationThreshold: number;
}

export interface LendingAction {
  action: 'supply' | 'withdraw' | 'borrow' | 'repay';
  token: string;
  amount: string;
}

export interface ValidationResponse {
  status: number;
  msg: string;
  data: {
    amount: string;
    taxAmount: string;
    taxRate: string;
    restAmount: string;
  };
}

export interface SwapResponse {
  status: number;
  msg: string;
  data: {
    chainId: string;
    from: string;
    to: string;
    value: string;
    gas: string;
    data: string;
    gasPrice: string;
    referenceId: string;
    status: string;
    note: string;
  };
}

class LendingApiClient {
  private baseUrl: string;
  private account: any;
  
  // Cache for lending data to prevent infinite loops
  private lendingDataCache: any = null;
  private lendingDataCacheTime: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor(account: any) {
    this.baseUrl = process.env.NEXT_PUBLIC_LENDING_API_URL || 'http://localhost:3001';
    this.account = account;
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
      chainId: 43114, // Avalanche mainnet
      // No private key needed for smart wallets
      isSmartWallet: true
    };
  }

  async getTokens(): Promise<LendingToken[]> {
    // Check if we have valid cached data
    const now = Date.now();
    if (this.lendingDataCache && (now - this.lendingDataCacheTime) < this.CACHE_DURATION) {
      console.log('Using cached lending data');
      return this.lendingDataCache;
    }

    try {
      console.log('Fetching fresh lending data...');
      
      // Try to get tokens from the API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${this.baseUrl}/dex/tokens`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Convert API data to LendingToken format
      const tokens = data.map((token: any) => ({
        symbol: token.symbol,
        address: token.address,
        decimals: token.decimals || 18,
        supplyAPY: this.calculateAPY(token.supplyRate || 0),
        borrowAPY: this.calculateAPY(token.borrowRate || 0),
        totalSupply: token.totalSupply || '0',
        totalBorrowed: token.totalBorrowed || '0',
        availableLiquidity: token.availableLiquidity || '0',
        collateralFactor: token.collateralFactor || 0.8,
        isCollateral: token.isCollateral || true
      }));
      
      // Cache the result
      this.lendingDataCache = tokens;
      this.lendingDataCacheTime = now;
      
      return tokens;
    } catch (error) {
      console.error('Error fetching lending tokens:', error);
      
      // If we have cached data, use it even if expired
      if (this.lendingDataCache) {
        console.log('Using expired cached data due to API error');
        return this.lendingDataCache;
      }
      
      // Return fallback data
      const fallbackTokens = [
        {
          symbol: 'AVAX',
          address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
          decimals: 18,
          supplyAPY: 3.5,
          borrowAPY: 5.2,
          totalSupply: '0',
          totalBorrowed: '0',
          availableLiquidity: '0',
          collateralFactor: 0.8,
          isCollateral: true
        },
        {
          symbol: 'USDC',
          address: '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664',
          decimals: 6,
          supplyAPY: 2.8,
          borrowAPY: 4.5,
          totalSupply: '0',
          totalBorrowed: '0',
          availableLiquidity: '0',
          collateralFactor: 0.9,
          isCollateral: true
        }
      ];
      
      // Cache fallback data to prevent repeated failures
      this.lendingDataCache = fallbackTokens;
      this.lendingDataCacheTime = now;
      
      return fallbackTokens;
    }
  }

  async getUserPosition(): Promise<LendingPosition | null> {
    if (!this.account) return null;

    try {
      const message = `Get lending position\nTimestamp: ${Date.now()}`;
      const authData = await this.getAuthData(message);
      
      const response = await fetch(`${this.baseUrl}/lending/position`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authData)
      });

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error fetching user position:', error);
      return null;
    }
  }

  async calculateTax(amount: string): Promise<ValidationResponse> {
    try {
      const message = `Calculate tax for amount ${amount}\nTimestamp: ${Date.now()}`;
      const authData = await this.getAuthData(message);
      
      const response = await fetch(`${this.baseUrl}/validation/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...authData,
          amount
        })
      });

      return await response.json();
    } catch (error) {
      console.error('Error calculating tax:', error);
      throw new Error('Failed to calculate tax');
    }
  }

  async prepareSupply(tokenAddress: string, amount: string): Promise<any> {
    try {
      const message = `Validate and supply ${amount} of token ${tokenAddress}\nTimestamp: ${Date.now()}`;
      const authData = await this.getAuthData(message);
      
      const response = await fetch(`${this.baseUrl}/benqi-validation/validateAndSupply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...authData,
          amount,
          qTokenAddress: tokenAddress,
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error preparing supply:', error);
      throw new Error('Failed to prepare supply transaction');
    }
  }

  async prepareWithdraw(tokenAddress: string, amount: string): Promise<SwapResponse> {
    try {
      const message = `Withdraw ${amount} of token ${tokenAddress}\nTimestamp: ${Date.now()}`;
      const authData = await this.getAuthData(message);
      
      const response = await fetch(`${this.baseUrl}/lending/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...authData,
          tokenAddress,
          amount
        })
      });

      return await response.json();
    } catch (error) {
      console.error('Error preparing withdraw:', error);
      throw new Error('Failed to prepare withdraw transaction');
    }
  }

  async prepareBorrow(tokenAddress: string, amount: string): Promise<any> {
    try {
      const message = `Validate and borrow ${amount} of token ${tokenAddress}\nTimestamp: ${Date.now()}`;
      const authData = await this.getAuthData(message);
      
      const response = await fetch(`${this.baseUrl}/benqi-validation/validateAndBorrow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...authData,
          amount,
          qTokenAddress: tokenAddress,
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error preparing borrow:', error);
      throw new Error('Failed to prepare borrow transaction');
    }
  }

  async prepareRepay(tokenAddress: string, amount: string): Promise<SwapResponse> {
    try {
      const message = `Repay ${amount} of token ${tokenAddress}\nTimestamp: ${Date.now()}`;
      const authData = await this.getAuthData(message);
      
      const response = await fetch(`${this.baseUrl}/lending/repay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...authData,
          tokenAddress,
          amount
        })
      });

      return await response.json();
    } catch (error) {
      console.error('Error preparing repay:', error);
      throw new Error('Failed to prepare repay transaction');
    }
  }

  async executeTransaction(txData: any): Promise<boolean> {
    try {
      if (!this.account) {
        throw new Error('Account not connected');
      }

      // Executar transação usando thirdweb
      const tx = await this.account.sendTransaction(txData);
      const receipt = await tx.wait();
      
      return receipt.status === 1;
    } catch (error) {
      console.error('Error executing transaction:', error);
      throw new Error('Transaction failed');
    }
  }

  async getSupplyQuote(tokenAddress: string, amount: string): Promise<any> {
    try {
      const message = `Get validation and supply quote for ${amount} of token ${tokenAddress}\nTimestamp: ${Date.now()}`;
      const authData = await this.getAuthData(message);
      
      const response = await fetch(`${this.baseUrl}/benqi-validation/getValidationAndSupplyQuote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...authData,
          amount,
          qTokenAddress: tokenAddress,
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting supply quote:', error);
      throw new Error('Failed to get supply quote');
    }
  }

  async getBorrowQuote(tokenAddress: string, amount: string): Promise<any> {
    try {
      const message = `Get validation and borrow quote for ${amount} of token ${tokenAddress}\nTimestamp: ${Date.now()}`;
      const authData = await this.getAuthData(message);
      
      const response = await fetch(`${this.baseUrl}/benqi-validation/getValidationAndBorrowQuote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...authData,
          amount,
          qTokenAddress: tokenAddress,
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting borrow quote:', error);
      throw new Error('Failed to get borrow quote');
    }
  }

  // Method to clear cache (useful for testing or manual refresh)
  clearLendingDataCache(): void {
    this.lendingDataCache = null;
    this.lendingDataCacheTime = 0;
    console.log('Lending data cache cleared');
  }

  // Method to get cache status (useful for debugging)
  getCacheStatus(): { hasCache: boolean; cacheAge: number; isExpired: boolean } {
    const now = Date.now();
    const cacheAge = this.lendingDataCacheTime ? now - this.lendingDataCacheTime : 0;
    const isExpired = cacheAge > this.CACHE_DURATION;
    
    return {
      hasCache: !!this.lendingDataCache,
      cacheAge,
      isExpired
    };
  }

  private calculateAPY(rate: number): number {
    // Converter taxa anual para APY
    return rate * 100;
  }
}

export const useLendingApi = () => {
  const account = useActiveAccount();
  return new LendingApiClient(account);
};

export default LendingApiClient;

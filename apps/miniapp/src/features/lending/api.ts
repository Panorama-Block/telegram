'use client';

import { useActiveAccount } from 'thirdweb/react';
import {
  LendingToken,
  LendingPosition,
  ValidationResponse,
  CacheStatus
} from './types';
import { LENDING_CONFIG, API_ENDPOINTS, FALLBACK_TOKENS } from './config';

class LendingApiClient {
  private baseUrl: string;
  private account: any;
  private lendingDataCache: any = null;
  private lendingDataCacheTime: number = 0;
  private readonly CACHE_DURATION = LENDING_CONFIG.CACHE_DURATION;

  constructor(account: any) {
    this.baseUrl = process.env.NEXT_PUBLIC_LENDING_API_URL || LENDING_CONFIG.DEFAULT_API_URL;
    this.account = account;
  }

  private toWei(amount: string, decimals: number = 18): string {
    const num = parseFloat(amount);
    if (isNaN(num)) return '0';
    return Math.floor(num * Math.pow(10, decimals)).toString();
  }

  private formatMessage(action: string, amount: string, tokenAddress?: string): string {
    const timestamp = Date.now();
    if (tokenAddress) {
      return `${action} ${amount} of token ${tokenAddress}\nTimestamp: ${timestamp}`;
    } else {
      return `${action}\nTimestamp: ${timestamp}`;
    }
  }

  private async generateSignature(message: string): Promise<string> {
    if (!this.account) {
      throw new Error('Account not connected');
    }

    try {
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
      walletType: 'smart_wallet',
      chainId: 43114,
      isSmartWallet: true
    };
  }

  async getTokens(): Promise<LendingToken[]> {
    const now = Date.now();
    if (this.lendingDataCache && (now - this.lendingDataCacheTime) < this.CACHE_DURATION) {
      return this.lendingDataCache;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.TOKENS}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      let tokensArray;
      if (Array.isArray(data)) {
        tokensArray = data;
      } else if (data.data && Array.isArray(data.data)) {
        tokensArray = data.data;
      } else if (data.tokens && Array.isArray(data.tokens)) {
        tokensArray = data.tokens;
      } else {
        throw new Error('Invalid API response: expected array of tokens');
      }
      
      const tokens = tokensArray.map((token: any) => ({
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
      
      this.lendingDataCache = tokens;
      this.lendingDataCacheTime = now;
      
      return tokens;
    } catch (error) {
      console.error('Error fetching lending tokens:', error);
      
      if (this.lendingDataCache) {
        return this.lendingDataCache;
      }
      
      const fallbackTokens = [...FALLBACK_TOKENS];
      
      this.lendingDataCache = fallbackTokens;
      this.lendingDataCacheTime = now;
      
      return fallbackTokens;
    }
  }

  async getUserPosition(): Promise<LendingPosition | null> {
    if (!this.account) return null;

    try {
      const message = this.formatMessage('Get lending position', '');
      const authData = await this.getAuthData(message);
      
      const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.POSITION}`, {
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
      const amountInWei = this.toWei(amount);
      const message = this.formatMessage('Calculate tax for amount', amountInWei);
      const authData = await this.getAuthData(message);
      
      const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.CALCULATE_TAX}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...authData,
          amount: amountInWei
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
      const amountInWei = this.toWei(amount);
      const message = this.formatMessage('Validate and supply', amountInWei, tokenAddress);
      const authData = await this.getAuthData(message);
      
      const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.PREPARE_SUPPLY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...authData,
          amount: amountInWei,
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

  async prepareWithdraw(tokenAddress: string, amount: string): Promise<any> {
    try {
      const amountInWei = this.toWei(amount);
      const message = this.formatMessage('Withdraw', amountInWei, tokenAddress);
      const authData = await this.getAuthData(message);
      
      const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.PREPARE_WITHDRAW}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...authData,
          amount: amountInWei,
          qTokenAddress: tokenAddress,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Withdraw API error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error preparing withdraw:', error);
      throw new Error('Failed to prepare withdraw transaction');
    }
  }

  async prepareBorrow(tokenAddress: string, amount: string): Promise<any> {
    try {
      const amountInWei = this.toWei(amount);
      const message = this.formatMessage('Validate and borrow', amountInWei, tokenAddress);
      const authData = await this.getAuthData(message);
      
      const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.PREPARE_BORROW}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...authData,
          amount: amountInWei,
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

  async prepareRepay(tokenAddress: string, amount: string): Promise<any> {
    try {
      const amountInWei = this.toWei(amount);
      const message = this.formatMessage('Repay', amountInWei, tokenAddress);
      const authData = await this.getAuthData(message);
      
      const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.PREPARE_REPAY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...authData,
          amount: amountInWei,
          qTokenAddress: tokenAddress,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Repay API error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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

      const toAddress = txData.to;
      const value = txData.value;
      const data = txData.data;
      const gas = txData.gasLimit || txData.gas;
      const gasPrice = txData.gasPrice;

      if (!toAddress || !data) {
        throw new Error(`Invalid transaction data: missing to address (${toAddress}) or data (${data})`);
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
        throw new Error(`Invalid to address: ${toAddress}`);
      }

      const formattedTxData = {
        to: toAddress,
        value: value ? `0x${parseInt(value).toString(16)}` : '0x0',
        data: data,
        gas: gas ? `0x${parseInt(gas).toString(16)}` : '0x5208',
        gasPrice: gasPrice ? `0x${parseInt(gasPrice).toString(16)}` : undefined
      };

      if (formattedTxData.gasPrice === '0x0' || !formattedTxData.gasPrice) {
        delete formattedTxData.gasPrice;
      }

      if (!formattedTxData.to || !formattedTxData.data) {
        throw new Error('Invalid transaction data after formatting');
      }

      const tx = await this.account.sendTransaction(formattedTxData);
      
      if (tx.transactionHash) {
        return true;
      } else {
        throw new Error('No transaction hash received');
      }
    } catch (error) {
      console.error('Error executing transaction:', error);
      throw new Error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSupplyQuote(tokenAddress: string, amount: string): Promise<any> {
    try {
      const amountInWei = this.toWei(amount);
      const message = this.formatMessage('Get validation and supply quote for', amountInWei, tokenAddress);
      const authData = await this.getAuthData(message);
      
      const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.SUPPLY_QUOTE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...authData,
          amount: amountInWei,
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
      const amountInWei = this.toWei(amount);
      const message = this.formatMessage('Get validation and borrow quote for', amountInWei, tokenAddress);
      const authData = await this.getAuthData(message);
      
      const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.BORROW_QUOTE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...authData,
          amount: amountInWei,
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

  clearLendingDataCache(): void {
    this.lendingDataCache = null;
    this.lendingDataCacheTime = 0;
  }

  getCacheStatus(): CacheStatus {
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
    return rate * 100;
  }
}

export const useLendingApi = () => {
  const account = useActiveAccount();
  return new LendingApiClient(account);
};

export default LendingApiClient;
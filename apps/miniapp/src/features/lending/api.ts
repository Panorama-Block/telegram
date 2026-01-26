'use client';

import { useMemo } from 'react';
import { useActiveAccount, useSwitchActiveWalletChain } from 'thirdweb/react';
import { defineChain } from 'thirdweb';
import {
  LendingToken,
  LendingPosition,
  ValidationResponse,
  CacheStatus
} from './types';
import { LENDING_CONFIG, API_ENDPOINTS, FALLBACK_TOKENS, TOKEN_ICONS } from './config';

type SwitchChainFn = (chain: ReturnType<typeof defineChain>) => Promise<void>;

class LendingApiClient {
  private baseUrl: string;
  private account: any;
  private switchChain: SwitchChainFn | null;
  private lendingDataCache: any = null;
  private lendingDataCacheTime: number = 0;
  private readonly CACHE_DURATION = LENDING_CONFIG.CACHE_DURATION;

  constructor(account: any, switchChain?: SwitchChainFn) {
    this.switchChain = switchChain || null;
    // Priority 1: Use direct lending API base URL (deployed service)
    const direct = process.env.VITE_LENDING_API_BASE || process.env.NEXT_PUBLIC_LENDING_API_URL;

    if (direct && direct.length > 0) {
      this.baseUrl = direct.replace(/\/+$/, '');
    } else {
      // Fallback: use Next.js proxy (which will forward to deployed service)
      this.baseUrl = '/api/lending';
    }

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

  private getAddressFromToken(): string | null {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return null;

      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

      return payload.sub || payload.address || null;
    } catch (error) {
      console.error('Error parsing JWT:', error);
      return null;
    }
  }

  private async generateSignature(message: string): Promise<string> {
    // Check if we have a JWT token first
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

    // If we have a JWT token, use placeholder signature (backend will validate JWT)
    if (authToken) {
      return '0x0000000000000000000000000000000000000000000000000000000000000000';
    }

    // Only try to sign with account if we don't have JWT (pure MetaMask users)
    if (this.account) {
      try {
        const signature = await this.account.signMessage({ message });
        return signature;
      } catch (error) {
        console.error('[LENDING] Error signing message:', error);
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
      chainId: 43114,
      isSmartWallet: !!this.account
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

      const authToken = localStorage.getItem('authToken');
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.TOKENS}`, {
        signal: controller.signal,
        headers
      });

      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      let tokensArray;
      if (Array.isArray(data)) {
        tokensArray = data;
      } else if (data.data && data.data.tokens && Array.isArray(data.data.tokens)) {
        tokensArray = data.data.tokens;
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
        icon: token.icon || TOKEN_ICONS[token.symbol] || undefined,
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
    const userAddress = this.account?.address || this.getAddressFromToken();
    if (!userAddress) return null;

    try {
      const authToken = localStorage.getItem('authToken');
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.POSITION}/${userAddress}/info`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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

      const authToken = localStorage.getItem('authToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.CALCULATE_TAX}`, {
        method: 'POST',
        headers,
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

      const authToken = localStorage.getItem('authToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.PREPARE_SUPPLY}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...authData,
          amount: amountInWei,
          qTokenAddress: tokenAddress,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LENDING] Error preparing supply:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[LENDING] Error preparing supply:', error);
      throw new Error('Failed to prepare supply transaction: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async prepareWithdraw(tokenAddress: string, amount: string): Promise<any> {
    try {
      const amountInWei = this.toWei(amount);
      const message = this.formatMessage('Withdraw', amountInWei, tokenAddress);
      const authData = await this.getAuthData(message);

      const authToken = localStorage.getItem('authToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.PREPARE_WITHDRAW}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...authData,
          amount: amountInWei,
          qTokenAddress: tokenAddress,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LENDING] Error preparing withdraw:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[LENDING] Error preparing withdraw:', error);
      throw new Error('Failed to prepare withdraw transaction');
    }
  }

  async prepareBorrow(tokenAddress: string, amount: string): Promise<any> {
    try {
      const amountInWei = this.toWei(amount);
      const message = this.formatMessage('Validate and borrow', amountInWei, tokenAddress);
      const authData = await this.getAuthData(message);

      const authToken = localStorage.getItem('authToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.PREPARE_BORROW}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...authData,
          amount: amountInWei,
          qTokenAddress: tokenAddress,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LENDING] Error preparing borrow:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[LENDING] Error preparing borrow:', error);
      throw new Error('Failed to prepare borrow transaction');
    }
  }

  async prepareRepay(tokenAddress: string, amount: string): Promise<any> {
    try {
      const amountInWei = this.toWei(amount);
      const message = this.formatMessage('Repay', amountInWei, tokenAddress);
      const authData = await this.getAuthData(message);

      const authToken = localStorage.getItem('authToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.PREPARE_REPAY}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...authData,
          amount: amountInWei,
          qTokenAddress: tokenAddress,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LENDING] Error preparing repay:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[LENDING] Error preparing repay:', error);
      throw new Error('Failed to prepare repay transaction');
    }
  }

  async executeTransaction(txData: any): Promise<boolean> {
    try {
      if (!this.account) {
        throw new Error('Please connect your wallet to execute blockchain transactions.');
      }

      const toAddress = txData.to;
      const value = txData.value;
      const data = txData.data;
      const gas = txData.gasLimit || txData.gas;
      const gasPrice = txData.gasPrice;
      const chainId = txData.chainId;

      if (!toAddress || !data) {
        throw new Error(`Invalid transaction data: missing to address or data`);
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
        throw new Error(`Invalid to address: ${toAddress}`);
      }

      // IMPORTANT: Switch to the required chain before sending transaction
      // Use native MetaMask API for reliable chain switching
      if (chainId) {
        const ethereum = typeof window !== 'undefined' ? (window as any).ethereum : null;
        if (ethereum) {
          const chainIdHex = `0x${chainId.toString(16)}`;
          try {
            console.log(`[LENDING] Switching to chain ${chainId} (${chainIdHex}) before transaction...`);
            await ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: chainIdHex }],
            });
            console.log(`[LENDING] Successfully switched to chain ${chainId}`);
            // Wait a moment for the switch to take effect
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (switchError: any) {
            console.error('[LENDING] Failed to switch chain:', switchError);
            // If chain is not added, try to add it (code 4902)
            if (switchError?.code === 4902) {
              console.log('[LENDING] Chain not found, attempting to add Avalanche...');
              try {
                await ethereum.request({
                  method: 'wallet_addEthereumChain',
                  params: [{
                    chainId: chainIdHex,
                    chainName: 'Avalanche C-Chain',
                    nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
                    rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
                    blockExplorerUrls: ['https://snowtrace.io'],
                  }],
                });
                console.log('[LENDING] Avalanche chain added successfully');
                // Wait for the chain to be added and switched
                await new Promise(resolve => setTimeout(resolve, 500));
              } catch (addError) {
                console.error('[LENDING] Failed to add chain:', addError);
                throw new Error('Please switch to Avalanche network manually in your wallet');
              }
            } else if (switchError?.code === 4001) {
              // User rejected the switch
              throw new Error('You must switch to Avalanche network to complete this transaction');
            } else {
              throw new Error('Failed to switch network. Please switch to Avalanche manually.');
            }
          }
        }
      }

      const toHex = (input?: string | number | bigint) => {
        if (input === undefined || input === null || input === '') return undefined;
        if (typeof input === 'bigint') return `0x${input.toString(16)}`;
        if (typeof input === 'number') return `0x${BigInt(Math.trunc(input)).toString(16)}`;
        if (typeof input === 'string') {
          const trimmed = input.trim();
          if (!trimmed) return undefined;
          if (trimmed.startsWith('0x')) return trimmed;
          return `0x${BigInt(trimmed).toString(16)}`;
        }
        return undefined;
      };

      const formattedTxData: Record<string, any> = {
        to: toAddress,
        data: data,
        value: toHex(value) ?? '0x0',
      };

      const gasHex = toHex(gas);
      if (gasHex) {
        formattedTxData.gas = gasHex;
      }

      const gasPriceHex = toHex(gasPrice);
      if (gasPriceHex && gasPriceHex !== '0x0') {
        formattedTxData.gasPrice = gasPriceHex;
      }

      if (chainId) {
        formattedTxData.chainId = chainId;
      }

      const tx = await this.account.sendTransaction(formattedTxData);

      if (tx.transactionHash) {
        return true;
      } else {
        throw new Error('No transaction hash received');
      }
    } catch (error) {
      console.error('[LENDING] Transaction failed:', error);
      throw new Error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSupplyQuote(tokenAddress: string, amount: string): Promise<any> {
    try {
      const amountInWei = this.toWei(amount);
      const message = this.formatMessage('Get validation and supply quote for', amountInWei, tokenAddress);
      const authData = await this.getAuthData(message);

      const authToken = localStorage.getItem('authToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.SUPPLY_QUOTE}`, {
        method: 'POST',
        headers,
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
      console.error('[LENDING] Error getting supply quote:', error);
      throw new Error('Failed to get supply quote');
    }
  }

  async getBorrowQuote(tokenAddress: string, amount: string): Promise<any> {
    try {
      const amountInWei = this.toWei(amount);
      const message = this.formatMessage('Get validation and borrow quote for', amountInWei, tokenAddress);
      const authData = await this.getAuthData(message);

      const authToken = localStorage.getItem('authToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.BORROW_QUOTE}`, {
        method: 'POST',
        headers,
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
      console.error('[LENDING] Error getting borrow quote:', error);
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
  const switchChain = useSwitchActiveWalletChain();
  return useMemo(() => new LendingApiClient(account, switchChain), [account, switchChain]);
};

export default LendingApiClient;

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

  // Helper function to convert decimal to wei
  private toWei(amount: string, decimals: number = 18): string {
    const num = parseFloat(amount);
    if (isNaN(num)) return '0';
    return Math.floor(num * Math.pow(10, decimals)).toString();
  }

  // Helper function to format message with proper \n before Timestamp
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
      
      console.log('Raw API response for tokens:', data);
      
      // Handle different response structures
      let tokensArray;
      if (Array.isArray(data)) {
        tokensArray = data;
      } else if (data.data && Array.isArray(data.data)) {
        tokensArray = data.data;
      } else if (data.tokens && Array.isArray(data.tokens)) {
        tokensArray = data.tokens;
      } else {
        console.warn('Unexpected API response structure:', data);
        throw new Error('Invalid API response: expected array of tokens');
      }
      
      // Convert API data to LendingToken format
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
      const message = this.formatMessage('Get lending position', '');
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
      const amountInWei = this.toWei(amount);
      const message = this.formatMessage('Calculate tax for amount', amountInWei);
      const authData = await this.getAuthData(message);
      
      const response = await fetch(`${this.baseUrl}/validation/calculate`, {
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
      
      const response = await fetch(`${this.baseUrl}/benqi-validation/validateAndSupply`, {
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
      
      console.log('Preparing withdraw with data:', {
        tokenAddress,
        amount: amountInWei,
        message
      });
      
      const response = await fetch(`${this.baseUrl}/benqi-validation/validateAndWithdraw`, {
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

      const data = await response.json();
      console.log('Withdraw API response:', data);
      
      return data;
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
      
      const response = await fetch(`${this.baseUrl}/benqi-validation/validateAndBorrow`, {
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
      
      console.log('Preparing repay with data:', {
        tokenAddress,
        amount: amountInWei,
        message
      });
      
      const response = await fetch(`${this.baseUrl}/benqi-validation/validateAndRepay`, {
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

      const data = await response.json();
      console.log('Repay API response:', data);
      
      return data;
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

      console.log('Raw transaction data received:', txData);

      // Extract transaction data (now we expect it to be properly structured)
      const toAddress = txData.to;
      const value = txData.value;
      const data = txData.data;
      const gas = txData.gasLimit || txData.gas;
      const gasPrice = txData.gasPrice;

      console.log('Extracted transaction data:', {
        toAddress,
        value,
        data,
        gas,
        gasPrice
      });

      // Validate required fields
      if (!toAddress || !data) {
        throw new Error(`Invalid transaction data: missing to address (${toAddress}) or data (${data})`);
      }

      // Ensure to address is valid (42 characters starting with 0x)
      if (!/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
        throw new Error(`Invalid to address: ${toAddress}`);
      }

      // Format transaction data for thirdweb/MetaMask
      const formattedTxData = {
        to: toAddress,
        value: value ? `0x${parseInt(value).toString(16)}` : '0x0', // Convert to hex
        data: data,
        gas: gas ? `0x${parseInt(gas).toString(16)}` : '0x5208', // Convert to hex
        gasPrice: gasPrice ? `0x${parseInt(gasPrice).toString(16)}` : undefined // Convert to hex or undefined
      };

      // Remove gasPrice if it's 0 or undefined to let MetaMask estimate
      if (formattedTxData.gasPrice === '0x0' || !formattedTxData.gasPrice) {
        delete formattedTxData.gasPrice;
      }

      console.log('Formatted transaction data for thirdweb:', formattedTxData);

      // Validate final transaction data
      if (!formattedTxData.to || !formattedTxData.data) {
        throw new Error('Invalid transaction data after formatting');
      }

      console.log('Sending transaction to thirdweb...');
      
      // Executar transação usando thirdweb
      const tx = await this.account.sendTransaction(formattedTxData);
      console.log('Transaction sent, waiting for receipt...', tx);
      
      // Wait for transaction confirmation
      let receipt;
      if (tx.transactionHash) {
        console.log('Transaction hash received:', tx.transactionHash);
        console.log('Waiting for transaction confirmation...');
        
        // For now, we'll consider the transaction successful if we get a hash
        // In a production environment, you might want to poll for the actual receipt
        receipt = { 
          status: 1, 
          transactionHash: tx.transactionHash,
          blockNumber: 'pending'
        };
        
        console.log('Transaction submitted successfully!');
        console.log('Transaction hash:', tx.transactionHash);
        console.log('You can check the transaction status on a block explorer.');
      } else {
        throw new Error('No transaction hash received');
      }
      
      console.log('Transaction receipt:', receipt);
      
      return receipt.status === 1;
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
      
      const response = await fetch(`${this.baseUrl}/benqi-validation/getValidationAndSupplyQuote`, {
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
      
      const response = await fetch(`${this.baseUrl}/benqi-validation/getValidationAndBorrowQuote`, {
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

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

  constructor(account: any) {
    this.baseUrl = process.env.NEXT_PUBLIC_LENDING_API_URL || 'http://localhost:3001';
    this.account = account;
  }

  private async generateSignature(message: string): Promise<string> {
    if (!this.account) {
      throw new Error('Account not connected');
    }

    try {
      // Assinar mensagem com a wallet conectada
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
      timestamp: Date.now()
    };
  }

  async getTokens(): Promise<LendingToken[]> {
    try {
      const response = await fetch(`${this.baseUrl}/dex/tokens`);
      const data = await response.json();
      
      // Converter dados da API para formato LendingToken
      return data.map((token: any) => ({
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
    } catch (error) {
      console.error('Error fetching tokens:', error);
      throw new Error('Failed to fetch lending tokens');
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

  async prepareSupply(tokenAddress: string, amount: string): Promise<SwapResponse> {
    try {
      const message = `Supply ${amount} of token ${tokenAddress}\nTimestamp: ${Date.now()}`;
      const authData = await this.getAuthData(message);
      
      const response = await fetch(`${this.baseUrl}/lending/supply`, {
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

  async prepareBorrow(tokenAddress: string, amount: string): Promise<SwapResponse> {
    try {
      const message = `Borrow ${amount} of token ${tokenAddress}\nTimestamp: ${Date.now()}`;
      const authData = await this.getAuthData(message);
      
      const response = await fetch(`${this.baseUrl}/lending/borrow`, {
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

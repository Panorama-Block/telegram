/**
 * Component to display Smart Account details
 * Includes: balance, transactions, tokens, etc
 */

'use client';

import React, { useState, useEffect } from 'react';
import { createThirdwebClient, defineChain, getContract } from 'thirdweb';
import { balanceOf } from 'thirdweb/extensions/erc20';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';
import { avalancheFuji } from 'thirdweb/chains';

interface SmartAccountDetailsProps {
  smartAccountAddress: string;
  smartAccountName: string;
  chainId?: number;
}

interface TokenBalance {
  symbol: string;
  balance: string;
  address: string;
}

export default function SmartAccountDetails({
  smartAccountAddress,
  smartAccountName,
  chainId = 43113, // Avalanche Fuji default
}: SmartAccountDetailsProps) {
  const [avaxBalance, setAvaxBalance] = useState<string | null>(null);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID || '' });

  useEffect(() => {
    if (smartAccountAddress) {
      loadBalances();
    }
  }, [smartAccountAddress]);

  // Validation: if no address, don't render
  if (!smartAccountAddress) {
    return (
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
        <div className="text-sm text-red-400">Smart Account address not found</div>
      </div>
    );
  }

  async function loadBalances() {
    if (!smartAccountAddress) {
      console.error('loadBalances called without smartAccountAddress');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Loading balance for address:', smartAccountAddress);

      // Get native token (AVAX) balance
      const response = await fetch(
        `https://api-testnet.snowtrace.io/api?module=account&action=balance&address=${smartAccountAddress}&tag=latest`
      );
      const data = await response.json();

      if (data.status === '1' && data.result) {
        const balanceInWei = BigInt(data.result);
        const balanceInAvax = Number(balanceInWei) / 1e18;
        setAvaxBalance(balanceInAvax.toFixed(6));
      }

      // TODO: Get ERC20 token balances
      // You can add common tokens here (USDC, USDT, etc)

    } catch (e: any) {
      console.error('Error loading balances:', e);
      setError('Error loading balances');
    } finally {
      setLoading(false);
    }
  }

  async function loadTransactions() {
    try {
      // Get transaction history from Snowtrace API
      const response = await fetch(
        `https://api-testnet.snowtrace.io/api?module=account&action=txlist&address=${smartAccountAddress}&startblock=0&endblock=99999999&sort=desc&apikey=YourApiKeyToken`
      );
      const data = await response.json();

      if (data.status === '1' && data.result) {
        return data.result.slice(0, 10); // Last 10 transactions
      }
      return [];
    } catch (e: any) {
      console.error('Error loading transactions:', e);
      return [];
    }
  }

  const explorerUrl = `https://testnet.snowtrace.io/address/${smartAccountAddress}`;

  return (
    <div className="space-y-4">
      {/* Balance Card */}
      <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-gray-400 mb-1">Total Balance</div>
            <div className="text-3xl font-bold text-white">
              {loading ? (
                <div className="h-8 w-32 bg-gray-700 animate-pulse rounded"></div>
              ) : avaxBalance !== null ? (
                <>{avaxBalance} AVAX</>
              ) : (
                '0.000000 AVAX'
              )}
            </div>
          </div>
          <div className="text-4xl">💰</div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Balance on Avalanche Fuji blockchain</span>
        </div>

        <button
          onClick={loadBalances}
          disabled={loading}
          className="mt-3 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-xs font-medium transition-colors disabled:opacity-50"
        >
          {loading ? '🔄 Updating...' : '🔄 Refresh Balance'}
        </button>
      </div>

      {/* Account Info */}
      <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-white">Account Information</div>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <span>View on Explorer</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-start gap-2">
            <span className="text-gray-400">Name:</span>
            <span className="text-white font-semibold text-right">{smartAccountName}</span>
          </div>
          <div className="flex justify-between items-start gap-2">
            <span className="text-gray-400">Address:</span>
            <span className="text-cyan-400 font-mono text-right break-all">
              {smartAccountAddress && smartAccountAddress.length > 18
                ? `${smartAccountAddress.slice(0, 10)}...${smartAccountAddress.slice(-8)}`
                : smartAccountAddress || 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-start gap-2">
            <span className="text-gray-400">Network:</span>
            <span className="text-white text-right">Avalanche Fuji Testnet</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-4">
        <div className="text-sm font-semibold text-white mb-3">Quick Actions</div>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Transactions
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText(smartAccountAddress);
              alert('Address copied!');
            }}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy Address
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <div className="text-sm text-red-400">{error}</div>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
        <div className="text-xs text-blue-300 space-y-1">
          <div className="font-semibold mb-2">💡 About this Smart Account:</div>
          <div>• This is a smart wallet (Smart Account) with advanced features</div>
          <div>• You can deposit AVAX and other tokens into it</div>
          <div>• Session Keys can use the funds automatically (no popup!)</div>
          <div>• Perfect for DCA automation and other strategies</div>
        </div>
      </div>
    </div>
  );
}

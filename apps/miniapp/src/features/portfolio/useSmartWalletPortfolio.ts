/**
 * Hook for fetching Smart Wallet data in Portfolio
 * Integrates with DCA service to show Smart Account balances
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createThirdwebClient, defineChain, getContract, readContract, toTokens } from 'thirdweb';
import { getWalletBalance } from 'thirdweb/wallets';
import { useActiveAccount } from 'thirdweb/react';
import { getUserAccounts, SmartAccount, getAccountStrategies, DCAStrategy } from '@/features/dca/api';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';
import { networks } from '@/features/swap/tokens';
import { isNative } from '@/features/swap/utils';
import { PortfolioAsset, PortfolioStats } from './types';

// Fallback prices
const FALLBACK_PRICES: Record<string, number> = {
  'ETH': 3900,
  'WETH': 3900,
  'AVAX': 50,
  'WAVAX': 50,
  'USDC': 1.00,
  'USDT': 1.00,
  'DAI': 1.00,
};

async function fetchRealPrices(): Promise<Record<string, number>> {
  try {
    const ids = 'ethereum,avalanche-2,usd-coin,tether,dai';
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { next: { revalidate: 60 } } as RequestInit
    );
    if (!response.ok) throw new Error('Price fetch failed');
    const data = await response.json();
    return {
      'ETH': data.ethereum?.usd || FALLBACK_PRICES['ETH'],
      'WETH': data.ethereum?.usd || FALLBACK_PRICES['WETH'],
      'AVAX': data['avalanche-2']?.usd || FALLBACK_PRICES['AVAX'],
      'WAVAX': data['avalanche-2']?.usd || FALLBACK_PRICES['WAVAX'],
      'USDC': data['usd-coin']?.usd || 1,
      'USDT': data.tether?.usd || 1,
      'DAI': data.dai?.usd || 1,
    };
  } catch {
    return FALLBACK_PRICES;
  }
}

export interface SmartWalletPortfolioData {
  smartAccounts: SmartAccount[];
  selectedAccount: SmartAccount | null;
  assets: PortfolioAsset[];
  stats: PortfolioStats;
  strategies: DCAStrategy[];
  loading: boolean;
  loadingAssets: boolean;
  error: string | null;
  hasSmartWallet: boolean;
  selectAccount: (account: SmartAccount | null) => void;
  refresh: () => Promise<void>;
  refreshAssets: () => Promise<void>;
}

export function useSmartWalletPortfolio(): SmartWalletPortfolioData {
  const account = useActiveAccount();
  const [smartAccounts, setSmartAccounts] = useState<SmartAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<SmartAccount | null>(null);
  const [assets, setAssets] = useState<PortfolioAsset[]>([]);
  const [strategies, setStrategies] = useState<DCAStrategy[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>(FALLBACK_PRICES);

  const client = useMemo(() => createThirdwebClient({
    clientId: THIRDWEB_CLIENT_ID || ''
  }), []);

  // Fetch Smart Accounts using connected wallet address
  const fetchSmartAccounts = useCallback(async () => {
    if (!account?.address) return;

    setLoading(true);
    setError(null);

    try {
      const accounts = await getUserAccounts(account.address);
      setSmartAccounts(accounts);

      // Auto-select first account if available
      if (accounts.length > 0 && !selectedAccount) {
        setSelectedAccount(accounts[0]);
      }
    } catch (err: any) {
      console.error('Error fetching smart accounts:', err);
      setError(err.message || 'Failed to fetch smart accounts');
      setSmartAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [account?.address, selectedAccount]);

  // Fetch balances for selected Smart Account
  const fetchAssets = useCallback(async () => {
    if (!selectedAccount || !client) return;

    setLoadingAssets(true);
    const newAssets: PortfolioAsset[] = [];

    try {
      // Fetch real prices
      const currentPrices = await fetchRealPrices();
      setPrices(currentPrices);

      // Fetch balances across networks
      const tasks = networks.flatMap(network =>
        network.tokens.map(async (token) => {
          try {
            const chain = defineChain(network.chainId);
            let balanceRaw = 0n;
            let balanceStr = "0";

            if (isNative(token.address)) {
              try {
                const result = await getWalletBalance({
                  address: selectedAccount.address as `0x${string}`,
                  client,
                  chain,
                });
                balanceRaw = result.value;
                balanceStr = result.displayValue;
              } catch {
                // Silent fail
              }
            } else {
              const contract = getContract({
                client,
                chain,
                address: token.address
              });

              try {
                balanceRaw = await readContract({
                  contract,
                  method: "function balanceOf(address) view returns (uint256)",
                  params: [selectedAccount.address as `0x${string}`]
                });
                const decimal = token.decimals || 18;
                balanceStr = toTokens(balanceRaw, decimal);
              } catch {
                // Silent fail
              }
            }

            if (balanceRaw > 0n) {
              const price = currentPrices[token.symbol] || 0;
              const value = parseFloat(balanceStr) * price;

              if (value > 0.01 || parseFloat(balanceStr) > 0.000001) {
                const formattedPrice = price > 0
                  ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '-';

                const formattedValue = value > 0
                  ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '-';

                newAssets.push({
                  symbol: token.symbol,
                  name: token.name || token.symbol,
                  network: network.name,
                  protocol: 'Smart Wallet',
                  address: token.address,
                  decimals: token.decimals || 18,
                  balance: `${parseFloat(balanceStr).toLocaleString('en-US', { maximumFractionDigits: 4 })} ${token.symbol}`,
                  balanceRaw: balanceRaw.toString(),
                  price: formattedPrice,
                  value: formattedValue,
                  valueRaw: value,
                  isPositive: true,
                  apy: '-',
                  icon: token.icon,
                  actions: ['Withdraw', 'DCA']
                });
              }
            }
          } catch {
            // Silent fail
          }
        })
      );

      await Promise.allSettled(tasks);
      newAssets.sort((a, b) => b.valueRaw - a.valueRaw);
      setAssets(newAssets);

      // Fetch strategies for selected account
      if (selectedAccount) {
        try {
          const accountStrategies = await getAccountStrategies(
            selectedAccount.address,
            account?.address.toString()
          );
          setStrategies(accountStrategies);
        } catch {
          setStrategies([]);
        }
      }
    } catch (err: any) {
      console.error('Error fetching smart wallet assets:', err);
    } finally {
      setLoadingAssets(false);
    }
  }, [selectedAccount, client, account?.address]);

  // Initial fetch
  useEffect(() => {
    fetchSmartAccounts();
  }, [fetchSmartAccounts]);

  // Fetch assets when account selected
  useEffect(() => {
    if (selectedAccount) {
      fetchAssets();
    } else {
      setAssets([]);
      setStrategies([]);
    }
  }, [selectedAccount, fetchAssets]);

  // Calculate stats
  const stats: PortfolioStats = useMemo(() => {
    const totalValue = assets.reduce((acc, curr) => acc + curr.valueRaw, 0);

    const stablecoins = assets
      .filter(a => ['USDC', 'USDT', 'DAI'].includes(a.symbol))
      .reduce((acc, c) => acc + c.valueRaw, 0);
    const bluechips = assets
      .filter(a => ['ETH', 'BTC', 'WBTC', 'WETH', 'AVAX', 'BNB', 'MATIC'].includes(a.symbol))
      .reduce((acc, c) => acc + c.valueRaw, 0);
    const altcoins = totalValue - stablecoins - bluechips;

    return {
      netWorth: `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      netWorthRaw: totalValue,
      pnl24h: '+$0.00',
      pnl24hPercent: '0.00%',
      isPositive: true,
      allocation: [
        { label: 'Blue Chips', value: totalValue > 0 ? (bluechips / totalValue) * 100 : 0, color: 'bg-indigo-500' },
        { label: 'Stablecoins', value: totalValue > 0 ? (stablecoins / totalValue) * 100 : 0, color: 'bg-emerald-500' },
        { label: 'Altcoins', value: totalValue > 0 ? (altcoins / totalValue) * 100 : 0, color: 'bg-orange-500' },
      ]
    };
  }, [assets]);

  const selectAccount = useCallback((account: SmartAccount | null) => {
    setSelectedAccount(account);
  }, []);

  return {
    smartAccounts,
    selectedAccount,
    assets,
    stats,
    strategies,
    loading,
    loadingAssets,
    error,
    hasSmartWallet: smartAccounts.length > 0,
    selectAccount,
    refresh: fetchSmartAccounts,
    refreshAssets: fetchAssets,
  };
}

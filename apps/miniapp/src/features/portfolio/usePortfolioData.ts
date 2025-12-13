import { useState, useEffect, useMemo, useCallback } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { createThirdwebClient, defineChain, getContract, readContract, toTokens } from "thirdweb";
import { getWalletBalance } from "thirdweb/wallets";
import { networks } from "@/features/swap/tokens";
import { PortfolioAsset, PortfolioStats } from './types';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';
import { isNative } from '@/features/swap/utils';

// Mock prices for demonstration until we have a real price feed
const MOCK_PRICES: Record<string, number> = {
  'ETH': 2650.50,
  'WETH': 2650.50,
  'BTC': 68500.20,
  'WBTC': 68500.20,
  'USDC': 1.00,
  'USDT': 1.00,
  'DAI': 1.00,
  'MATIC': 0.85,
  'AVAX': 35.40,
  'WAVAX': 35.40,
  'BNB': 580.10,
  'ARB': 1.20,
  'OP': 2.50,
  'WLD': 4.80,
  'Confraria': 0.10,
  'AAVE': 95.20,
  'UNI': 8.50,
  'LINK': 14.20
};

export function usePortfolioData() {
  const account = useActiveAccount();
  const [assets, setAssets] = useState<PortfolioAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const client = useMemo(() => createThirdwebClient({ 
    clientId: THIRDWEB_CLIENT_ID || '' 
  }), []);

  const fetchPortfolio = useCallback(async () => {
    if (!account || !client) return;
    
    setLoading(true);
    const newAssets: PortfolioAsset[] = [];

    // Flatten all tokens to fetch
    const tasks = networks.flatMap(network => 
      network.tokens.map(async (token) => {
        try {
          const chain = defineChain(network.chainId);
          let balanceRaw = 0n;
          let balanceStr = "0";

          if (isNative(token.address)) {
             try {
               const result = await getWalletBalance({
                 address: account.address,
                 client,
                 chain,
               });
               balanceRaw = result.value;
               balanceStr = result.displayValue;
             } catch (e) {
               // console.warn('Native fetch failed', e);
             }
          } else {
             // ERC20 Balance
             const contract = getContract({
               client,
               chain,
               address: token.address
             });

             try {
                balanceRaw = await readContract({
                    contract,
                    method: "function balanceOf(address) view returns (uint256)",
                    params: [account.address]
                });
                const decimal = token.decimals || 18;
                balanceStr = toTokens(balanceRaw, decimal);
             } catch (e) {
                // console.warn('ERC20 fetch failed', e);
             }
          }

          if (balanceRaw > 0n) {
            const price = MOCK_PRICES[token.symbol] || 0;
            const value = parseFloat(balanceStr) * price;

            // Only add significant balances
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
                protocol: 'Wallet',
                address: token.address,
                decimals: token.decimals || 18,
                balance: `${parseFloat(balanceStr).toLocaleString('en-US', { maximumFractionDigits: 4 })} ${token.symbol}`,
                balanceRaw: balanceRaw.toString(),
                price: formattedPrice,
                value: formattedValue,
                valueRaw: value,
                isPositive: true, // Mock
                apy: '-',
                icon: token.icon,
                actions: ['Swap']
              });
            }
          }
        } catch (e) {
          // Silent fail for individual token fetch errors
        }
      })
    );

    await Promise.allSettled(tasks);

    // Sort by value desc
    newAssets.sort((a, b) => b.valueRaw - a.valueRaw);

    setAssets(newAssets);
    setLoading(false);
    setLastUpdated(new Date());

  }, [account, client]);

  // Initial fetch
  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 60000);
    return () => clearInterval(interval);
  }, [fetchPortfolio]);

  const stats: PortfolioStats = useMemo(() => {
    const totalValue = assets.reduce((acc, curr) => acc + curr.valueRaw, 0);
    
    // Simple allocation logic
    const stablecoins = assets.filter(a => ['USDC', 'USDT', 'DAI'].includes(a.symbol)).reduce((acc, c) => acc + c.valueRaw, 0);
    const bluechips = assets.filter(a => ['ETH', 'BTC', 'WBTC', 'WETH', 'AVAX', 'BNB', 'MATIC'].includes(a.symbol)).reduce((acc, c) => acc + c.valueRaw, 0);
    const altcoins = totalValue - stablecoins - bluechips;

    return {
      netWorth: `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      netWorthRaw: totalValue,
      pnl24h: '+$0.00', // Mock
      pnl24hPercent: '0.00%', // Mock
      isPositive: true,
      allocation: [
        { label: 'Blue Chips', value: totalValue > 0 ? (bluechips / totalValue) * 100 : 0, color: 'bg-indigo-500' },
        { label: 'Stablecoins', value: totalValue > 0 ? (stablecoins / totalValue) * 100 : 0, color: 'bg-emerald-500' },
        { label: 'Altcoins', value: totalValue > 0 ? (altcoins / totalValue) * 100 : 0, color: 'bg-orange-500' },
      ]
    };
  }, [assets]);

  return {
    assets,
    stats,
    loading,
    refresh: fetchPortfolio,
    lastUpdated
  };
}

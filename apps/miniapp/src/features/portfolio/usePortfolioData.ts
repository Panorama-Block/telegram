import { useState, useEffect, useMemo, useCallback } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { createThirdwebClient, defineChain, getContract, readContract, toTokens } from "thirdweb";
import { getWalletBalance } from "thirdweb/wallets";
import { networks } from "@/features/swap/tokens";
import { PortfolioAsset, PortfolioStats } from './types';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';
import { isNative } from '@/features/swap/utils';

// Fallback prices - will be overwritten by real API prices when available
// Only includes major tokens with reliable market prices
const FALLBACK_PRICES: Record<string, number> = {
  'ETH': 3900,
  'WETH': 3900,
  'BTC': 101000,
  'WBTC': 101000,
  'USDC': 1.00,
  'USDT': 1.00,
  'DAI': 1.00,
  'MATIC': 0.55,
  'POL': 0.55,
  'AVAX': 50,
  'WAVAX': 50,
  'BNB': 720,
  'ARB': 0.85,
  'OP': 2.30,
  'WLD': 2.50,
  'AAVE': 370,
  'UNI': 17,
  'LINK': 28
};

// Fetch real prices from CoinGecko
async function fetchRealPrices(): Promise<Record<string, number>> {
  try {
    const ids = 'ethereum,bitcoin,usd-coin,tether,dai,matic-network,avalanche-2,binancecoin,arbitrum,optimism,worldcoin-wld,aave,uniswap,chainlink';
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { next: { revalidate: 60 } } // Cache for 60 seconds
    );

    if (!response.ok) throw new Error('Price fetch failed');

    const data = await response.json();

    return {
      'ETH': data.ethereum?.usd || FALLBACK_PRICES['ETH'],
      'WETH': data.ethereum?.usd || FALLBACK_PRICES['WETH'],
      'BTC': data.bitcoin?.usd || FALLBACK_PRICES['BTC'],
      'WBTC': data.bitcoin?.usd || FALLBACK_PRICES['WBTC'],
      'USDC': data['usd-coin']?.usd || 1,
      'USDT': data.tether?.usd || 1,
      'DAI': data.dai?.usd || 1,
      'MATIC': data['matic-network']?.usd || FALLBACK_PRICES['MATIC'],
      'POL': data['matic-network']?.usd || FALLBACK_PRICES['POL'],
      'AVAX': data['avalanche-2']?.usd || FALLBACK_PRICES['AVAX'],
      'WAVAX': data['avalanche-2']?.usd || FALLBACK_PRICES['WAVAX'],
      'BNB': data.binancecoin?.usd || FALLBACK_PRICES['BNB'],
      'ARB': data.arbitrum?.usd || FALLBACK_PRICES['ARB'],
      'OP': data.optimism?.usd || FALLBACK_PRICES['OP'],
      'WLD': data['worldcoin-wld']?.usd || FALLBACK_PRICES['WLD'],
      'AAVE': data.aave?.usd || FALLBACK_PRICES['AAVE'],
      'UNI': data.uniswap?.usd || FALLBACK_PRICES['UNI'],
      'LINK': data.chainlink?.usd || FALLBACK_PRICES['LINK'],
    };
  } catch (e) {
    console.warn('Failed to fetch real prices, using fallback:', e);
    return FALLBACK_PRICES;
  }
}

export function usePortfolioData() {
  const account = useActiveAccount();
  const [assets, setAssets] = useState<PortfolioAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>(FALLBACK_PRICES);

  const client = useMemo(() => createThirdwebClient({
    clientId: THIRDWEB_CLIENT_ID || ''
  }), []);

  const fetchPortfolio = useCallback(async () => {
    if (!account || !client) return;

    setLoading(true);
    const newAssets: PortfolioAsset[] = [];

    // Fetch real prices first
    const currentPrices = await fetchRealPrices();
    setPrices(currentPrices);

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
            const price = currentPrices[token.symbol] || 0;
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

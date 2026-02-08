import { useState, useEffect, useMemo, useCallback } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { createThirdwebClient, defineChain, getContract, readContract, toTokens } from "thirdweb";
import { getWalletBalance } from "thirdweb/wallets";
import { networks, TON_CHAIN_ID } from "@/features/swap/tokens";
import { PortfolioAsset, PortfolioStats } from './types';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';
import { isNative } from '@/features/swap/utils';
import { useTonAddress, useTonWallet } from '@tonconnect/ui-react';

// Fallback prices - will be overwritten by real API prices when available
// Only includes major tokens with reliable market prices
const FALLBACK_PRICES: Record<string, number> = {
  'ETH': 3900,
  'WETH': 3900,
  // Lido LSTs (fallback to ETH peg when real price is unavailable)
  'stETH': 3900,
  'wstETH': 3900,
  // Stablecoins
  'USDe': 1.00,
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
  'LINK': 28,
  'TON': 5.50
};

// Fetch real prices from CoinGecko
async function fetchRealPrices(): Promise<Record<string, number>> {
  try {
    const ids = 'ethereum,staked-ether,wrapped-steth,ethena-usde,bitcoin,usd-coin,tether,dai,matic-network,avalanche-2,binancecoin,arbitrum,optimism,worldcoin-wld,aave,uniswap,chainlink,the-open-network,toncoin';
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { next: { revalidate: 60 } }
    );

    if (!response.ok) throw new Error('Price fetch failed');

    const data = await response.json();

    const ethUsd = data.ethereum?.usd || FALLBACK_PRICES['ETH'];

    return {
      'ETH': ethUsd,
      'WETH': ethUsd,
      // Lido LSTs: prefer their own CoinGecko ids, otherwise fallback to ETH
      'stETH': data['staked-ether']?.usd || ethUsd,
      'wstETH': data['wrapped-steth']?.usd || ethUsd,
      'USDe': data['ethena-usde']?.usd || 1,
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
      'TON': data['the-open-network']?.usd || data.toncoin?.usd || FALLBACK_PRICES['TON'],
    };
  } catch (e) {
    console.warn('Failed to fetch real prices, using fallback:', e);
    return FALLBACK_PRICES;
  }
}

type TonNetworkHint = 'mainnet' | 'testnet';
const TON_USDT_MASTER_ADDRESS = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';

function formatUnits(value: bigint, decimals: number): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction = abs % base;

  if (fraction === 0n) return `${negative ? '-' : ''}${whole.toString()}`;

  const fracStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole.toString()}.${fracStr}`;
}

async function fetchTonBalance(rawAddress: string, networkHint: TonNetworkHint): Promise<string | null> {
  try {
    const [{ getHttpEndpoint }, { TonClient }, { Address, fromNano }] = await Promise.all([
      import('@orbs-network/ton-access'),
      import('@ton/ton'),
      import('@ton/core'),
    ]);
    const endpoint = await getHttpEndpoint({ network: networkHint });
    const client = new TonClient({ endpoint });
    const addr = Address.parse(rawAddress);
    const bal = await client.getBalance(addr);
    return fromNano(bal);
  } catch (e) {
    console.warn('Failed to fetch TON balance:', e);
    return null;
  }
}

async function fetchTonJettonBalance(
  rawAddress: string,
  networkHint: TonNetworkHint,
  jettonMasterAddress: string,
  decimals: number
): Promise<string | null> {
  try {
    const [{ getHttpEndpoint }, { TonClient, Address, beginCell }] = await Promise.all([
      import('@orbs-network/ton-access'),
      import('@ton/ton'),
    ]);

    const endpoint = await getHttpEndpoint({ network: networkHint });
    const client = new TonClient({ endpoint });
    const userAddress = Address.parse(rawAddress);
    const master = Address.parse(jettonMasterAddress);

    const jettonWalletResp = await client.runMethod(master, 'get_wallet_address', [
      { type: 'slice', cell: beginCell().storeAddress(userAddress).endCell() }
    ]);
    const jettonWalletAddress = jettonWalletResp.stack.readAddress();

    const walletDataResp = await client.runMethod(jettonWalletAddress, 'get_wallet_data');
    const rawBalance = walletDataResp.stack.readBigNumber();
    return formatUnits(rawBalance, decimals);
  } catch (e) {
    console.warn('Failed to fetch TON jetton balance:', e);
    return null;
  }
}

export function usePortfolioData() {
  const account = useActiveAccount();
  const tonWallet = useTonWallet();
  const tonAddress = useTonAddress();
  const [assets, setAssets] = useState<PortfolioAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>(FALLBACK_PRICES);

  const tonNetwork: TonNetworkHint = useMemo(() => {
    const chain: any = (tonWallet as any)?.account?.chain;
    if (chain === 'testnet' || chain === TON_CHAIN_ID) {
      return 'testnet';
    }
    if (chain === 'mainnet' || chain === -3) {
      return 'mainnet';
    }
    return 'mainnet';
  }, [tonWallet]);

  const client = useMemo(() => createThirdwebClient({
    clientId: THIRDWEB_CLIENT_ID || ''
  }), []);

  const fetchPortfolio = useCallback(async () => {
    // Allow TON-only users (no EVM wallet connected)
    if (!account && !tonAddress) {
      setAssets([]);
      return;
    }
    if (!client) return;

    setLoading(true);
    const newAssets: PortfolioAsset[] = [];

    // Fetch real prices first
    const currentPrices = await fetchRealPrices();
    setPrices(currentPrices);

    // Fetch TON balance in parallel (if connected)
    const tonBalancePromise = tonAddress
      ? fetchTonBalance(tonAddress, tonNetwork)
      : Promise.resolve(null);
    const tonUsdtBalancePromise = tonAddress && tonNetwork === 'mainnet'
      ? fetchTonJettonBalance(tonAddress, tonNetwork, TON_USDT_MASTER_ADDRESS, 6)
      : Promise.resolve(null);

    // Flatten all EVM tokens to fetch (skip TON network)
    const tasks = account
      ? networks
          .filter(network => network.chainId !== TON_CHAIN_ID)
          .flatMap(network =>
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
                protocol: token.symbol === 'stETH' || token.symbol === 'wstETH' ? 'Lido' : 'Wallet',
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
    )
      : [];

    await Promise.allSettled(tasks);

    const tonBalance = await tonBalancePromise;
    const tonValue = tonBalance ? parseFloat(tonBalance) : 0;
    if (tonAddress && tonBalance && tonValue > 0) {
      const price = currentPrices['TON'] || 0;
      const value = tonValue * price;
      const formattedPrice = price > 0
        ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '-';
      const formattedValue = value > 0
        ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '-';

      newAssets.push({
        symbol: 'TON',
        name: 'Toncoin',
        network: 'TON',
        protocol: 'Wallet',
        address: tonAddress,
        decimals: 9,
        balance: `${tonValue.toLocaleString('en-US', { maximumFractionDigits: 4 })} TON`,
        balanceRaw: tonBalance,
        price: formattedPrice,
        value: formattedValue,
        valueRaw: value,
        isPositive: true,
        apy: '-',
        icon: 'https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png',
        actions: ['Swap']
      });
    }

    const tonUsdtBalance = await tonUsdtBalancePromise;
    const tonUsdtAmount = tonUsdtBalance ? parseFloat(tonUsdtBalance) : 0;
    if (tonAddress && tonUsdtBalance && tonUsdtAmount > 0) {
      const price = currentPrices['USDT'] || 1;
      const value = tonUsdtAmount * price;
      const formattedPrice = `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const formattedValue = `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      newAssets.push({
        symbol: 'USDT',
        name: 'Tether USD',
        network: 'TON',
        protocol: 'Wallet',
        address: TON_USDT_MASTER_ADDRESS,
        decimals: 6,
        balance: `${tonUsdtAmount.toLocaleString('en-US', { maximumFractionDigits: 4 })} USDT`,
        balanceRaw: tonUsdtBalance,
        price: formattedPrice,
        value: formattedValue,
        valueRaw: value,
        isPositive: true,
        apy: '-',
        icon: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
        actions: ['Swap']
      });
    }

    // Sort by value desc
    newAssets.sort((a, b) => b.valueRaw - a.valueRaw);

    setAssets(newAssets);
    setLoading(false);
    setLastUpdated(new Date());

  }, [account, tonAddress, tonNetwork, client]);

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

export type Token = {
  symbol: string;
  address: string;
  icon?: string;
  decimals?: number;
  name?: string;
};
export type Network = {
  nativeCurrency?: any; chainId: number; name: string; tokens: Token[]
};

export const networks: Network[] = [
  {
    chainId: 43114,
    name: 'Avalanche',
    tokens: [
      { symbol: 'AVAX', address: '0x0000000000000000000000000000000000000000', icon: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png', decimals: 18, name: 'Avalanche' },
      { symbol: 'WAVAX', address: '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7', icon: 'https://assets.coingecko.com/coins/images/15075/small/wrapped-avax.png', decimals: 18, name: 'Wrapped AVAX' },
      { symbol: 'UNI', address: '0x8eBAf22B6F053dFFeaf46f4Dd9eFA95D89ba8580', icon: 'https://assets.coingecko.com/coins/images/12504/small/uni.jpg', decimals: 18, name: 'Uniswap' },
      { symbol: 'USDC', address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', icon: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png', decimals: 6, name: 'USD Coin' },
      { symbol: 'USDT', address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', icon: 'https://assets.coingecko.com/coins/images/325/small/Tether.png', decimals: 6, name: 'Tether USD' },
      { symbol: 'AAVE', address: '0x8ce2dee54bb9921a2ae0a63dbb2df8ed88b91dd9', icon: 'https://assets.coingecko.com/coins/images/12645/small/aave-token-round.png', decimals: 18, name: 'Aave' },
      { symbol: 'BTC.b', address: '0x152b9d0FdC40C096757F570A51E494bd4b943E50', icon: 'https://assets.coingecko.com/coins/images/26115/small/btcb.png', decimals: 8, name: 'Bitcoin (Bridged)' },
      { symbol: 'JOE', address: '0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd', icon: 'https://assets.coingecko.com/coins/images/17569/small/traderjoe.png', decimals: 18, name: 'JoeToken' },
      { symbol: 'MIM', address: '0x130966628846BFd36ff31a822705796e8cb8C18D', icon: 'https://assets.coingecko.com/coins/images/16786/small/mimlogopng.png', decimals: 18, name: 'Magic Internet Money' },
    ],
  },
  {
    chainId: 1,
    name: 'Ethereum',
    tokens: [
      { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000', icon: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png', decimals: 18, name: 'Ethereum' },
      { symbol: 'USDC', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', icon: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png', decimals: 6, name: 'USD Coin' },
      { symbol: 'USDT', address: '0xdac17f958d2ee523a2206206994597c13d831ec7', icon: 'https://assets.coingecko.com/coins/images/325/small/Tether.png', decimals: 6, name: 'Tether USD' },
      { symbol: 'WBTC', address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', icon: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png', decimals: 8, name: 'Wrapped Bitcoin' },
      { symbol: 'AAVE', address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', icon: 'https://assets.coingecko.com/coins/images/12645/small/aave-token-round.png', decimals: 18, name: 'Aave' },
      { symbol: 'UNI', address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', icon: 'https://assets.coingecko.com/coins/images/12504/small/uni.jpg', decimals: 18, name: 'Uniswap' },
      { symbol: 'LINK', address: '0x514910771af9ca656af840dff83e8264ecf986ca', icon: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png', decimals: 18, name: 'Chainlink' },
      { symbol: 'LDO', address: '0x5a98fcbea516cf06857215779fd812ca3bef1b32', icon: 'https://assets.coingecko.com/coins/images/13573/small/Lido_DAO.png', decimals: 18, name: 'Lido DAO' },
      { symbol: 'USDe', address: '0x4c9edd5852cd905f086c759e8383e09bff1e68b3', icon: 'https://assets.coingecko.com/coins/images/33613/small/USDE.png', decimals: 18, name: 'Ethena USDe' },
    ],
  },
  {
    chainId: 56,
    name: 'Binance Smart Chain',
    tokens: [
      { symbol: 'USDT', address: '0x55d398326f99059ff775485246999027b3197955', icon: 'https://assets.coingecko.com/coins/images/325/small/Tether.png', decimals: 18, name: 'Tether USD' },
      { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', icon: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png', decimals: 18, name: 'USD Coin' },
      { symbol: 'CAKE', address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82', icon: 'https://assets.coingecko.com/coins/images/12632/small/IMG_0440.PNG', decimals: 18, name: 'PancakeSwap' },
      { symbol: 'ADA', address: '0x3ee2200efb3400fabb9aacf31297cbdd1d435d47', icon: 'https://assets.coingecko.com/coins/images/975/small/cardano.png', decimals: 18, name: 'Cardano' },
      { symbol: 'DOGE', address: '0xba2ae424d960c8cC2239327C5EDb3A432268e5831', icon: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png', decimals: 8, name: 'Dogecoin' },
      { symbol: 'XRP', address: '0x1d2f0da169ceb9fc7b3144628db156f3f6c60dbe', icon: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png', decimals: 18, name: 'XRP' },
      { symbol: 'DOT', address: '0x7083609fce4d1d8dc0c979aab8c869ea2c873402', icon: 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png', decimals: 18, name: 'Polkadot' },
      { symbol: 'TUSD', address: '0x40af3827F39D0EAcBF4A168f8D4ee67c121D11c9', icon: 'https://assets.coingecko.com/coins/images/3449/small/tusd.png', decimals: 18, name: 'TrueUSD' },
    ],
  },
  {
    chainId: 137,
    name: 'Polygon',
    tokens: [
      { symbol: 'USDT', address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', icon: 'https://assets.coingecko.com/coins/images/325/small/Tether.png', decimals: 6, name: 'Tether USD' },
      { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', icon: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png', decimals: 6, name: 'USD Coin' },
      { symbol: 'WETH', address: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619', icon: 'https://assets.coingecko.com/coins/images/2518/small/weth.png', decimals: 18, name: 'Wrapped Ether' },
      { symbol: 'DAI', address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', icon: 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png', decimals: 18, name: 'Dai Stablecoin' },
      { symbol: 'QUICK', address: '0xb5c064f955d8e7f38fe0460c556a72987494ee17', icon: 'https://assets.coingecko.com/coins/images/13970/small/1_pOU6pBMEmiL-ZJVb0CYRjQ.png', decimals: 18, name: 'QuickSwap' },
      { symbol: 'AAVE', address: '0xd6df932a45c0f255f85145f286ea0b292b21c90b', icon: 'https://assets.coingecko.com/coins/images/12645/small/aave-token-round.png', decimals: 18, name: 'Aave' },
      { symbol: 'SAND', address: '0xbbba073c31bf03b8acf7c28ef0738decf3695683', icon: 'https://assets.coingecko.com/coins/images/12129/small/sandbox_logo.jpg', decimals: 18, name: 'The Sandbox' },
    ],
  },
  {
    chainId: 42161,
    name: 'Arbitrum',
    tokens: [
      { symbol: 'ARB', address: '0x912CE59144191C1204E64559FE8253a0e49E6548', icon: 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg', decimals: 18, name: 'Arbitrum' },
      { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', icon: 'https://assets.coingecko.com/coins/images/325/small/Tether.png', decimals: 6, name: 'Tether USD' },
      { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', icon: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png', decimals: 6, name: 'USD Coin' },
      { symbol: 'ETH', address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', icon: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png', decimals: 18, name: 'Ethereum' },
      { symbol: 'GMX', address: '0xfc5a1a6eb076a2c7ad06ed22c90d7e710e35ad0a', icon: 'https://assets.coingecko.com/coins/images/18323/small/arbit.png', decimals: 18, name: 'GMX' },
    ],
  },
  {
    chainId: 8453,
    name: 'Base',
    tokens: [
      { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', icon: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png', decimals: 6, name: 'USD Coin' },
      { symbol: 'ETH', address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', icon: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png', decimals: 18, name: 'Ethereum' },
      { symbol: 'cbBTC', address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', icon: 'https://assets.coingecko.com/coins/images/40489/small/cbBTC.png', decimals: 8, name: 'Coinbase Wrapped BTC' },
      { symbol: 'AERO', address: '0x940181a94a35a4569e4529a3cdfb74e38fd98631', icon: 'https://assets.coingecko.com/coins/images/31745/small/token.png', decimals: 18, name: 'Aerodrome' },
    ],
  },
  {
    chainId: 10,
    name: 'Optimism',
    tokens: [
      { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', icon: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png', decimals: 6, name: 'USD Coin' },
      { symbol: 'USDT', address: '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58', icon: 'https://assets.coingecko.com/coins/images/325/small/Tether.png', decimals: 6, name: 'Tether USD' },
      { symbol: 'OP', address: '0x4200000000000000000000000000000000000042', icon: 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png', decimals: 18, name: 'Optimism' },
    ],
  },
];


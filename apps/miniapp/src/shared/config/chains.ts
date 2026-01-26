/**
 * Chain Configuration for Network Guard
 *
 * Extended chain metadata for wallet_addEthereumChain support
 * and network switching UX.
 */

export interface ChainConfig {
  chainId: number;
  name: string;
  shortName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
  iconUrl?: string;
  isTestnet: boolean;
}

/**
 * Supported EVM chains configuration
 * Indexed by chainId for O(1) lookup
 */
export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  1: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    shortName: 'Ethereum',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://eth.llamarpc.com', 'https://rpc.ankr.com/eth', 'https://ethereum.publicnode.com'],
    blockExplorerUrls: ['https://etherscan.io'],
    iconUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    isTestnet: false,
  },
  56: {
    chainId: 56,
    name: 'BNB Smart Chain',
    shortName: 'BSC',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.defibit.io', 'https://bsc.publicnode.com'],
    blockExplorerUrls: ['https://bscscan.com'],
    iconUrl: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
    isTestnet: false,
  },
  137: {
    chainId: 137,
    name: 'Polygon Mainnet',
    shortName: 'Polygon',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrls: ['https://polygon-rpc.com', 'https://rpc.ankr.com/polygon', 'https://polygon.publicnode.com'],
    blockExplorerUrls: ['https://polygonscan.com'],
    iconUrl: 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
    isTestnet: false,
  },
  43114: {
    chainId: 43114,
    name: 'Avalanche C-Chain',
    shortName: 'Avalanche',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    rpcUrls: ['https://api.avax.network/ext/bc/C/rpc', 'https://rpc.ankr.com/avalanche', 'https://avalanche.publicnode.com'],
    blockExplorerUrls: ['https://snowtrace.io'],
    iconUrl: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
    isTestnet: false,
  },
  42161: {
    chainId: 42161,
    name: 'Arbitrum One',
    shortName: 'Arbitrum',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://arb1.arbitrum.io/rpc', 'https://rpc.ankr.com/arbitrum', 'https://arbitrum.publicnode.com'],
    blockExplorerUrls: ['https://arbiscan.io'],
    iconUrl: 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg',
    isTestnet: false,
  },
  8453: {
    chainId: 8453,
    name: 'Base',
    shortName: 'Base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.base.org', 'https://base.publicnode.com', 'https://rpc.ankr.com/base'],
    blockExplorerUrls: ['https://basescan.org'],
    iconUrl: 'https://assets.coingecko.com/coins/images/32594/small/base.png',
    isTestnet: false,
  },
  10: {
    chainId: 10,
    name: 'OP Mainnet',
    shortName: 'Optimism',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.optimism.io', 'https://rpc.ankr.com/optimism', 'https://optimism.publicnode.com'],
    blockExplorerUrls: ['https://optimistic.etherscan.io'],
    iconUrl: 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png',
    isTestnet: false,
  },
  480: {
    chainId: 480,
    name: 'World Chain',
    shortName: 'World',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://worldchain-mainnet.g.alchemy.com/public'],
    blockExplorerUrls: ['https://worldscan.org'],
    iconUrl: 'https://assets.coingecko.com/coins/images/31069/small/worldcoin.jpeg',
    isTestnet: false,
  },
};

/**
 * Get chain config by chainId
 */
export function getChainConfig(chainId: number): ChainConfig | undefined {
  return SUPPORTED_CHAINS[chainId];
}

/**
 * Get chain name by chainId (with fallback)
 */
export function getChainName(chainId: number): string {
  return SUPPORTED_CHAINS[chainId]?.shortName ?? `Chain ${chainId}`;
}

/**
 * Check if chain is supported
 */
export function isChainSupported(chainId: number): boolean {
  return chainId in SUPPORTED_CHAINS;
}

/**
 * Get all supported chain IDs
 */
export function getSupportedChainIds(): number[] {
  return Object.keys(SUPPORTED_CHAINS).map(Number);
}

/**
 * Format chainId to hex string for wallet RPC calls
 */
export function chainIdToHex(chainId: number): string {
  return `0x${chainId.toString(16)}`;
}

/**
 * Parse hex chainId to number
 */
export function hexToChainId(hex: string): number {
  return parseInt(hex, 16);
}

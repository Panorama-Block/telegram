'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sidebar } from '@/shared/ui/Sidebar';
import Image from 'next/image';
import { networks, Token } from '@/features/swap/tokens';
import { swapApi, SwapApiError } from '@/features/swap/api';
import { normalizeToApi, getTokenDecimals, parseAmountToWei, formatAmountHuman, isNative } from '@/features/swap/utils';
import { useActiveAccount, PayEmbed } from 'thirdweb/react';
import { createThirdwebClient, defineChain, prepareTransaction, sendTransaction, type Address, type Hex } from 'thirdweb';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';
import type { PreparedTx } from '@/features/swap/types';

interface TokenSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: Token, chainId: number) => void;
  title: string;
  currentChainId: number;
}

function TokenSelector({ isOpen, onClose, onSelect, title, currentChainId }: TokenSelectorProps) {
  const [search, setSearch] = useState('');
  const [selectedChain, setSelectedChain] = useState<number | null>(currentChainId);

  if (!isOpen) return null;

  // Popular tokens (using token logos from public CDN)
  const getTokenIcon = (symbol: string) => {
    const iconMap: Record<string, string> = {
      // Ethereum tokens
      'ETH': 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
      'USDC': 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg',
      'USDT': 'https://cryptologos.cc/logos/tether-usdt-logo.svg',
      'WBTC': 'https://cryptologos.cc/logos/wrapped-bitcoin-wbtc-logo.svg',
      'WETH': 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
      'AAVE': 'https://cryptologos.cc/logos/aave-aave-logo.svg',
      'UNI': 'https://cryptologos.cc/logos/uniswap-uni-logo.svg',
      'LINK': 'https://cryptologos.cc/logos/chainlink-link-logo.svg',
      'LDO': 'https://cryptologos.cc/logos/lido-dao-ldo-logo.svg',
      'USDe': 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg',
      
      // Avalanche tokens
      'AVAX': 'https://cryptologos.cc/logos/avalanche-avax-logo.svg',
      'WAVAX': 'https://cryptologos.cc/logos/avalanche-avax-logo.svg',
      'BTC.b': 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg',
      'JOE': 'https://cryptologos.cc/logos/trader-joe-joe-logo.svg',
      'MIM': 'https://cryptologos.cc/logos/magic-internet-money-mim-logo.svg',
      
      // Binance Smart Chain tokens
      'CAKE': 'https://cryptologos.cc/logos/pancakeswap-cake-logo.svg',
      'ADA': 'https://cryptologos.cc/logos/cardano-ada-logo.svg',
      'DOGE': 'https://cryptologos.cc/logos/dogecoin-doge-logo.svg',
      'XRP': 'https://cryptologos.cc/logos/xrp-xrp-logo.svg',
      'DOT': 'https://cryptologos.cc/logos/polkadot-new-dot-logo.svg',
      'TUSD': 'https://cryptologos.cc/logos/trueusd-tusd-logo.svg',
      
      // Polygon tokens
      'DAI': 'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.svg',
      'QUICK': 'https://cryptologos.cc/logos/quickswap-quick-logo.svg',
      'SAND': 'https://cryptologos.cc/logos/the-sandbox-sand-logo.svg',
      
      // Arbitrum tokens
      'ARB': 'https://cryptologos.cc/logos/arbitrum-arb-logo.svg',
      'GMX': 'https://cryptologos.cc/logos/gmx-gmx-logo.svg',
      
      // Base tokens
      'cbBTC': 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg',
      'AERO': 'https://cryptologos.cc/logos/aerodrome-finance-aero-logo.svg',
      
      // Optimism tokens
      'OP': 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.svg',
      
      // Additional popular tokens
      'MATIC': 'https://cryptologos.cc/logos/polygon-matic-logo.svg',
      'BNB': 'https://cryptologos.cc/logos/bnb-bnb-logo.svg',
      'SOL': 'https://cryptologos.cc/logos/solana-sol-logo.svg',
      'ATOM': 'https://cryptologos.cc/logos/cosmos-atom-logo.svg',
      'NEAR': 'https://cryptologos.cc/logos/near-protocol-near-logo.svg',
      'FTM': 'https://cryptologos.cc/logos/fantom-ftm-logo.svg',
      'ALGO': 'https://cryptologos.cc/logos/algorand-algo-logo.svg',
      'ICP': 'https://cryptologos.cc/logos/internet-computer-icp-logo.svg',
      'FLOW': 'https://cryptologos.cc/logos/flow-flow-logo.svg',
      'SAND': 'https://cryptologos.cc/logos/the-sandbox-sand-logo.svg',
      'MANA': 'https://cryptologos.cc/logos/decentraland-mana-logo.svg',
      'AXS': 'https://cryptologos.cc/logos/axie-infinity-axs-logo.svg',
      'CHZ': 'https://cryptologos.cc/logos/chiliz-chz-logo.svg',
      'ENJ': 'https://cryptologos.cc/logos/enjin-coin-enj-logo.svg',
      'BAT': 'https://cryptologos.cc/logos/basic-attention-token-bat-logo.svg',
      'ZRX': 'https://cryptologos.cc/logos/0x-zrx-logo.svg',
      'KNC': 'https://cryptologos.cc/logos/kyber-network-crystal-knc-logo.svg',
      'COMP': 'https://cryptologos.cc/logos/compound-comp-logo.svg',
      'MKR': 'https://cryptologos.cc/logos/maker-mkr-logo.svg',
      'SNX': 'https://cryptologos.cc/logos/synthetix-network-token-snx-logo.svg',
      'YFI': 'https://cryptologos.cc/logos/yearn-finance-yfi-logo.svg',
      'CRV': 'https://cryptologos.cc/logos/curve-dao-token-crv-logo.svg',
      '1INCH': 'https://cryptologos.cc/logos/1inch-1inch-logo.svg',
      'SUSHI': 'https://cryptologos.cc/logos/sushiswap-sushi-logo.svg',
      'BAL': 'https://cryptologos.cc/logos/balancer-bal-logo.svg',
      'LRC': 'https://cryptologos.cc/logos/loopring-lrc-logo.svg',
      'REN': 'https://cryptologos.cc/logos/ren-ren-logo.svg',
      'STORJ': 'https://cryptologos.cc/logos/storj-storj-logo.svg',
      'REP': 'https://cryptologos.cc/logos/augur-rep-logo.svg',
      'ZEC': 'https://cryptologos.cc/logos/zcash-zec-logo.svg',
      'DASH': 'https://cryptologos.cc/logos/dash-dash-logo.svg',
      'LTC': 'https://cryptologos.cc/logos/litecoin-ltc-logo.svg',
      'BCH': 'https://cryptologos.cc/logos/bitcoin-cash-bch-logo.svg',
      'ETC': 'https://cryptologos.cc/logos/ethereum-classic-etc-logo.svg',
      'XLM': 'https://cryptologos.cc/logos/stellar-xlm-logo.svg',
      'EOS': 'https://cryptologos.cc/logos/eos-eos-logo.svg',
      'TRX': 'https://cryptologos.cc/logos/tron-trx-logo.svg',
      'NEO': 'https://cryptologos.cc/logos/neo-neo-logo.svg',
      'VET': 'https://cryptologos.cc/logos/vechain-vet-logo.svg',
      'THETA': 'https://cryptologos.cc/logos/theta-network-theta-logo.svg',
      'FIL': 'https://cryptologos.cc/logos/filecoin-fil-logo.svg',
      'GRT': 'https://cryptologos.cc/logos/the-graph-grt-logo.svg',
      'UMA': 'https://cryptologos.cc/logos/uma-uma-logo.svg',
      'BAND': 'https://cryptologos.cc/logos/band-protocol-band-logo.svg',
      'NMR': 'https://cryptologos.cc/logos/numeraire-nmr-logo.svg',
      'RLC': 'https://cryptologos.cc/logos/iexec-rlc-logo.svg',
      'GNO': 'https://cryptologos.cc/logos/gnosis-gno-logo.svg',
      'ANT': 'https://cryptologos.cc/logos/aragon-ant-logo.svg',
      'REQ': 'https://cryptologos.cc/logos/request-req-logo.svg',
      'OMG': 'https://cryptologos.cc/logos/omg-omg-logo.svg',
      'ZIL': 'https://cryptologos.cc/logos/zilliqa-zil-logo.svg',
      'IOTA': 'https://cryptologos.cc/logos/iota-miota-logo.svg',
      'QTUM': 'https://cryptologos.cc/logos/qtum-qtum-logo.svg',
      'WAVES': 'https://cryptologos.cc/logos/waves-waves-logo.svg',
      'NANO': 'https://cryptologos.cc/logos/nano-nano-logo.svg',
      'DGB': 'https://cryptologos.cc/logos/digibyte-dgb-logo.svg',
      'SC': 'https://cryptologos.cc/logos/siacoin-sc-logo.svg',
      'DCR': 'https://cryptologos.cc/logos/decred-dcr-logo.svg',
      'LSK': 'https://cryptologos.cc/logos/lisk-lsk-logo.svg',
      'ARK': 'https://cryptologos.cc/logos/ark-ark-logo.svg',
      'FCT': 'https://cryptologos.cc/logos/factom-fct-logo.svg',
      'GNT': 'https://cryptologos.cc/logos/golem-gnt-logo.svg',
      'ICX': 'https://cryptologos.cc/logos/icon-icx-logo.svg',
      'ONT': 'https://cryptologos.cc/logos/ontology-ont-logo.svg',
      'NULS': 'https://cryptologos.cc/logos/nuls-nuls-logo.svg',
      'WAN': 'https://cryptologos.cc/logos/wanchain-wan-logo.svg',
      'RVN': 'https://cryptologos.cc/logos/ravencoin-rvn-logo.svg',
      'XVG': 'https://cryptologos.cc/logos/verge-xvg-logo.svg',
      'DENT': 'https://cryptologos.cc/logos/dent-dent-logo.svg',
      'HOT': 'https://cryptologos.cc/logos/holochain-hot-logo.svg',
      'WIN': 'https://cryptologos.cc/logos/wink-wink-logo.svg',
      'BTT': 'https://cryptologos.cc/logos/bittorrent-btt-logo.svg',
      'CELR': 'https://cryptologos.cc/logos/celer-network-celr-logo.svg',
      'COTI': 'https://cryptologos.cc/logos/coti-coti-logo.svg',
      'FET': 'https://cryptologos.cc/logos/fetch-ai-fet-logo.svg',
      'ONE': 'https://cryptologos.cc/logos/harmony-one-logo.svg',
      'HARMONY': 'https://cryptologos.cc/logos/harmony-one-logo.svg',
      'CELO': 'https://cryptologos.cc/logos/celo-celo-logo.svg',
      'KAVA': 'https://cryptologos.cc/logos/kava-kava-logo.svg',
      'KSM': 'https://cryptologos.cc/logos/kusama-ksm-logo.svg',
    };
    return iconMap[symbol] || 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg';
  };

  const popularTokens = [
    { symbol: 'ETH', icon: getTokenIcon('ETH') },
    { symbol: 'USDC', icon: getTokenIcon('USDC') },
    { symbol: 'USDT', icon: getTokenIcon('USDT') },
    { symbol: 'WBTC', icon: getTokenIcon('WBTC') },
    { symbol: 'WETH', icon: getTokenIcon('WETH') },
    { symbol: 'AVAX', icon: getTokenIcon('AVAX') },
    { symbol: 'AAVE', icon: getTokenIcon('AAVE') },
    { symbol: 'UNI', icon: getTokenIcon('UNI') },
    { symbol: 'LINK', icon: getTokenIcon('LINK') },
    { symbol: 'ARB', icon: getTokenIcon('ARB') },
    { symbol: 'OP', icon: getTokenIcon('OP') },
    { symbol: 'DAI', icon: getTokenIcon('DAI') },
    { symbol: 'SOL', icon: getTokenIcon('SOL') },
    { symbol: 'MATIC', icon: getTokenIcon('MATIC') },
    { symbol: 'BNB', icon: getTokenIcon('BNB') },
    { symbol: 'ATOM', icon: getTokenIcon('ATOM') },
    { symbol: 'NEAR', icon: getTokenIcon('NEAR') },
    { symbol: 'FTM', icon: getTokenIcon('FTM') },
    { symbol: 'ALGO', icon: getTokenIcon('ALGO') },
    { symbol: 'ICP', icon: getTokenIcon('ICP') },
    { symbol: 'FLOW', icon: getTokenIcon('FLOW') },
    { symbol: 'DOT', icon: getTokenIcon('DOT') },
    { symbol: 'ADA', icon: getTokenIcon('ADA') },
    { symbol: 'VET', icon: getTokenIcon('VET') },
    { symbol: 'THETA', icon: getTokenIcon('THETA') },
    { symbol: 'FIL', icon: getTokenIcon('FIL') },
    { symbol: 'SAND', icon: getTokenIcon('SAND') },
    { symbol: 'MANA', icon: getTokenIcon('MANA') },
    { symbol: 'AXS', icon: getTokenIcon('AXS') },
    { symbol: 'CHZ', icon: getTokenIcon('CHZ') },
    { symbol: 'ENJ', icon: getTokenIcon('ENJ') },
    { symbol: 'BAT', icon: getTokenIcon('BAT') },
    { symbol: 'ZRX', icon: getTokenIcon('ZRX') },
    { symbol: 'KNC', icon: getTokenIcon('KNC') },
    { symbol: 'COMP', icon: getTokenIcon('COMP') },
    { symbol: 'MKR', icon: getTokenIcon('MKR') },
    { symbol: 'SNX', icon: getTokenIcon('SNX') },
    { symbol: 'YFI', icon: getTokenIcon('YFI') },
    { symbol: 'CRV', icon: getTokenIcon('CRV') },
    { symbol: '1INCH', icon: getTokenIcon('1INCH') },
    { symbol: 'SUSHI', icon: getTokenIcon('SUSHI') },
    { symbol: 'BAL', icon: getTokenIcon('BAL') },
    { symbol: 'LRC', icon: getTokenIcon('LRC') },
    { symbol: 'REN', icon: getTokenIcon('REN') },
    { symbol: 'STORJ', icon: getTokenIcon('STORJ') },
    { symbol: 'REP', icon: getTokenIcon('REP') },
    { symbol: 'ZEC', icon: getTokenIcon('ZEC') },
    { symbol: 'DASH', icon: getTokenIcon('DASH') },
    { symbol: 'LTC', icon: getTokenIcon('LTC') },
    { symbol: 'BCH', icon: getTokenIcon('BCH') },
    { symbol: 'ETC', icon: getTokenIcon('ETC') },
    { symbol: 'XLM', icon: getTokenIcon('XLM') },
    { symbol: 'EOS', icon: getTokenIcon('EOS') },
    { symbol: 'TRX', icon: getTokenIcon('TRX') },
    { symbol: 'NEO', icon: getTokenIcon('NEO') },
    { symbol: 'GRT', icon: getTokenIcon('GRT') },
    { symbol: 'UMA', icon: getTokenIcon('UMA') },
    { symbol: 'BAND', icon: getTokenIcon('BAND') },
    { symbol: 'NMR', icon: getTokenIcon('NMR') },
    { symbol: 'RLC', icon: getTokenIcon('RLC') },
    { symbol: 'GNO', icon: getTokenIcon('GNO') },
    { symbol: 'ANT', icon: getTokenIcon('ANT') },
    { symbol: 'REQ', icon: getTokenIcon('REQ') },
    { symbol: 'OMG', icon: getTokenIcon('OMG') },
    { symbol: 'ZIL', icon: getTokenIcon('ZIL') },
    { symbol: 'IOTA', icon: getTokenIcon('IOTA') },
    { symbol: 'QTUM', icon: getTokenIcon('QTUM') },
    { symbol: 'WAVES', icon: getTokenIcon('WAVES') },
    { symbol: 'NANO', icon: getTokenIcon('NANO') },
    { symbol: 'DGB', icon: getTokenIcon('DGB') },
    { symbol: 'SC', icon: getTokenIcon('SC') },
    { symbol: 'DCR', icon: getTokenIcon('DCR') },
    { symbol: 'LSK', icon: getTokenIcon('LSK') },
    { symbol: 'ARK', icon: getTokenIcon('ARK') },
    { symbol: 'FCT', icon: getTokenIcon('FCT') },
    { symbol: 'GNT', icon: getTokenIcon('GNT') },
    { symbol: 'ICX', icon: getTokenIcon('ICX') },
    { symbol: 'ONT', icon: getTokenIcon('ONT') },
    { symbol: 'NULS', icon: getTokenIcon('NULS') },
    { symbol: 'WAN', icon: getTokenIcon('WAN') },
    { symbol: 'RVN', icon: getTokenIcon('RVN') },
    { symbol: 'XVG', icon: getTokenIcon('XVG') },
    { symbol: 'DENT', icon: getTokenIcon('DENT') },
    { symbol: 'HOT', icon: getTokenIcon('HOT') },
    { symbol: 'WIN', icon: getTokenIcon('WIN') },
    { symbol: 'BTT', icon: getTokenIcon('BTT') },
    { symbol: 'CELR', icon: getTokenIcon('CELR') },
    { symbol: 'COTI', icon: getTokenIcon('COTI') },
    { symbol: 'FET', icon: getTokenIcon('FET') },
    { symbol: 'ONE', icon: getTokenIcon('ONE') },
    { symbol: 'HARMONY', icon: getTokenIcon('HARMONY') },
    { symbol: 'CELO', icon: getTokenIcon('CELO') },
    { symbol: 'KAVA', icon: getTokenIcon('KAVA') },
    { symbol: 'KSM', icon: getTokenIcon('KSM') },
  ];

  // Get all tokens from selected chain or all chains
  const allTokens = selectedChain
    ? networks.find(n => n.chainId === selectedChain)?.tokens || []
    : networks.flatMap(n => n.tokens);

  // Filter tokens by search
  const filteredTokens = allTokens.filter(token =>
    token.symbol.toLowerCase().includes(search.toLowerCase()) ||
    token.address.toLowerCase().includes(search.toLowerCase())
  );

  // Sort by 24h volume (simulated - just show ETH, USDC, USDT first)
  const sortedTokens = [...filteredTokens].sort((a, b) => {
    const priority = ['ETH', 'USDC', 'USDT', 'WBTC'];
    return priority.indexOf(a.symbol) - priority.indexOf(b.symbol);
  });

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 z-50"
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50 p-4">
        <div className="bg-[#0d1117] border border-cyan-500/30 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-cyan-500/20 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-cyan-500/20">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tokens"
                className="w-full px-4 py-3 pl-10 rounded-lg bg-gray-800/50 border border-cyan-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <circle cx="11" cy="11" r="8" strokeWidth={2} />
                <path strokeLinecap="round" strokeWidth={2} d="m21 21-4.35-4.35" />
              </svg>
            </div>

            {/* Chain selector */}
            <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setSelectedChain(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  selectedChain === null
                    ? 'bg-cyan-500 text-white'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                }`}
              >
                All Chains
              </button>
              {networks.slice(0, 3).map((network) => (
                <button
                  key={network.chainId}
                  onClick={() => setSelectedChain(network.chainId)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                    selectedChain === network.chainId
                      ? 'bg-cyan-500 text-white'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  {network.name}
                </button>
              ))}
            </div>
          </div>

          {/* Popular Tokens */}
          {!search && (
            <div className="px-4 py-3 border-b border-cyan-500/20">
              <div className="grid grid-cols-3 gap-2">
                {popularTokens.slice(0, 6).map((token) => (
                  <button
                    key={token.symbol}
                    onClick={() => {
                      const fullToken = allTokens.find(t => t.symbol === token.symbol);
                      if (fullToken) {
                        onSelect(fullToken, selectedChain || currentChainId);
                        onClose();
                      }
                    }}
                    className="flex flex-col items-center gap-1 px-2 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors border border-cyan-500/20"
                  >
                    <Image
                      src={token.icon}
                      alt={token.symbol}
                      width={24}
                      height={24}
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="text-xs font-medium text-white truncate w-full text-center">{token.symbol}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Token List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-2">
              {!search && (
                <div className="px-2 py-2 flex items-center gap-2 text-xs text-gray-500">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Tokens by 24H volume
                </div>
              )}
              {sortedTokens.map((token, idx) => (
                <button
                  key={`${token.symbol}-${token.address}-${idx}`}
                  onClick={() => {
                    onSelect(token, selectedChain || currentChainId);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-800/50 transition-colors text-left min-w-0"
                >
                    <Image
                      src={token.icon || 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg'}
                      alt={token.symbol}
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-full flex-shrink-0"
                    />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{token.symbol}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {token.address.slice(0, 6)}...{token.address.slice(-4)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function getAddressFromToken(): string | null {
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

export default function SwapPage() {
  const account = useActiveAccount();
  const clientId = THIRDWEB_CLIENT_ID || undefined;
  const client = useMemo(() => (clientId ? createThirdwebClient({ clientId }) : null), [clientId]);

  const addressFromToken = useMemo(() => getAddressFromToken(), []);
  const userAddress = localStorage.getItem('userAddress');
  const effectiveAddress = account?.address || addressFromToken || userAddress;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [fromChainId, setFromChainId] = useState(8453); // Base
  const [toChainId, setToChainId] = useState(42161); // Arbitrum
  const [sellToken, setSellToken] = useState<Token>({
    symbol: 'ETH',
    address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    icon: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png'
  });
  const [buyToken, setBuyToken] = useState<Token | null>(null);
  const [sellAmount, setSellAmount] = useState('');
  const [buyAmount, setBuyAmount] = useState('');
  const [showSellSelector, setShowSellSelector] = useState(false);
  const [showBuySelector, setShowBuySelector] = useState(false);

  // Quote and swap states
  const [quote, setQuote] = useState<any | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showFundWallet, setShowFundWallet] = useState(false);
  const quoteRequestRef = useRef(0);

  // Check if we can request quote
  const canQuote = useMemo(() => {
    return Boolean(sellToken && buyToken && sellAmount && Number(sellAmount) > 0);
  }, [sellToken, buyToken, sellAmount]);

  // Auto-quote effect
  useEffect(() => {
    const requestId = ++quoteRequestRef.current;

    if (!canQuote) {
      setQuote(null);
      setQuoting(false);
      setBuyAmount('');
      return undefined;
    }

    setQuote(null);
    setError(null);
    setSuccess(false);

    const timer = window.setTimeout(() => {
      void performQuote(requestId);
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [canQuote, sellToken, buyToken, sellAmount, effectiveAddress]);

  async function performQuote(requestId: number) {
    if (!canQuote || !buyToken) return;

    setError(null);
    try {
      setQuoting(true);

      const smartAccountAddress = effectiveAddress || '';

      const body = {
        fromChainId,
        toChainId,
        fromToken: normalizeToApi(sellToken.address),
        toToken: normalizeToApi(buyToken.address),
        amount: sellAmount.trim(),
        smartAccountAddress,
      };

      const res = await swapApi.quote(body);

      if (quoteRequestRef.current !== requestId) {
        return;
      }

      if (!res.success || !res.quote) {
        throw new Error(res.message || 'Failed to get quote');
      }

      setQuote(res.quote);

      // Update buy amount from quote
      if (res.quote.estimatedReceiveAmount) {
        const decimals = 18; // You can fetch this from token metadata
        const formatted = formatAmountHuman(BigInt(res.quote.estimatedReceiveAmount), decimals);
        setBuyAmount(formatted);
      }
    } catch (e: any) {
      if (quoteRequestRef.current !== requestId) {
        return;
      }
      setError(e.message || 'Failed to get quote');
    } finally {
      if (quoteRequestRef.current === requestId) {
        setQuoting(false);
      }
    }
  }

  function flattenPrepared(prepared: any): PreparedTx[] {
    const out: PreparedTx[] = [];
    if (!prepared) return out;
    if (Array.isArray(prepared.transactions)) out.push(...prepared.transactions);
    if (Array.isArray(prepared.steps)) {
      for (const s of prepared.steps) {
        if (Array.isArray(s.transactions)) out.push(...s.transactions);
      }
    }
    return out;
  }

  async function handleStartSwap() {
    if (!quote) {
      setError('Aguarde a cotação ser calculada');
      return;
    }

    if (!effectiveAddress) {
      setError('Authentication required. Please ensure you are logged in.');
      return;
    }

    if (!clientId || !client) {
      setError('Missing THIRDWEB client configuration.');
      return;
    }

    setError(null);
    setSuccess(false);

    try {
      setPreparing(true);

      const decimals = await getTokenDecimals({
        client,
        chainId: fromChainId,
        token: sellToken.address
      });

      const wei = parseAmountToWei(sellAmount, decimals);
      if (wei <= 0n) throw new Error('Invalid amount');

      if (!buyToken) {
        throw new Error('Please select a token to buy');
      }

      const prep = await swapApi.prepare({
        fromChainId,
        toChainId,
        fromToken: normalizeToApi(sellToken.address),
        toToken: normalizeToApi(buyToken.address),
        amount: wei.toString(),
        sender: effectiveAddress,
      });

      const seq = flattenPrepared(prep.prepared);
      if (!seq.length) throw new Error('No transactions returned by prepare');

      setPreparing(false);
      setExecuting(true);

      for (const t of seq) {
        if (t.chainId !== fromChainId) {
          throw new Error(`Wallet chain mismatch. Switch to chain ${t.chainId} and retry.`);
        }

        const tx = prepareTransaction({
          to: t.to as Address,
          chain: defineChain(t.chainId),
          client,
          data: t.data as Hex,
          value: t.value ? BigInt(t.value as any) : 0n,
        });

        if (!account) {
          throw new Error('To execute the swap, you need to connect your wallet. Please go to the dashboard and connect your wallet first.');
        }

        const sent = await sendTransaction({ account, transaction: tx });

        if (!sent.transactionHash) {
          throw new Error('Transaction failed: no transaction hash returned. The transaction may have been rejected or failed.');
        }
      }

      setSuccess(true);
      setSellAmount('');
      setBuyAmount('');
      setQuote(null);
    } catch (e: any) {
      const errorMessage = e.message || 'Failed to execute swap';
      const lowerError = errorMessage.toLowerCase();

      // Check if it's an insufficient funds error
      if (lowerError.includes('insufficient funds') ||
          lowerError.includes('have 0 want') ||
          lowerError.includes('32003') ||
          lowerError.includes('gas required exceeds allowance')) {
        setShowFundWallet(true);
      }

      setError(errorMessage);
    } finally {
      setPreparing(false);
      setExecuting(false);
    }
  }

  const handleSwapTokens = () => {
    if (buyToken) {
      const temp = sellToken;
      setSellToken(buyToken);
      setBuyToken(temp);
      setSellAmount(buyAmount);
      setBuyAmount(sellAmount);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-64 overflow-x-hidden">
        {/* Top Bar */}
        <div className="border-b border-cyan-500/20 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-gray-400 hover:text-white"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <h1 className="text-xl font-bold">Swap</h1>
          <div className="w-6" /> {/* Spacer */}
        </div>

        {/* Swap Interface */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="w-full max-w-lg mx-auto">
            {/* Swap Card */}
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-5 sm:p-6 shadow-xl">
              {/* Sell Section */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Sell</label>
                  <div className="text-xs text-gray-400">
                    {networks.find(n => n.chainId === fromChainId)?.name || 'Base'}
                  </div>
                </div>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    placeholder="1.290"
                    className="bg-transparent text-3xl sm:text-4xl font-light text-white outline-none w-full"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm text-gray-500 flex-shrink-0">0 USD</div>
                    <button
                      onClick={() => setShowSellSelector(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#333] transition-colors flex-shrink-0"
                    >
                      <Image
                        src={sellToken.icon || 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg'}
                        alt={sellToken.symbol}
                        width={18}
                        height={18}
                        className="w-[18px] h-[18px] rounded-full flex-shrink-0"
                      />
                      <span className="font-medium text-sm whitespace-nowrap">{sellToken.symbol}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="flex-shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Swap Button */}
              <div className="flex justify-center my-3">
                <button
                  onClick={handleSwapTokens}
                  className="bg-[#2a2a2a] border border-gray-700 rounded-full p-2.5 hover:bg-[#333] transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-400">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </button>
              </div>

              {/* Buy Section */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Buy</label>
                  <div className="text-xs text-gray-400">
                    {networks.find(n => n.chainId === toChainId)?.name || 'Arbitrum'}
                  </div>
                </div>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    placeholder="0"
                    className="bg-transparent text-3xl sm:text-4xl font-light text-white outline-none w-full"
                    readOnly
                  />
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => setShowBuySelector(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
                      style={{
                        background: buyToken ? '#2a2a2a' : '#00d9ff',
                      }}
                    >
                      {buyToken ? (
                        <>
                          <Image
                            src={buyToken.icon || 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg'}
                            alt={buyToken.symbol}
                            width={18}
                            height={18}
                            className="w-[18px] h-[18px] rounded-full flex-shrink-0"
                          />
                          <span className="font-medium text-sm whitespace-nowrap">{buyToken.symbol}</span>
                        </>
                      ) : (
                        <span className="font-medium text-sm text-black whitespace-nowrap">Select Token</span>
                      )}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="flex-shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStartSwap}
                disabled={!quote || quoting || preparing || executing}
                className="w-full py-4 rounded-xl font-semibold text-base transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: quote ? '#00d9ff' : '#4a7c7e',
                  color: quote ? '#000' : 'white',
                }}
              >
                {executing
                  ? 'Executando swap...'
                  : preparing
                    ? 'Preparando transação...'
                    : quoting
                      ? 'Calculando cotação...'
                      : quote
                        ? 'Start Swap'
                        : 'Aguardando cotação...'}
              </button>

              {/* Quote Info */}
              {quote && (
                <div className="mt-4 p-3 rounded-lg bg-[#2a2a2a] border border-cyan-500/30">
                  <div className="text-xs text-gray-400 mb-2">📊 Informações da Cotação</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Taxa de câmbio:</span>
                      <span className="text-white font-medium">
                        1 {sellToken.symbol} ≈ {quote.exchangeRate || 'N/A'} {buyToken?.symbol}
                      </span>
                    </div>
                    {quote.estimatedDuration && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Tempo estimado:</span>
                        <span className="text-white font-medium">{quote.estimatedDuration}s</span>
                      </div>
                    )}
                    {quote.fees?.totalFeeUsd && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Taxa total:</span>
                        <span className="text-white font-medium">${quote.fees.totalFeeUsd}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="text-sm text-red-400">{error}</div>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <div className="text-sm text-green-400">✅ Swap executado com sucesso!</div>
                </div>
              )}

              {/* Fund Wallet Modal */}
              {showFundWallet && client && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                  <div className="bg-[#1a1a1a] border border-cyan-500/30 rounded-2xl max-w-md w-full p-6 relative">
                    <button
                      onClick={() => setShowFundWallet(false)}
                      className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>

                    <h3 className="text-xl font-bold text-white mb-2">💰 Adicionar Fundos</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Seu saldo é insuficiente para executar esta transação. Adicione fundos à sua carteira.
                    </p>

                    <div className="mb-4">
                      <PayEmbed
                        client={client}
                        theme="dark"
                        payOptions={{
                          mode: 'fund_wallet',
                          metadata: {
                            name: 'Adicionar fundos para swap',
                          },
                          prefillBuy: {
                            chain: defineChain(fromChainId),
                            token: sellToken.address === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
                              ? undefined
                              : {
                                  address: sellToken.address as Address,
                                  name: sellToken.symbol,
                                  symbol: sellToken.symbol,
                                }
                          }
                        }}
                      />
                    </div>

                    <button
                      onClick={() => setShowFundWallet(false)}
                      className="w-full py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-medium transition-colors"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Token Selectors */}
      <TokenSelector
        isOpen={showSellSelector}
        onClose={() => setShowSellSelector(false)}
        onSelect={(token, chainId) => {
          setSellToken(token);
          setFromChainId(chainId);
        }}
        title="Select a token to sell"
        currentChainId={fromChainId}
      />
      <TokenSelector
        isOpen={showBuySelector}
        onClose={() => setShowBuySelector(false)}
        onSelect={(token, chainId) => {
          setBuyToken(token);
          setToChainId(chainId);
        }}
        title="Select a token to buy"
        currentChainId={toChainId}
      />
    </div>
  );
}

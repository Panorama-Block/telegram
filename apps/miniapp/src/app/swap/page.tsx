'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/shared/ui/Sidebar';
import Image from 'next/image';
import { networks, Token } from '@/features/swap/tokens';

interface TokenSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: Token) => void;
  title: string;
}

function TokenSelector({ isOpen, onClose, onSelect, title }: TokenSelectorProps) {
  const [search, setSearch] = useState('');
  const [selectedChain, setSelectedChain] = useState<number | null>(null);

  if (!isOpen) return null;

  // Popular tokens (using token logos from public CDN)
  const getTokenIcon = (symbol: string) => {
    const iconMap: Record<string, string> = {
      'ETH': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
      'USDC': 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
      'USDT': 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
      'WBTC': 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
      'WETH': 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
    };
    return iconMap[symbol] || 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png';
  };

  const popularTokens = [
    { symbol: 'ETH', icon: getTokenIcon('ETH') },
    { symbol: 'USDC', icon: getTokenIcon('USDC') },
    { symbol: 'USDT', icon: getTokenIcon('USDT') },
    { symbol: 'WBTC', icon: getTokenIcon('WBTC') },
    { symbol: 'WETH', icon: getTokenIcon('WETH') },
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
                        onSelect(fullToken);
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
                    onSelect(token);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-800/50 transition-colors text-left min-w-0"
                >
                  <Image
                    src={token.icon || '/swap/default.png'}
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

export default function SwapPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sellToken, setSellToken] = useState<Token>({
    symbol: 'ETH',
    address: '0x0000000000000000000000000000000000000000',
    icon: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png'
  });
  const [buyToken, setBuyToken] = useState<Token | null>(null);
  const [sellAmount, setSellAmount] = useState('');
  const [buyAmount, setBuyAmount] = useState('');
  const [showSellSelector, setShowSellSelector] = useState(false);
  const [showBuySelector, setShowBuySelector] = useState(false);

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
                <label className="text-xs text-gray-500 mb-3 block uppercase tracking-wide">Sell</label>
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
                        src={sellToken.icon || '/swap/default.png'}
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
                <label className="text-xs text-gray-500 mb-3 block uppercase tracking-wide">Buy</label>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    placeholder="0"
                    className="bg-transparent text-3xl sm:text-4xl font-light text-white outline-none w-full"
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
                            src={buyToken.icon || '/swap/default.png'}
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

              {/* Get Started Button */}
              <button
                className="w-full py-4 rounded-xl font-semibold text-base transition-all hover:opacity-90"
                style={{
                  background: '#4a7c7e',
                  color: 'white',
                }}
              >
                Start
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Token Selectors */}
      <TokenSelector
        isOpen={showSellSelector}
        onClose={() => setShowSellSelector(false)}
        onSelect={setSellToken}
        title="Select a token"
      />
      <TokenSelector
        isOpen={showBuySelector}
        onClose={() => setShowBuySelector(false)}
        onSelect={setBuyToken}
        title="Select a token"
      />
    </div>
  );
}

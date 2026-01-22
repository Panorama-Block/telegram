'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { networks, Token } from '@/features/swap/tokens';

interface TokenSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: Token, chainId: number) => void;
  title: string;
  currentChainId: number;
}

export function TokenSelector({ isOpen, onClose, onSelect, title, currentChainId }: TokenSelectorProps) {
  const [search, setSearch] = useState('');
  const [selectedChain, setSelectedChain] = useState<number | null>(currentChainId);

  if (!isOpen) return null;

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
        className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 animate-fadeIn"
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-start md:items-center justify-center pt-4 md:pt-0 p-4 pb-20 md:pb-4 z-50 overflow-y-auto">
        <div className="bg-[#1A1A1A]/95 backdrop-blur-2xl border border-white/10 rounded-2xl w-full max-w-lg max-h-[65vh] md:max-h-[75vh] flex flex-col overflow-hidden shadow-2xl animate-scaleIn">
          {/* Header */}
          <div className="p-5 border-b border-white/5 flex items-center justify-between bg-[#252525]/30">
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-all hover:rotate-90 duration-300 p-1 rounded-lg hover:bg-white/5"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="p-5 border-b border-white/5">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tokens by name or address..."
                className="w-full px-4 py-3.5 pl-11 rounded-xl bg-[#252525] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 focus:bg-[#2A2A2A] transition-all"
              />
              <svg
                className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-500"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" d="m21 21-4.35-4.35" />
              </svg>
            </div>

            {/* Chain selector */}
            <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setSelectedChain(null)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                  selectedChain === null
                    ? 'bg-white text-black'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                }`}
              >
                All Chains
              </button>
              {networks.map((network) => (
                <button
                  key={network.chainId}
                  onClick={() => setSelectedChain(network.chainId)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                    selectedChain === network.chainId
                      ? 'bg-white text-black'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                  }`}
                >
                  {network.name}
                </button>
              ))}
            </div>
          </div>

          {/* Token List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar-modal">
            <div className="p-3">
              {!search && (
                <div className="px-3 py-2.5 flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
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
                  className="w-full flex items-center gap-3.5 px-3.5 py-3.5 rounded-xl hover:bg-[#252525] transition-all text-left min-w-0 border border-transparent hover:border-white/10 group"
                >
                  <Image
                    src={token.icon || 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png'}
                    alt={token.symbol}
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-full flex-shrink-0 group-hover:scale-105 transition-transform"
                    unoptimized
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{token.symbol}</div>
                    <div className="text-xs text-gray-500 truncate font-mono">
                      {token.address.slice(0, 6)}...{token.address.slice(-4)}
                    </div>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

import React, { useState } from 'react';
import { cn } from '@/shared/lib/utils';

interface Token {
  symbol: string;
  name: string;
  address: string;
  icon?: string;
}

interface Network {
  name: string;
  chainId: number;
  icon?: string;
}

interface TokenSelectorModalProps {
  onSelectToken: (token: string) => void;
  onClose: () => void;
  className?: string;
}

const NETWORKS: Network[] = [
  { name: 'ETH', chainId: 1 },
  { name: 'SOL', chainId: 900 },
  { name: 'ARB', chainId: 42161 },
  { name: 'BASE', chainId: 8453 },
  { name: 'SUI', chainId: 101 },
];

const TOKENS: Token[] = [
  { symbol: 'USDC', name: 'USD Coin', address: '0xA0b8...e856' },
  { symbol: 'ETH', name: 'Ethereum', address: 'native' },
  { symbol: '1INCH', name: '1inch', address: '0x1111...1302' },
  { symbol: 'USDT', name: 'Tether', address: '0xdAC1...B7dD' },
];

export function TokenSelectorModal({
  onSelectToken,
  onClose,
  className = '',
}: TokenSelectorModalProps) {
  const [selectedNetwork, setSelectedNetwork] = useState('ETH');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTokens = TOKENS.filter(token =>
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTokenSelect = (token: Token) => {
    onSelectToken(token.symbol);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'relative z-50',
            'animate-fadeIn',
            'rounded-[20px] bg-[#1A1A1A] shadow-2xl',
            'w-full max-w-[400px] mx-4',
            'max-h-[520px] overflow-hidden',
            'font-sans',
            className
          )}
        >
          {/* Header */}
          <div className="px-5 py-3 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Select Token</h3>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/10"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 5L15 15M15 5L5 15" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[450px]">
            {/* Select Network */}
            <div className="px-5 py-3 border-b border-white/10">
              <h4 className="text-sm font-medium text-white mb-2.5">Select Network</h4>
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                {NETWORKS.map((network) => (
                  <button
                    key={network.chainId}
                    onClick={() => setSelectedNetwork(network.name)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 flex-shrink-0',
                      'transition-all'
                    )}
                  >
                    <div
                      className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center',
                        'transition-all',
                        selectedNetwork === network.name
                          ? 'bg-white/20 ring-2 ring-white'
                          : 'bg-[#2A2A2A] hover:bg-[#333333]'
                      )}
                    >
                      <span className="text-base font-bold text-white">
                        {network.name[0]}
                      </span>
                    </div>
                    <span className={cn(
                      'text-[10px] font-medium',
                      selectedNetwork === network.name ? 'text-white' : 'text-gray-400'
                    )}>
                      {network.name}
                    </span>
                  </button>
                ))}

                {/* Other button */}
                <button
                  className="flex flex-col items-center gap-1.5 flex-shrink-0"
                >
                  <div className="w-12 h-12 rounded-full bg-[#2A2A2A] hover:bg-[#333333] flex items-center justify-center transition-all">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-medium text-gray-400">Other</span>
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-5 py-3">
              <h4 className="text-sm font-medium text-white mb-2.5">Select a Token</h4>
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for a token"
                  className="w-full pl-9 pr-4 py-2 bg-[#2A2A2A] text-white text-sm rounded-xl outline-none focus:ring-2 focus:ring-white/20 transition-all placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Token List */}
            <div className="px-5 pb-4">
              <h4 className="text-xs font-medium text-gray-400 mb-2">
                Tokens on {selectedNetwork}
              </h4>
              <div className="space-y-1">
                {filteredTokens.map((token) => (
                  <button
                    key={token.address}
                    onClick={() => handleTokenSelect(token)}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[#2A2A2A] transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-white">
                        {token.symbol[0]}
                      </span>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-semibold text-white">
                        {token.symbol}
                      </div>
                      <div className="text-xs text-gray-400">
                        {token.name} • {token.address}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default TokenSelectorModal;

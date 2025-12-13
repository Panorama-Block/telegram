'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/shared/lib/utils';

interface TokenSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: Token) => void;
}

type Network = 'All Chains' | 'Ethereum' | 'BSC' | 'Polygon' | 'Arbitrum' | 'Base' | 'Optimism' | 'Avalanche' | 'World Chain';

const NETWORKS: Network[] = [
  'All Chains',
  'Ethereum',
  'BSC',
  'Polygon',
  'Arbitrum',
  'Base',
  'Optimism',
  'Avalanche',
  'World Chain',
];

interface Token {
  ticker: string;
  name: string;
  network: Network;
  balance: string;
}

const TOKENS: Token[] = [
  { ticker: 'AVAX', name: 'Avalanche', network: 'Avalanche', balance: '145.20' },
  { ticker: 'ETH', name: 'Ethereum', network: 'Base', balance: '0.50' },
  { ticker: 'USDC', name: 'USD Coin', network: 'Base', balance: '50.00' },
  { ticker: 'ARB', name: 'Arbitrum', network: 'Arbitrum', balance: '0.00' },
  { ticker: 'OP', name: 'Optimism', network: 'Optimism', balance: '0.00' },
  { ticker: 'USDT', name: 'Tether USD', network: 'BSC', balance: '0.00' },
  { ticker: 'CONF', name: 'Confraria', network: 'World Chain', balance: '500000.00' },
  { ticker: 'WETH', name: 'Wrapped Ether', network: 'Ethereum', balance: '2.40' },
  { ticker: 'WBTC', name: 'Wrapped BTC', network: 'Ethereum', balance: '0.05' },
  { ticker: 'DAI', name: 'Dai Stablecoin', network: 'Ethereum', balance: '500.00' },
];

const NETWORK_COLORS: Record<string, string> = {
  Avalanche: 'from-red-500 to-red-700',
  Base: 'from-blue-500 to-blue-700',
  BSC: 'from-yellow-400 to-yellow-600',
  Optimism: 'from-red-400 to-red-600',
  'World Chain': 'from-zinc-400 to-zinc-600',
  Arbitrum: 'from-blue-400 to-blue-600',
  Polygon: 'from-purple-500 to-purple-700',
  Ethereum: 'from-indigo-400 to-indigo-600',
};

export function TokenSelectionModal({ isOpen, onClose, onSelect }: TokenSelectionModalProps) {
  const [activeNetwork, setActiveNetwork] = useState<Network>('All Chains');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTokens = useMemo(() => {
    return TOKENS.filter((token) => {
      const matchesNetwork = activeNetwork === 'All Chains' || token.network === activeNetwork;
      const matchesSearch =
        token.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesNetwork && matchesSearch;
    });
  }, [activeNetwork, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xl"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-md bg-pano-bg-secondary border border-white/10 shadow-2xl overflow-hidden flex flex-col h-[85vh] md:h-auto md:max-h-[80vh] rounded-t-3xl rounded-b-none md:rounded-2xl border-b-0 md:border-b pb-safe animate-[slideUp_250ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
            <div className="md:hidden w-full flex justify-center pt-3 pb-1 shrink-0 bg-pano-bg-secondary">
              <div className="w-12 h-1.5 bg-pano-border rounded-full" />
            </div>

            <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center">
                <h2 className="text-lg font-bold text-pano-text-primary">Select Token</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 -mr-2 rounded-full text-pano-text-muted hover:text-pano-text-primary hover:bg-white/10 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 shrink-0">
              <div className="relative">
                <svg
                  className="w-5 h-5 text-pano-text-muted absolute left-3 top-1/2 -translate-y-1/2"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle cx="11" cy="11" r="8" />
                  <path strokeLinecap="round" d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Search name or paste address"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-pano-text-primary placeholder:text-pano-text-muted focus:outline-none focus:border-pano-primary/50 transition-colors"
                  autoFocus
                />
              </div>
            </div>

            <div className="px-4 pb-2 overflow-x-auto scrollbar-hide shrink-0">
              <div className="flex gap-2 pb-2">
                {NETWORKS.map((network) => (
                  <button
                    key={network}
                    onClick={() => setActiveNetwork(network)}
                    className={cn(
                      'whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors border',
                      activeNetwork === network
                        ? 'bg-pano-primary text-pano-text-inverse border-pano-primary font-bold'
                        : 'bg-white/5 text-pano-text-muted border-white/10 hover:bg-white/10 hover:text-pano-text-primary'
                    )}
                  >
                    {network}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar-modal">
              {filteredTokens.length > 0 ? (
                <div className="space-y-1">
                  {filteredTokens.map((token, index) => (
                    <button
                      key={`${token.network}-${token.ticker}-${index}`}
                      onClick={() => {
                        onSelect(token);
                        onClose();
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center text-pano-text-primary font-bold text-xs bg-gradient-to-br shadow-inner',
                            NETWORK_COLORS[token.network] || 'from-zinc-600 to-zinc-800'
                          )}
                        >
                          {token.ticker.substring(0, 2)}
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-pano-text-primary group-hover:text-pano-text-accent transition-colors">
                              {token.ticker}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-pano-text-muted border border-white/5">
                              {token.network}
                            </span>
                          </div>
                          <div className="text-xs text-pano-text-muted">{token.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono text-pano-text-primary group-hover:text-pano-text-primary transition-colors">
                          {token.balance}
                        </div>
                        {parseFloat(token.balance) > 0 && (
                          <div className="text-[10px] text-pano-text-muted">Balance</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-pano-text-muted">
                  <p>No tokens found</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/5 shrink-0">
              <button
                onClick={onClose}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-pano-text-primary rounded-xl text-sm font-medium transition-colors border border-white/5"
              >
                Close
              </button>
            </div>
      </div>
    </div>
  );
}

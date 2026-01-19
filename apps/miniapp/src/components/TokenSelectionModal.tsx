'use client';

import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Check, ArrowLeft } from "lucide-react";
import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { networks } from "@/features/swap/tokens";

interface TokenSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: any) => void;
  customTokens?: UiToken[];
}

// Extract unique network names from the source of truth
const ALL_NETWORKS = ['All Chains', ...Array.from(new Set(networks.map(n => n.name)))];

interface UiToken {
  ticker: string;
  name: string;
  network: string;
  address: string;
  balance: string;
  icon?: string;
}

// Flatten the centralized tokens config into the UI format
const TOKENS: UiToken[] = networks.flatMap(net => 
  net.tokens.map(t => ({
    ticker: t.symbol,
    name: t.name || t.symbol,
    network: net.name,
    address: t.address,
    balance: "0.00", // TODO: Real balance fetching
    icon: t.icon
  }))
);

const NETWORK_COLORS: Record<string, string> = {
  'Avalanche': 'from-red-500 to-red-700',
  'Base': 'from-blue-500 to-blue-700',
  'Binance Smart Chain': 'from-yellow-400 to-yellow-600',
  'Optimism': 'from-red-400 to-red-600',
  'World Chain': 'from-zinc-400 to-zinc-600',
  'Arbitrum': 'from-blue-400 to-blue-600',
  'Polygon': 'from-purple-500 to-purple-700',
  'Ethereum': 'from-indigo-400 to-indigo-600',
};

export function TokenSelectionModal({ isOpen, onClose, onSelect, customTokens }: TokenSelectionModalProps) {
  const [activeNetwork, setActiveNetwork] = useState<string>('All Chains');
  const [searchQuery, setSearchQuery] = useState("");

  const displayTokens = customTokens || TOKENS;

  const filteredTokens = useMemo(() => {
    return displayTokens.filter(token => {
      const matchesNetwork = activeNetwork === 'All Chains' || token.network === activeNetwork;
      const matchesSearch = token.ticker.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            token.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesNetwork && matchesSearch;
    });
  }, [activeNetwork, searchQuery, displayTokens]);

  // Responsive variants
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const modalVariants = {
    initial: isMobile ? { y: "100%" } : { scale: 0.95, opacity: 0, y: 20 },
    animate: isMobile ? { y: 0 } : { scale: 1, opacity: 1, y: 0 },
    exit: isMobile ? { y: "100%" } : { scale: 0.95, opacity: 0, y: 20 },
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xl"
          onClick={onClose}
        >
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full md:max-w-md bg-[#0A0A0A] border border-white/10 shadow-2xl overflow-hidden flex flex-col h-[85vh] md:h-auto md:max-h-[80vh] rounded-t-3xl rounded-b-none md:rounded-2xl border-b-0 md:border-b pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="md:hidden w-full flex justify-center pt-3 pb-1 shrink-0 bg-[#0A0A0A]">
              <div className="w-12 h-1.5 bg-zinc-800 rounded-full" />
            </div>

            {/* Header */}
            <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center">
                <button 
                  onClick={onClose}
                  className="p-2 -ml-2 mr-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors group"
                >
                  <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                </button>
                <h2 className="text-lg font-display font-bold text-white">Select Token</h2>
              </div>
              
              <button 
                onClick={onClose}
                className="p-2 -mr-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 shrink-0">
              <div className="relative">
                <Search className="w-5 h-5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Search name or paste address"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 transition-colors"
                  autoFocus
                />
              </div>
            </div>

            {/* Network Pills */}
            <div className="px-4 pb-2 overflow-x-auto scrollbar-hide shrink-0">
              <div className="flex gap-2 pb-2">
                {Array.from(new Set(['All Chains', ...displayTokens.map(t => t.network)])).map((network) => (
                  <button
                    key={network}
                    onClick={() => setActiveNetwork(network)}
                    className={cn(
                      "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors border",
                      activeNetwork === network
                        ? "bg-cyan-500 text-black border-cyan-500 font-bold"
                        : "bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {network}
                  </button>
                ))}
              </div>
            </div>

            {/* Token List */}
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
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
                        {/* Token Icon or Fallback */}
                        {token.icon ? (
                             <img src={token.icon} alt={token.ticker} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                            <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs bg-gradient-to-br shadow-inner",
                            NETWORK_COLORS[token.network] || 'from-zinc-600 to-zinc-800'
                            )}>
                            {token.ticker.substring(0, 2)}
                            </div>
                        )}
                        
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white group-hover:text-primary transition-colors">{token.ticker}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-500 border border-white/5">{token.network}</span>
                          </div>
                          <div className="text-xs text-zinc-500">{token.name}</div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm font-mono text-zinc-300 group-hover:text-white transition-colors">
                          {token.balance}
                        </div>
                        {parseFloat(token.balance) > 0 && (
                          <div className="text-[10px] text-zinc-600">Balance</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <p>No tokens found</p>
                </div>
              )}
            </div>

            {/* Footer with Close Button */}
            <div className="p-4 border-t border-white/5 shrink-0">
              <button 
                onClick={onClose}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-xl text-sm font-medium transition-colors border border-white/5"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

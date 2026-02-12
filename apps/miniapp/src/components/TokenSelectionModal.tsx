'use client';

import { motion, AnimatePresence } from "framer-motion";
import { Search, X, ArrowLeft, Loader2 } from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { networks, TON_CHAIN_ID } from "@/features/swap/tokens";
import { formatAmountHuman, isNative } from "@/features/swap/utils";
import { useActiveAccount } from "thirdweb/react";
import { createThirdwebClient, defineChain, getContract } from "thirdweb";
import { THIRDWEB_CLIENT_ID } from "@/shared/config/thirdweb";
import { useTonAddress } from '@tonconnect/ui-react';

interface TokenSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: any) => void;
  customTokens?: UiToken[];
}

interface UiToken {
  ticker: string;
  name: string;
  network: string;
  address: string;
  balance: string;
  icon?: string;
}

// Flatten the centralized tokens config into the UI format (without balance)
const BASE_TOKENS: Omit<UiToken, 'balance'>[] = networks.flatMap(net =>
  net.tokens.map(t => ({
    ticker: t.symbol,
    name: t.name || t.symbol,
    network: net.name,
    address: t.address,
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
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [loadingBalances, setLoadingBalances] = useState(false);
  const fetchIdRef = useRef(0);

  const account = useActiveAccount();
  const tonAddress = useTonAddress();

  // Fetch balances when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const hasEvmWallet = !!account?.address;
    const hasTonWallet = !!tonAddress;
    if (!hasEvmWallet && !hasTonWallet) return;

    const fetchId = ++fetchIdRef.current;
    let cancelled = false;
    setLoadingBalances(true);

    async function fetchAllBalances() {
      const result: Record<string, string> = {};

      // Fetch EVM balances
      if (hasEvmWallet) {
        try {
          const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });
          const { getBalance } = await import("thirdweb/extensions/erc20");
          const { eth_getBalance, getRpcClient } = await import("thirdweb/rpc");

          const evmNetworks = networks.filter(n => n.chainId !== TON_CHAIN_ID);

          await Promise.allSettled(evmNetworks.map(async (network) => {
            const chain = defineChain(network.chainId);

            await Promise.allSettled(network.tokens.map(async (token) => {
              const key = `${network.name}:${token.address}`;
              try {
                const isNativeToken = isNative(token.address);
                let balance: bigint;
                let decimals = token.decimals || 18;

                if (isNativeToken) {
                  const rpcRequest = getRpcClient({ client, chain });
                  balance = await eth_getBalance(rpcRequest, { address: account!.address });
                } else {
                  const tokenContract = getContract({
                    client,
                    chain,
                    address: token.address,
                  });
                  const balResult = await getBalance({ contract: tokenContract, address: account!.address });
                  balance = balResult.value;
                  decimals = balResult.decimals;
                }

                if (!cancelled) {
                  result[key] = formatAmountHuman(balance, decimals, 6);
                }
              } catch (err) {
                // Keep as "0.00" on error
              }
            }));
          }));
        } catch (err) {
          console.error('[TokenModal] Error importing thirdweb modules:', err);
        }
      }

      // Fetch TON balances
      if (hasTonWallet) {
        try {
          const [{ getHttpEndpoint }, { TonClient }] = await Promise.all([
            import('@orbs-network/ton-access'),
            import('@ton/ton'),
          ]);
          const { Address, fromNano } = await import('@ton/core');

          const endpoint = await getHttpEndpoint({ network: 'mainnet' });
          const tonClient = new TonClient({ endpoint });
          const addr = Address.parse(tonAddress);

          // Native TON balance
          const bal = await tonClient.getBalance(addr);
          if (!cancelled) {
            result['TON:0x0000000000000000000000000000000000000000'] = parseFloat(fromNano(bal)).toFixed(4);
          }

          // USDT jetton balance
          try {
            const { beginCell } = await import('@ton/core');
            const usdtMaster = Address.parse('EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs');

            const walletResponse = await tonClient.runMethod(usdtMaster, 'get_wallet_address', [
              { type: 'slice', cell: beginCell().storeAddress(addr).endCell() }
            ]);
            const jettonWalletAddr = walletResponse.stack.readAddress();

            const jettonData = await tonClient.runMethod(jettonWalletAddr, 'get_wallet_data', []);
            const jettonBalance = jettonData.stack.readBigNumber();

            if (!cancelled) {
              result['TON:EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'] = formatAmountHuman(jettonBalance, 6, 4);
            }
          } catch {
            // User might not have a USDT jetton wallet yet
          }
        } catch (err) {
          console.error('[TokenModal] Error fetching TON balance:', err);
        }
      }

      if (!cancelled && fetchId === fetchIdRef.current) {
        setBalances(result);
        setLoadingBalances(false);
      }
    }

    fetchAllBalances();

    return () => { cancelled = true; };
  }, [isOpen, account?.address, tonAddress]);

  // Merge balances into tokens and sort (tokens with balance first)
  const tokensWithBalance: UiToken[] = useMemo(() => {
    if (customTokens) return customTokens;

    return BASE_TOKENS.map(t => ({
      ...t,
      balance: balances[`${t.network}:${t.address}`] || "0.00",
    })).sort((a, b) => {
      const balA = parseFloat(a.balance) || 0;
      const balB = parseFloat(b.balance) || 0;
      return balB - balA;
    });
  }, [balances, customTokens]);

  const filteredTokens = useMemo(() => {
    return tokensWithBalance.filter(token => {
      const matchesNetwork = activeNetwork === 'All Chains' || token.network === activeNetwork;
      const matchesSearch = token.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            token.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesNetwork && matchesSearch;
    });
  }, [activeNetwork, searchQuery, tokensWithBalance]);

  const modalVariants = {
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.95, opacity: 0 },
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-start md:items-center justify-center pt-4 md:pt-0 p-4 pb-20 md:pb-4 bg-black/60 backdrop-blur-xl overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-md bg-[#0A0A0A] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[65vh] md:max-h-[75vh] rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
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
                {Array.from(new Set(['All Chains', ...tokensWithBalance.map(t => t.network)])).map((network) => (
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
                        {loadingBalances && !balances[`${token.network}:${token.address}`] ? (
                          <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
                        ) : (
                          <>
                            <div className="text-sm font-mono text-zinc-300 group-hover:text-white transition-colors">
                              {token.balance}
                            </div>
                            {parseFloat(token.balance) > 0 && (
                              <div className="text-[10px] text-zinc-600">Balance</div>
                            )}
                          </>
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

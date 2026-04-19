'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Coins, Layers, Loader2 } from 'lucide-react';
import { getTokenIcon } from '@/shared/lib/tokenIcons';
import type {
  CollateralMarket,
  CollateralRowVM,
  DebtRowVM,
  MetronomeMarkets,
  SyntheticMarket,
  MetronomeUiAction,
} from '@/features/metronome/types';

type Tab = 'positions' | 'markets';

export interface MetronomeSelectViewProps {
  markets:        MetronomeMarkets | null;
  collateralRows: CollateralRowVM[];
  debtRows:       DebtRowVM[];
  loading:        boolean;
  positionLoading: boolean;
  error:          Error | null;
  walletConnected: boolean;
  initialTab?:    Tab;
  onRetry:        () => void;
  onPickAction:   (action: MetronomeUiAction, target: { collateral?: CollateralMarket; synth?: SyntheticMarket }) => void;
}

/**
 * Format 18-decimal Metronome shares into a short display string.
 * Deposit-token shares are always 18-dec internally, regardless of underlying.
 */
function formatShares(shares: string): string {
  try {
    const num = Number(BigInt(shares)) / 1e18;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000)     return `${(num / 1_000).toFixed(2)}K`;
    if (num >= 1)         return num.toFixed(4);
    if (num >= 0.0001)    return num.toFixed(6);
    if (num > 0)          return '< 0.0001';
    return '0';
  } catch {
    return '0';
  }
}

function formatSynth(debt: string, decimals: number): string {
  try {
    const divisor = 10n ** BigInt(decimals);
    const whole = Number(BigInt(debt) / divisor);
    const fracBig = BigInt(debt) % divisor;
    const frac = Number(fracBig) / Number(divisor);
    const total = whole + frac;
    if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(2)}M`;
    if (total >= 1_000)     return `${(total / 1_000).toFixed(2)}K`;
    if (total >= 1)         return total.toFixed(4);
    if (total >= 0.0001)    return total.toFixed(6);
    if (total > 0)          return '< 0.0001';
    return '0';
  } catch {
    return '0';
  }
}

export function MetronomeSelectView({
  markets,
  collateralRows,
  debtRows,
  loading,
  positionLoading,
  error,
  walletConnected,
  initialTab,
  onRetry,
  onPickAction,
}: MetronomeSelectViewProps) {
  const hasPositions = useMemo(
    () => collateralRows.some((r) => r.shares !== '0') || debtRows.some((r) => r.debt !== '0'),
    [collateralRows, debtRows],
  );
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? (hasPositions ? 'positions' : 'markets'));

  return (
    <motion.div
      key="select"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full"
    >
      <div className="px-4 sm:px-6 pt-1 pb-3">
        <div className="flex bg-white/5 rounded-xl p-1 border border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab('positions')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'positions'
                ? 'bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/20 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Positions
            {hasPositions && (
              <span className="ml-0.5 text-[10px] bg-fuchsia-500/20 text-fuchsia-300 px-1.5 py-px rounded-full">
                {collateralRows.filter((r) => r.shares !== '0').length + debtRows.filter((r) => r.debt !== '0').length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('markets')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'markets'
                ? 'bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/20 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Markets
            {markets && (
              <span className="ml-0.5 text-[10px] bg-white/10 text-zinc-400 px-1.5 py-px rounded-full">
                {markets.collateral.length + markets.synthetic.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6 pb-6 flex-1 overflow-y-auto custom-scrollbar">
        {error && (
          <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error.message}
            <button onClick={onRetry} className="ml-2 underline hover:text-red-200">retry</button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'positions' ? (
            <motion.div
              key="positions-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {!walletConnected ? (
                <EmptyState icon={<Layers className="w-5 h-5 text-zinc-600" />} text="Connect a wallet to view your position." />
              ) : positionLoading && !hasPositions ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                </div>
              ) : !hasPositions ? (
                <EmptyState
                  icon={<Coins className="w-5 h-5 text-zinc-600" />}
                  text="No collateral deposited and no synth debt."
                  action={<button onClick={() => setActiveTab('markets')} className="text-xs text-fuchsia-300 hover:text-fuchsia-200">Browse markets →</button>}
                />
              ) : (
                <>
                  {collateralRows.filter((r) => r.shares !== '0').length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-[11px] uppercase tracking-wider text-zinc-500 px-1">Collateral</h3>
                      {collateralRows
                        .filter((r) => r.shares !== '0')
                        .map((row) => (
                          <div key={row.symbol} className="bg-white/5 border border-fuchsia-500/20 rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <img src={row.iconUrl} alt="" className="w-5 h-5 rounded-full ring-1 ring-black" />
                                <span className="text-sm font-medium text-white">{row.underlyingSymbol}</span>
                                <span className="text-[10px] text-zinc-500">· {row.symbol}</span>
                              </div>
                              <span className="text-xs text-white font-mono">{formatShares(row.shares)}</span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => onPickAction('deposit', { collateral: row })}
                                className="flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-300 hover:bg-fuchsia-500/20 transition-colors"
                              >
                                Deposit more
                              </button>
                              <button
                                onClick={() => onPickAction('withdraw', { collateral: row })}
                                className="flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                              >
                                Withdraw
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {debtRows.filter((r) => r.debt !== '0').length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-[11px] uppercase tracking-wider text-zinc-500 px-1">Synth Debt</h3>
                      {debtRows
                        .filter((r) => r.debt !== '0')
                        .map((row) => (
                          <div key={row.symbol} className="bg-white/5 border border-amber-500/20 rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <img src={row.iconUrl} alt="" className="w-5 h-5 rounded-full ring-1 ring-black" />
                                <span className="text-sm font-medium text-white">{row.symbol}</span>
                              </div>
                              <span className="text-xs text-white font-mono">{formatSynth(row.debt, row.decimals)}</span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => onPickAction('repay', { synth: row })}
                                className="flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition-colors"
                              >
                                Repay
                              </button>
                              <button
                                onClick={() => onPickAction('mint', { synth: row })}
                                className="flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                              >
                                Mint more
                              </button>
                              <button
                                onClick={() => onPickAction('unwind', { synth: row })}
                                className="flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                              >
                                Unwind
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="markets-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {loading && !markets ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                </div>
              ) : !markets ? (
                <EmptyState icon={<Coins className="w-5 h-5 text-zinc-600" />} text="Markets catalog unavailable." />
              ) : (
                <>
                  <div className="space-y-2">
                    <h3 className="text-[11px] uppercase tracking-wider text-zinc-500 px-1">Collateral markets</h3>
                    {markets.collateral.map((market) => (
                      <button
                        key={market.symbol}
                        type="button"
                        onClick={() => onPickAction('deposit', { collateral: market })}
                        className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <img src={getTokenIcon(market.underlyingSymbol)} alt="" className="w-6 h-6 rounded-full" />
                          <div>
                            <div className="text-sm text-white font-medium">{market.underlyingSymbol}</div>
                            <div className="text-[10px] text-zinc-500">{market.symbol}</div>
                          </div>
                        </div>
                        <span className="text-[11px] text-fuchsia-300">Deposit →</span>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-[11px] uppercase tracking-wider text-zinc-500 px-1">Synthetic markets</h3>
                    {markets.synthetic.map((market) => (
                      <button
                        key={market.symbol}
                        type="button"
                        onClick={() => onPickAction('mint', { synth: market })}
                        className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <img src={getTokenIcon(market.symbol)} alt="" className="w-6 h-6 rounded-full" />
                          <div>
                            <div className="text-sm text-white font-medium">{market.symbol}</div>
                            <div className="text-[10px] text-zinc-500">synthetic</div>
                          </div>
                        </div>
                        <span className="text-[11px] text-amber-300">Mint →</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function EmptyState({ icon, text, action }: { icon: React.ReactNode; text: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-16 space-y-3">
      <div className="w-12 h-12 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
        {icon}
      </div>
      <p className="text-sm text-zinc-500">{text}</p>
      {action}
    </div>
  );
}

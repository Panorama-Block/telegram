'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2 } from 'lucide-react';
import { getTokenIcon } from '@/shared/lib/tokenIcons';
import type {
  CollateralMarket,
  SyntheticMarket,
  MetronomeUiAction,
} from '@/features/metronome/types';

const ACTION_LABELS: Record<MetronomeUiAction, string> = {
  deposit:  'Deposit collateral',
  withdraw: 'Withdraw collateral',
  mint:     'Mint synth',
  repay:    'Repay synth',
  unwind:   'Unwind position',
};

const ACTION_HINTS: Record<MetronomeUiAction, string> = {
  deposit:  'Supply underlying tokens as collateral to mint synths against.',
  withdraw: 'Pull underlying tokens out of the protocol. Must not breach your borrow limit.',
  mint:     'Mint new synthetic tokens against your deposited collateral.',
  repay:    'Pay back synth debt to restore borrow capacity.',
  unwind:   'Close position atomically: repay synth debt and withdraw remaining collateral.',
};

export interface MetronomeInputViewProps {
  action:          MetronomeUiAction;
  collateral?:     CollateralMarket;
  synth?:          SyntheticMarket;
  amount:          string;
  onAmountChange:  (next: string) => void;
  walletBalance?:  string | null; // underlying units (user-readable) for deposit
  sharesBalance?:  string | null; // raw 18-dec for withdraw
  synthBalance?:   string | null; // raw synth units for repay
  debtOutstanding?: string | null; // raw synth units
  error?:          string | null;
  walletConnected: boolean;
  isPreparing:     boolean;
  onContinue:      () => void;
}

/** Convert a raw-units string in `decimals` to a human string (fixed 6 dp). */
function formatUnits(raw: string, decimals: number): string {
  try {
    if (!raw || raw === '0') return '0';
    const divisor = 10n ** BigInt(decimals);
    const whole = BigInt(raw) / divisor;
    const frac = BigInt(raw) % divisor;
    if (frac === 0n) return whole.toString();
    const fracStr = frac.toString().padStart(decimals, '0').slice(0, 6).replace(/0+$/, '');
    return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
  } catch {
    return '0';
  }
}

export function MetronomeInputView({
  action,
  collateral,
  synth,
  amount,
  onAmountChange,
  walletBalance,
  sharesBalance,
  synthBalance,
  debtOutstanding,
  error,
  walletConnected,
  isPreparing,
  onContinue,
}: MetronomeInputViewProps) {
  const inputToken = useMemo(() => {
    if (action === 'deposit') return collateral ? { symbol: collateral.underlyingSymbol, decimals: collateral.decimals } : null;
    if (action === 'withdraw') return collateral ? { symbol: `${collateral.underlyingSymbol} (shares)`, decimals: 18 } : null;
    if (action === 'mint' || action === 'repay' || action === 'unwind') {
      return synth ? { symbol: synth.symbol, decimals: synth.decimals } : null;
    }
    return null;
  }, [action, collateral, synth]);

  const maxHuman = useMemo<string | null>(() => {
    if (action === 'deposit') return walletBalance ?? null;
    if (action === 'withdraw') return sharesBalance ? formatUnits(sharesBalance, 18) : null;
    if (action === 'repay') {
      if (debtOutstanding && synth) return formatUnits(debtOutstanding, synth.decimals);
      if (synthBalance && synth)    return formatUnits(synthBalance, synth.decimals);
      return null;
    }
    if (action === 'unwind') {
      if (synthBalance && synth) return formatUnits(synthBalance, synth.decimals);
      return null;
    }
    return null; // mint has no hard local max
  }, [action, walletBalance, sharesBalance, synthBalance, debtOutstanding, synth]);

  const canContinue = walletConnected
    && inputToken != null
    && amount.trim() !== ''
    && !Number.isNaN(Number(amount))
    && Number(amount) > 0
    && !isPreparing;

  return (
    <motion.div
      key="input"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full"
    >
      <div className="px-4 sm:px-6 pb-6 flex-1 overflow-y-auto custom-scrollbar space-y-4">
        {/* Header */}
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-white">{ACTION_LABELS[action]}</h3>
          <p className="text-xs text-zinc-500">{ACTION_HINTS[action]}</p>
        </div>

        {/* Target summary */}
        {(collateral || synth) && (
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
            <img
              src={getTokenIcon(
                action === 'deposit' || action === 'withdraw'
                  ? collateral?.underlyingSymbol ?? ''
                  : synth?.symbol ?? '',
              )}
              alt=""
              className="w-7 h-7 rounded-full"
            />
            <div className="flex-1 min-w-0">
              {action === 'deposit' || action === 'withdraw' ? (
                <>
                  <div className="text-sm text-white font-medium">{collateral?.underlyingSymbol}</div>
                  <div className="text-[10px] text-zinc-500 truncate">{collateral?.symbol} · {collateral?.decimals} dec</div>
                </>
              ) : (
                <>
                  <div className="text-sm text-white font-medium">{synth?.symbol}</div>
                  <div className="text-[10px] text-zinc-500 truncate">synth · {synth?.decimals} dec</div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Amount input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] uppercase tracking-wider text-zinc-500">Amount</label>
            {maxHuman != null && (
              <button
                type="button"
                onClick={() => onAmountChange(maxHuman)}
                className="text-[11px] text-fuchsia-300 hover:text-fuchsia-200 transition-colors"
              >
                Max: {maxHuman}
              </button>
            )}
          </div>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="w-full bg-white/5 border border-white/10 focus:border-fuchsia-500/40 focus:bg-white/10 outline-none rounded-xl px-4 py-3 text-lg text-white font-mono transition-colors"
            />
            {inputToken && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                {inputToken.symbol}
              </span>
            )}
          </div>
        </div>

        {/* Context: debt outstanding for repay/unwind */}
        {(action === 'repay' || action === 'unwind') && debtOutstanding && synth && (
          <div className="text-[11px] text-zinc-500 flex items-center justify-between">
            <span>Outstanding debt</span>
            <span className="text-zinc-300 font-mono">{formatUnits(debtOutstanding, synth.decimals)} {synth.symbol}</span>
          </div>
        )}
        {action === 'unwind' && (
          <div className="text-[11px] text-amber-300/80 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2 flex gap-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Atomic close — amount should cover debt + protocol fee. Any excess synth is refunded.
            </span>
          </div>
        )}

        {/* Error surface */}
        {error && (
          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="px-4 sm:px-6 pb-3 pt-2 border-t border-white/5">
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-500/30 text-fuchsia-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPreparing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Preparing…
            </>
          ) : !walletConnected ? (
            'Connect wallet to continue'
          ) : (
            'Continue'
          )}
        </button>
      </div>
    </motion.div>
  );
}

import { motion } from 'framer-motion';
import { Loader2, TrendingUp, AlertTriangle } from 'lucide-react';
import { NeonButton } from '@/components/ui/NeonButton';
import { DataInput } from '@/components/ui/DataInput';
import { TOKEN_ICONS, JOE_ICON } from '@/features/avax-lp/config';
import type { AvaxLpAction, AvaxLpPool, AvaxLpUserPosition } from '@/features/avax-lp/types';
import { formatAmountHuman } from '@/features/swap/utils';

const ACTION_TABS: { id: AvaxLpAction; label: string }[] = [
  { id: 'enter', label: 'Enter' },
  { id: 'exit',  label: 'Exit' },
  { id: 'claim', label: 'Claim' },
];

function formatAPR(apr: string | null): string {
  if (!apr) return '--';
  const num = parseFloat(apr.replace('%', ''));
  if (isNaN(num)) return '--';
  const pct = apr.includes('%') ? num : num <= 1 ? num * 100 : num;
  return `${pct.toFixed(1)}%`;
}

function formatBalance(wei: string | undefined, decimals = 18): string {
  if (!wei) return '0';
  try {
    const num = parseFloat(wei) / 10 ** decimals;
    if (num < 0.0001 && num > 0) return '< 0.0001';
    return num.toFixed(4);
  } catch {
    return '0';
  }
}

function parseWei(value: string | null | undefined): bigint {
  if (!value || !/^\d+$/.test(value)) return 0n;
  try { return BigInt(value); } catch { return 0n; }
}

function formatWeiDisplay(wei: bigint, decimals = 18, maxFrac = 6): string {
  if (wei === 0n) return '0';
  const minNonZeroFractionDigits = Math.max(1, Math.min(maxFrac, decimals));
  const thresholdExp = decimals - minNonZeroFractionDigits;
  if (thresholdExp >= 0) {
    const threshold = 10n ** BigInt(thresholdExp);
    if (wei < threshold) return `< 0.${'0'.repeat(minNonZeroFractionDigits - 1)}1`;
  }
  return formatAmountHuman(wei, decimals, maxFrac);
}

function getTokenIcon(symbol: string): string | undefined {
  return TOKEN_ICONS[symbol];
}

function TokenBadge({ symbol }: { symbol: string }) {
  const icon = getTokenIcon(symbol);
  return (
    <div className="flex items-center gap-1.5 bg-black border border-white/10 rounded-full px-2.5 py-1.5 min-h-[36px]">
      {icon && <img src={icon} alt="" className="w-4 h-4 rounded-full" />}
      <span className="text-white font-medium text-sm">{symbol}</span>
    </div>
  );
}

interface AvaxLpInputViewProps {
  action: AvaxLpAction;
  onSelectAction: (action: AvaxLpAction) => void;
  pool: AvaxLpPool;
  amountA: string;
  amountB: string;
  setAmountA: (value: string) => void;
  setAmountB: (value: string) => void;
  exitAmount: string;
  setExitAmount: (value: string) => void;
  slippageBps: number;
  setSlippageBps: (value: number) => void;
  userPosition: AvaxLpUserPosition | null;
  walletBalances?: Record<string, string>;
  walletLpBalanceWei?: string;
  error: string | null;
  walletConnected: boolean;
  isPreparing?: boolean;
  onContinue: () => void;
}

const NUMERIC_REGEX = /^(\d+(\.\d*)?|\.\d*)$/;

export function AvaxLpInputView({
  action,
  onSelectAction,
  pool,
  amountA,
  amountB,
  setAmountA,
  setAmountB,
  exitAmount,
  setExitAmount,
  slippageBps,
  setSlippageBps,
  userPosition,
  walletBalances,
  walletLpBalanceWei,
  error,
  walletConnected,
  isPreparing = false,
  onContinue,
}: AvaxLpInputViewProps) {
  const hasFarm = pool.farmAddress !== null;
  const walletBalanceA = walletBalances?.[pool.tokenA.symbol];
  const walletBalanceB = walletBalances?.[pool.tokenB.symbol];

  const walletLpWei  = parseWei(walletLpBalanceWei ?? userPosition?.walletLpBalance);
  const stakedLpWei  = parseWei(userPosition?.stakedBalance);
  const totalLpWei   = walletLpWei + stakedLpWei;

  const walletLpDisplay  = formatWeiDisplay(walletLpWei, 18, 8);
  const stakedLpDisplay  = formatWeiDisplay(stakedLpWei, 18, 8);
  const totalLpDisplay   = formatWeiDisplay(totalLpWei, 18, 8);
  const maxExitAmount    = totalLpWei > 0n ? formatAmountHuman(totalLpWei, 18, 10) : '';

  const pendingRewards = userPosition?.pendingRewards;
  const hasRewards     = pendingRewards ? parseFloat(pendingRewards) > 0 : false;

  const isEnterValid = amountA.length > 0 && parseFloat(amountA) > 0 && amountB.length > 0 && parseFloat(amountB) > 0;
  const isExitValid  = exitAmount.length > 0 && parseFloat(exitAmount) > 0;
  const hasPosition  = totalLpWei > 0n;

  const continueBlockedReason = !walletConnected
    ? 'Connect wallet to continue.'
    : isPreparing
      ? 'Preparing transaction bundle...'
      : action === 'enter' && !isEnterValid
        ? `Enter valid amounts for both ${pool.tokenA.symbol} and ${pool.tokenB.symbol}.`
        : action === 'exit' && !isExitValid
          ? 'Enter a valid LP amount to exit.'
          : action === 'exit' && !hasPosition
            ? 'No LP position found.'
            : action === 'claim' && !hasFarm
              ? 'This pool has no active farm.'
              : action === 'claim' && !hasRewards
                ? 'No JOE rewards available to claim yet.'
                : null;

  const canContinue = continueBlockedReason === null;

  const ctaLabel =
    action === 'enter' ? 'Review Enter Position'
    : action === 'exit' ? 'Review Exit Position'
    : 'Claim JOE Rewards';

  return (
    <motion.div
      key="input"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full"
    >
      <div className="px-4 sm:px-6 pb-6 space-y-3 relative z-10 flex-1 flex flex-col">
        {/* Action tabs */}
        <div className="grid grid-cols-3 gap-1 bg-white/5 rounded-xl p-1">
          {ACTION_TABS.map((tab) => {
            const tabDisabled = tab.id === 'claim' && !hasFarm;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => !tabDisabled && onSelectAction(tab.id)}
                title={tabDisabled ? 'No active farm for this pool' : undefined}
                className={`py-2 px-1 rounded-lg text-[11px] font-medium transition-all ${
                  action === tab.id && !tabDisabled
                    ? 'bg-orange-500/15 text-white border border-orange-500/30'
                    : tabDisabled
                      ? 'text-zinc-600 border border-transparent cursor-not-allowed'
                      : 'text-zinc-400 hover:text-white border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Pool info */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {getTokenIcon(pool.tokenA.symbol) && (
                  <img src={getTokenIcon(pool.tokenA.symbol)} alt="" className="w-5 h-5 rounded-full ring-1 ring-black" />
                )}
                {getTokenIcon(pool.tokenB.symbol) && (
                  <img src={getTokenIcon(pool.tokenB.symbol)} alt="" className="w-5 h-5 rounded-full ring-1 ring-black" />
                )}
              </div>
              <span className="text-sm font-medium text-white">{pool.tokenA.symbol} / {pool.tokenB.symbol}</span>
            </div>
            {pool.estimatedAPR && (
              <div className="flex items-center gap-1 text-xs">
                <TrendingUp className="w-3 h-3 text-orange-400" />
                <span className="text-orange-400 font-semibold">{formatAPR(pool.estimatedAPR)} APR</span>
              </div>
            )}
          </div>
        </div>

        {/* Enter — add liquidity + optional stake */}
        {action === 'enter' && (
          <>
            <DataInput
              label={pool.tokenA.symbol}
              balance={walletBalanceA ? `Balance: ${walletBalanceA}` : undefined}
              onMaxClick={walletBalanceA ? () => setAmountA(walletBalanceA) : undefined}
              value={amountA}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || NUMERIC_REGEX.test(v)) setAmountA(v);
              }}
              placeholder="0.00"
              rightElement={<TokenBadge symbol={pool.tokenA.symbol} />}
            />
            <DataInput
              label={pool.tokenB.symbol}
              balance={walletBalanceB ? `Balance: ${walletBalanceB}` : undefined}
              onMaxClick={walletBalanceB ? () => setAmountB(walletBalanceB) : undefined}
              value={amountB}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || NUMERIC_REGEX.test(v)) setAmountB(v);
              }}
              placeholder="0.00"
              rightElement={<TokenBadge symbol={pool.tokenB.symbol} />}
            />

            <div className="flex items-center gap-2 px-1">
              <span className="text-[11px] text-zinc-500">Slippage</span>
              {[50, 100, 200].map((bps) => (
                <button
                  key={bps}
                  type="button"
                  onClick={() => setSlippageBps(bps)}
                  className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
                    slippageBps === bps
                      ? 'bg-orange-500/15 border-orange-500/30 text-white'
                      : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  {(bps / 100).toFixed(1)}%
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-white/10 bg-orange-500/5 px-3 py-2 text-[11px] text-zinc-400 leading-relaxed">
              {hasFarm
                ? 'Deposits both tokens, mints LP, and automatically stakes in the farm — all in one transaction.'
                : 'Deposits both tokens and mints LP tokens to your wallet.'}
            </div>
          </>
        )}

        {/* Exit — unstake + remove liquidity */}
        {action === 'exit' && (
          <>
            {totalLpWei > 0n ? (
              <>
                <DataInput
                  label="LP Tokens to Exit"
                  balance={
                    `Total: ${totalLpDisplay}` +
                    (stakedLpWei > 0n ? ` | Staked: ${stakedLpDisplay}` : '') +
                    (walletLpWei > 0n ? ` | Wallet: ${walletLpDisplay}` : '')
                  }
                  onMaxClick={totalLpWei > 0n ? () => setExitAmount(maxExitAmount) : undefined}
                  value={exitAmount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || NUMERIC_REGEX.test(v)) setExitAmount(v);
                  }}
                  placeholder="0.00"
                  rightElement={
                    <div className="flex items-center gap-1.5 bg-black border border-white/10 rounded-full px-2.5 py-1.5 min-h-[36px]">
                      <span className="text-white font-medium text-sm">LP</span>
                    </div>
                  }
                />
                <div className="rounded-xl border border-white/10 bg-orange-500/5 px-3 py-2 text-[11px] text-zinc-400 leading-relaxed">
                  {stakedLpWei > 0n
                    ? `Unstakes from the farm and removes liquidity in one transaction. Returns ${pool.tokenA.symbol} + ${pool.tokenB.symbol} to your wallet.`
                    : `Removes liquidity and returns ${pool.tokenA.symbol} + ${pool.tokenB.symbol} to your wallet.`}
                </div>
              </>
            ) : (
              <div className="bg-zinc-500/10 border border-zinc-500/20 rounded-xl p-4 text-center space-y-2">
                <AlertTriangle className="w-8 h-8 text-zinc-500 mx-auto" />
                <p className="text-sm text-zinc-500">No LP position found</p>
                <p className="text-[11px] text-zinc-600">Add liquidity first to create a position.</p>
              </div>
            )}
          </>
        )}

        {/* Claim */}
        {action === 'claim' && (
          hasFarm ? (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 text-center space-y-2">
              <img src={JOE_ICON} alt="JOE" className="w-10 h-10 rounded-full mx-auto" />
              <p className="text-sm text-orange-400 font-medium">
                {hasRewards
                  ? `${formatBalance(pendingRewards!, userPosition?.rewardToken?.decimals)} JOE`
                  : 'No rewards available'}
              </p>
              <p className="text-[11px] text-zinc-500">
                {hasRewards
                  ? 'Claim all pending JOE rewards from the farm.'
                  : 'Stake LP tokens to start earning JOE rewards.'}
              </p>
            </div>
          ) : (
            <div className="bg-zinc-500/10 border border-zinc-500/20 rounded-xl p-4 text-center space-y-2">
              <AlertTriangle className="w-8 h-8 text-zinc-500 mx-auto" />
              <p className="text-sm text-zinc-500">This pool has no active farm</p>
              <p className="text-[11px] text-zinc-600">Rewards are only available for pools with a MasterChef farm.</p>
            </div>
          )
        )}

        {/* Position summary */}
        {userPosition && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-1.5">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Your Position</span>
            {parseFloat(userPosition.walletLpBalance) > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Wallet LP</span>
                <span className="text-white font-mono">{formatBalance(userPosition.walletLpBalance)}</span>
              </div>
            )}
            {parseFloat(userPosition.stakedBalance) > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Staked LP</span>
                <span className="text-white font-mono">{formatBalance(userPosition.stakedBalance)}</span>
              </div>
            )}
            {parseFloat(userPosition.pendingRewards) > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Pending JOE</span>
                <span className="text-orange-400 font-mono">
                  {formatBalance(userPosition.pendingRewards, userPosition.rewardToken?.decimals)} {userPosition.rewardToken?.symbol}
                </span>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="flex-1" />

        <NeonButton
          onClick={onContinue}
          disabled={!canContinue}
          title={continueBlockedReason ?? undefined}
          className={!canContinue ? 'opacity-60 cursor-not-allowed' : ''}
        >
          {isPreparing ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Preparing...
            </span>
          ) : !walletConnected ? 'Connect Wallet' : ctaLabel}
        </NeonButton>
        {!canContinue && continueBlockedReason && (
          <div className="text-center text-[11px] text-zinc-500 px-2">
            {continueBlockedReason}
          </div>
        )}
      </div>
    </motion.div>
  );
}

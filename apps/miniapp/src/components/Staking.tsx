import { motion, AnimatePresence } from "framer-motion";
import {
  Droplets,
  ArrowDown,
  X,
  ArrowLeft,
  ArrowRight,
  Receipt,
  Check,
  ExternalLink,
  AlertCircle,
  Clock,
  RefreshCcw,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { DataInput } from "@/components/ui/DataInput";
import { useStakingApi, type PortfolioResponse, type StakingTransaction, type WithdrawalRequest } from "@/features/staking/api";
import { useStakingData } from "@/features/staking/useStakingData";
import { useActiveAccount } from "thirdweb/react";
import { swapApi } from "@/features/swap/api";
import { normalizeToApi, parseAmountToWei, formatAmountHuman } from "@/features/swap/utils";
import type { QuoteResponse, PreparedTx } from "@/features/swap/types";
import { THIRDWEB_CLIENT_ID } from "@/shared/config/thirdweb";

// Feature flags
import { FEATURE_FLAGS, FEATURE_METADATA } from "@/config/features";

// Token icons from CoinGecko
const ETH_ICON = 'https://assets.coingecko.com/coins/images/279/small/ethereum.png';
const STETH_ICON = 'https://assets.coingecko.com/coins/images/13442/small/steth_logo.png';

interface StakingProps {
  onClose: () => void;
  initialAmount?: string;
  initialMode?: 'stake' | 'unstake';
  variant?: 'modal' | 'panel';
}

type ViewState = 'input' | 'review' | 'success';
type ActionMode = 'stake' | 'unstake';
type StakeMethod = 'mint' | 'swap';
type UnstakeMethod = 'instant' | 'queue';

type MethodToggleProps = {
  leftLabel: string;
  rightLabel: string;
  leftActive: boolean;
  onLeft: () => void;
  onRight: () => void;
};

function MethodToggle({ leftLabel, rightLabel, leftActive, onLeft, onRight }: MethodToggleProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={onLeft}
        className={`py-2 rounded-xl border transition-colors text-[11px] font-medium ${
          leftActive
            ? 'bg-white/10 border-white/20 text-white'
            : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
        }`}
      >
        {leftLabel}
      </button>
      <button
        type="button"
        onClick={onRight}
        className={`py-2 rounded-xl border transition-colors text-[11px] font-medium ${
          !leftActive
            ? 'bg-white/10 border-white/20 text-white'
            : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
        }`}
      >
        {rightLabel}
      </button>
    </div>
  );
}

function safeParseBigInt(value: string | null | undefined): bigint | null {
  if (!value) return null;
  if (!/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function formatWei(wei: string | null | undefined, decimals = 18): string {
  const parsed = safeParseBigInt(wei);
  if (parsed == null) return '--';
  const human = formatAmountHuman(parsed, decimals, 6);
  return human === '0' ? '0.00' : human;
}

function formatAPY(apy: number | null | undefined): string {
  if (apy == null || !Number.isFinite(apy)) return '--';
  return `${apy.toFixed(4)}%`;
}

export function Staking({ onClose, initialAmount, initialMode = 'stake', variant = 'modal' }: StakingProps) {
  const account = useActiveAccount();
  const stakingApi = useStakingApi();
  const { tokens, userPosition, loading: loadingCore, error: coreError, refresh } = useStakingData();

  const [viewState, setViewState] = useState<ViewState>('input');
  const [isStaking, setIsStaking] = useState(false);
  const [mode, setMode] = useState<ActionMode>(initialMode);
  const [stakeMethod, setStakeMethod] = useState<StakeMethod>('mint');
  const [unstakeMethod, setUnstakeMethod] = useState<UnstakeMethod>('instant');
  const [stakeAmount, setStakeAmount] = useState(() => (initialMode === 'stake' && initialAmount ? initialAmount : "0.01"));
  const [unstakeAmount, setUnstakeAmount] = useState(() => (initialMode === 'unstake' && initialAmount ? initialAmount : ""));
  const [stakingError, setStakingError] = useState<string | null>(null);
  const [txWarning, setTxWarning] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txSummary, setTxSummary] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [swapQuote, setSwapQuote] = useState<QuoteResponse['quote'] | null>(null);
  const [quoting, setQuoting] = useState(false);

  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [history, setHistory] = useState<StakingTransaction[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [loadingExtras, setLoadingExtras] = useState(false);
  const [extrasError, setExtrasError] = useState<string | null>(null);
  const [ethBalanceHuman, setEthBalanceHuman] = useState<string | null>(null);
  const [loadingEthBalance, setLoadingEthBalance] = useState(false);
  const [ethBalanceWei, setEthBalanceWei] = useState<bigint | null>(null);

  const stEthBalanceWei = userPosition?.stETHBalance ?? null;
  const stEthBalanceHuman = useMemo(() => {
    const parsed = safeParseBigInt(stEthBalanceWei);
    if (parsed == null) return null;
    return formatAmountHuman(parsed, 18, 6);
  }, [stEthBalanceWei]);

  // Lido liquid staking here is Ethereum Mainnet only
  const STAKE_SYMBOL = "ETH";

  const protocolAPY = useMemo(() => {
    const eth = tokens.find((t) => t.symbol === 'ETH') || tokens.find((t) => t.symbol === 'stETH');
    return eth?.stakingAPY ?? null;
  }, [tokens]);

  const isValidAmountInput = useCallback((value: string) => {
    // allow empty while typing
    if (value === '') return true;
    // basic decimal validation
    if (!/^\d*\.?\d*$/.test(value)) return false;
    // allow "." while typing (we'll normalize display elsewhere)
    if (value === '.') return true;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0;
  }, []);

  const resolveJwtAddress = useCallback(() => {
    try {
      if (typeof window === 'undefined') return null;
      const token = localStorage.getItem('authToken');
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.sub || payload.address || null;
    } catch {
      return null;
    }
  }, []);

  const jwtAddress = useMemo(() => resolveJwtAddress(), [resolveJwtAddress]);
  const effectiveAddress = useMemo(() => {
    return account?.address || jwtAddress || null;
  }, [account?.address, jwtAddress]);
  const addressMismatch = useMemo(() => {
    return !!(jwtAddress && account?.address && jwtAddress.toLowerCase() !== account.address.toLowerCase());
  }, [account?.address, jwtAddress]);

  const stakeReceiveAmount = useMemo(() => {
    // Minted stETH (Lido submit) is effectively 1:1 at submission time.
    // For "Swap" method we show backend quote (market) instead.
    if (mode === 'stake' && stakeMethod === 'swap') {
      const outWei = swapQuote?.estimatedReceiveAmount || swapQuote?.toAmount;
      if (!outWei) return '0';
      try {
        return formatAmountHuman(BigInt(outWei), 18, 6);
      } catch {
        return '0';
      }
    }
    if (!isValidAmountInput(stakeAmount)) return '0';
    if (stakeAmount === '' || stakeAmount === '.') return '0';
    return stakeAmount;
  }, [isValidAmountInput, mode, stakeAmount, stakeMethod, swapQuote]);

  const unstakeReceiveAmount = useMemo(() => {
    // Withdrawal queue is ~1:1 estimate. Instant (swap) uses backend quote.
    if (mode === 'unstake' && unstakeMethod === 'instant') {
      const outWei = swapQuote?.estimatedReceiveAmount || swapQuote?.toAmount;
      if (!outWei) return '0';
      try {
        return formatAmountHuman(BigInt(outWei), 18, 6);
      } catch {
        return '0';
      }
    }
    if (!isValidAmountInput(unstakeAmount)) return '0';
    if (unstakeAmount === '' || unstakeAmount === '.') return '0';
    return unstakeAmount;
  }, [isValidAmountInput, mode, unstakeAmount, unstakeMethod, swapQuote]);

  const shouldQuoteSwap = useMemo(() => {
    if (mode === 'stake') return stakeMethod === 'swap';
    return unstakeMethod === 'instant';
  }, [mode, stakeMethod, unstakeMethod]);

  const quoteInputAmount = useMemo(() => {
    if (mode === 'stake') return stakeAmount;
    return unstakeAmount;
  }, [mode, stakeAmount, unstakeAmount]);

  useEffect(() => {
    if (!shouldQuoteSwap) {
      setSwapQuote(null);
      return;
    }
    if (!isValidAmountInput(quoteInputAmount) || quoteInputAmount === '' || quoteInputAmount === '.') {
      setSwapQuote(null);
      return;
    }

    const fromToken =
      mode === 'stake'
        ? '0x0000000000000000000000000000000000000000' // ETH
        : '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84'; // stETH
    const toToken =
      mode === 'stake'
        ? '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84' // stETH
        : '0x0000000000000000000000000000000000000000'; // ETH

    const amount = quoteInputAmount.trim();
    if (!amount || Number(amount) <= 0) {
      setSwapQuote(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      setQuoting(true);
      swapApi
        .quote({
          fromChainId: 1,
          toChainId: 1,
          fromToken: normalizeToApi(fromToken),
          toToken: normalizeToApi(toToken),
          amount,
          unit: 'token',
          smartAccountAddress: account?.address || null,
        })
        .then((res) => {
          if (cancelled) return;
          if (!res.success || !res.quote) {
            setSwapQuote(null);
            return;
          }
          setSwapQuote(res.quote);
        })
        .catch(() => {
          if (cancelled) return;
          setSwapQuote(null);
        })
        .finally(() => {
          if (cancelled) return;
          setQuoting(false);
        });
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [account?.address, isValidAmountInput, mode, quoteInputAmount, shouldQuoteSwap]);

  useEffect(() => {
    let cancelled = false;
    if (!effectiveAddress || !THIRDWEB_CLIENT_ID) {
      setEthBalanceHuman(null);
      setEthBalanceWei(null);
      return;
    }
    setLoadingEthBalance(true);

    const fetchEthBalance = async () => {
      try {
        const { createThirdwebClient, defineChain } = await import("thirdweb");
        const { eth_getBalance, getRpcClient } = await import("thirdweb/rpc");
        const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });
        const rpcRequest = getRpcClient({ client, chain: defineChain(1) });
        const balanceWei = await eth_getBalance(rpcRequest, { address: effectiveAddress as `0x${string}` });
        if (cancelled) return;
        setEthBalanceWei(balanceWei);
        setEthBalanceHuman(formatAmountHuman(balanceWei, 18, 6));
      } catch {
        if (!cancelled) setEthBalanceHuman(null);
        if (!cancelled) setEthBalanceWei(null);
      } finally {
        if (!cancelled) setLoadingEthBalance(false);
      }
    };

    fetchEthBalance();

    return () => {
      cancelled = true;
    };
  }, [effectiveAddress]);

  const pendingWithdrawalsCount = useMemo(() => {
    return withdrawals.filter((w) => !w.isClaimed).length;
  }, [withdrawals]);

  const loadExtras = useCallback(async (opts?: { includeAdvanced?: boolean }) => {
    setLoadingExtras(true);
    setExtrasError(null);
    try {
      const includeAdvanced = !!opts?.includeAdvanced;
      const [w, h, p] = await Promise.all([
        stakingApi.getWithdrawals(),
        includeAdvanced ? stakingApi.getHistory(10) : Promise.resolve([] as StakingTransaction[]),
        includeAdvanced ? stakingApi.getPortfolio(30) : Promise.resolve(null),
      ]);
      setWithdrawals(w);
      setHistory(h);
      setPortfolio(p);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load staking details';
      setExtrasError(message);
    } finally {
      setLoadingExtras(false);
    }
  }, [stakingApi]);

  useEffect(() => {
    // Load withdrawals by default (needed for claim/pending status).
    void loadExtras({ includeAdvanced: false });
  }, [loadExtras]);

  const refreshAll = useCallback(async () => {
    refresh();
    await loadExtras({ includeAdvanced: showAdvanced });
  }, [loadExtras, refresh, showAdvanced]);

  useEffect(() => {
    if (viewState === 'input') {
      setStakingError(null);
      setTxWarning(null);
    }
  }, [viewState, mode, stakeMethod, unstakeMethod]);

  const submitHashSafely = useCallback(async (id: string, hash: string) => {
    try {
      await stakingApi.submitTransactionHash(id, hash);
      return null;
    } catch (err) {
      console.warn('[STAKING] Failed to submit tx hash to backend:', err);
      return 'Transaction sent on-chain, but backend sync failed. Balances may update with a delay.';
    }
  }, [stakingApi]);

  // Handle staking action - calls the real Lido staking API
  const handleStake = async () => {
    setIsStaking(true);
    setStakingError(null);
    setTxWarning(null);
    setTxHash(null);
    setTxSummary(null);

    try {
      if (addressMismatch) {
        throw new Error(`Connected wallet does not match session address (${jwtAddress}). Please connect the correct wallet.`);
      }
      if (stakeMethod === 'swap') {
        if (!account?.address) throw new Error('Wallet session not available.');
        const stakeWei = parseAmountToWei(stakeAmount, 18);
        if (ethBalanceWei && stakeWei > ethBalanceWei) {
          throw new Error(`Insufficient ETH balance. Available: ${ethBalanceHuman}`);
        }
        if (stakeWei <= 0n) throw new Error('Enter a valid amount.');
        const prep = await swapApi.prepare({
          fromChainId: 1,
          toChainId: 1,
          fromToken: normalizeToApi('0x0000000000000000000000000000000000000000'),
          toToken: normalizeToApi('0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84'),
          amount: stakeWei.toString(),
          sender: account.address,
          provider: swapQuote?.provider,
        });

        const flattenPrepared = (prepared: any): PreparedTx[] => {
          const out: PreparedTx[] = [];
          if (!prepared) return out;
          if (Array.isArray(prepared.transactions)) out.push(...prepared.transactions);
          if (Array.isArray(prepared.steps)) {
            for (const s of prepared.steps) {
              if (Array.isArray(s.transactions)) out.push(...s.transactions);
            }
          }
          return out;
        };

        const seq = flattenPrepared(prep.prepared);
        if (!seq.length) throw new Error('No transactions returned by swap prepare');

        const gasEstimate = estimateTotalGasWei(seq) ?? GAS_BUFFER_WEI;
        if (ethBalanceWei && stakeWei + gasEstimate > ethBalanceWei) {
          throw new Error('Insufficient ETH for amount + gas. Reduce amount or add ETH.');
        }

        let lastHash: string | null = null;
        for (const t of seq) {
          lastHash = await stakingApi.executeTransaction(t);
        }
        if (!lastHash) throw new Error('Swap failed: no tx hash');
        setTxHash(lastHash);
        setTxSummary(`Stake (market): ${stakeAmount} ETH → stETH`);
        setViewState('success');
        await refreshAll();
        return;
      }

      // Step 1: Get transaction data from staking API
      console.log('[STAKING] Requesting stake transaction for', stakeAmount, STAKE_SYMBOL);
      const stakeTx = await stakingApi.stake(stakeAmount);

      if (!stakeTx || !stakeTx.transactionData) {
        throw new Error('No transaction data received from staking service');
      }

      console.log('[STAKING] Received transaction data:', stakeTx);

      // Step 2: Execute the transaction (opens MetaMask)
      console.log('[STAKING] Executing transaction...');
      const stakeWei = parseAmountToWei(stakeAmount, 18);
      if (ethBalanceWei && stakeWei + GAS_BUFFER_WEI > ethBalanceWei) {
        throw new Error('Insufficient ETH for amount + gas. Reduce amount or add ETH.');
      }
      const hash = await stakingApi.executeTransaction(stakeTx.transactionData);
      const warn = await submitHashSafely(stakeTx.id, hash);
      if (warn) setTxWarning(warn);

      console.log('[STAKING] Transaction successful! Hash:', hash);
      setTxHash(hash);
      setTxSummary(`Stake ${stakeAmount} ETH`);
      setViewState('success');
      await refreshAll();
    } catch (error) {
      console.error('[STAKING] Error:', error);
      setStakingError(error instanceof Error ? error.message : 'Staking failed. Please try again.');
    } finally {
      setIsStaking(false);
    }
  };

  const handleUnstake = useCallback(async () => {
    setIsStaking(true);
    setStakingError(null);
    setTxWarning(null);
    setTxHash(null);
    setTxSummary(null);

    try {
      if (addressMismatch) {
        throw new Error(`Connected wallet does not match session address (${jwtAddress}). Please connect the correct wallet.`);
      }
      if (!unstakeAmount || Number(unstakeAmount) <= 0) {
        throw new Error('Enter a valid unstake amount.');
      }

      if (unstakeMethod === 'instant') {
        if (!account?.address) throw new Error('Wallet session not available.');
        const unstakeWei = parseAmountToWei(unstakeAmount, 18);
        if (stEthBalanceWei) {
          const stEthWei = safeParseBigInt(stEthBalanceWei) ?? 0n;
          if (unstakeWei > stEthWei) {
            throw new Error(`Insufficient stETH balance. Available: ${stEthBalanceHuman}`);
          }
        }
        if (unstakeWei <= 0n) throw new Error('Enter a valid amount.');
        const prep = await swapApi.prepare({
          fromChainId: 1,
          toChainId: 1,
          fromToken: normalizeToApi('0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84'),
          toToken: normalizeToApi('0x0000000000000000000000000000000000000000'),
          amount: unstakeWei.toString(),
          sender: account.address,
          provider: swapQuote?.provider,
        });

        const flattenPrepared = (prepared: any): PreparedTx[] => {
          const out: PreparedTx[] = [];
          if (!prepared) return out;
          if (Array.isArray(prepared.transactions)) out.push(...prepared.transactions);
          if (Array.isArray(prepared.steps)) {
            for (const s of prepared.steps) {
              if (Array.isArray(s.transactions)) out.push(...s.transactions);
            }
          }
          return out;
        };

        const seq = flattenPrepared(prep.prepared);
        if (!seq.length) throw new Error('No transactions returned by swap prepare');

        const gasEstimate = estimateTotalGasWei(seq) ?? GAS_BUFFER_WEI;
        if (ethBalanceWei && gasEstimate > ethBalanceWei) {
          throw new Error('Insufficient ETH to cover gas for swap. Add ETH.');
        }

        let lastHash: string | null = null;
        for (const t of seq) {
          lastHash = await stakingApi.executeTransaction(t);
        }
        if (!lastHash) throw new Error('Swap failed: no tx hash');
        setTxHash(lastHash);
        setTxSummary(`Unstake (market): stETH → ETH`);
        setViewState('success');
        await refreshAll();
        return;
      }

      const attemptUnstakeRequest = async (): Promise<StakingTransaction> => {
        const tx = await stakingApi.unstake(unstakeAmount);
        if (!tx?.transactionData) {
          throw new Error('No transaction data received from staking service');
        }
        return tx;
      };

      const executeAndSubmit = async (tx: StakingTransaction): Promise<string> => {
        const hash = await stakingApi.executeTransaction(tx.transactionData);
        const warn = await submitHashSafely(tx.id, hash);
        if (warn) setTxWarning(warn);
        return hash;
      };

      // 1) First call may be approval OR unstake request
      const firstTx = await attemptUnstakeRequest();
      const firstHash = await executeAndSubmit(firstTx);

      // 2) If approval required, try to continue automatically once it is mined.
      if (firstTx.requiresFollowUp && firstTx.followUpAction === 'unstake') {
        // Best-effort: poll backend allowance state (it checks on-chain) with small delay.
        let secondTx: StakingTransaction | null = null;
        for (let i = 0; i < 6; i++) {
          await new Promise((r) => setTimeout(r, 2500));
          const tx = await attemptUnstakeRequest();
          if (tx.type === 'unstake') {
            secondTx = tx;
            break;
          }
        }

        if (!secondTx) {
          throw new Error('Approval submitted. Wait for confirmation, then try unstake again to create the withdrawal request.');
        }

        const secondHash = await executeAndSubmit(secondTx);
        setTxHash(secondHash);
        setTxSummary(`Request ETH withdrawal (standard)`);
        setViewState('success');
        await refreshAll();
        return;
      }

      // Direct unstake request (allowance already OK)
      setTxHash(firstHash);
      setTxSummary(`Request ETH withdrawal (standard)`);
      setViewState('success');
      await refreshAll();
    } catch (error) {
      console.error('[UNSTAKE] Error:', error);
      setStakingError(error instanceof Error ? error.message : 'Unstake failed. Please try again.');
    } finally {
      setIsStaking(false);
    }
  }, [account?.address, addressMismatch, jwtAddress, refreshAll, stakingApi, submitHashSafely, swapQuote?.provider, stEthBalanceHuman, unstakeAmount, unstakeMethod]);

  const claimableRequestIds = useMemo(() => {
    return withdrawals
      .filter((w) => w.isFinalized && !w.isClaimed)
      .map((w) => String(w.requestId));
  }, [withdrawals]);

  const handleClaimAll = useCallback(async () => {
    if (!claimableRequestIds.length) return;
    setIsStaking(true);
    setStakingError(null);
    setTxWarning(null);
    setTxHash(null);
    setTxSummary(null);
    try {
      if (addressMismatch) {
        throw new Error(`Connected wallet does not match session address (${jwtAddress}). Please connect the correct wallet.`);
      }
      const tx = await stakingApi.claimWithdrawals(claimableRequestIds);
      if (!tx?.transactionData) throw new Error('No claim transaction data received');
      const hash = await stakingApi.executeTransaction(tx.transactionData);
      const warn = await submitHashSafely(tx.id, hash);
      if (warn) setTxWarning(warn);
      setTxHash(hash);
      setTxSummary(`Claim withdrawals (${claimableRequestIds.length})`);
      setViewState('success');
      await refreshAll();
    } catch (e) {
      setStakingError(e instanceof Error ? e.message : 'Claim failed.');
    } finally {
      setIsStaking(false);
    }
  }, [claimableRequestIds, refreshAll, stakingApi, submitHashSafely]);

  // Responsive variants
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const modalVariants = {
    initial: isMobile ? { y: "100%", opacity: 0 } : { scale: 0.95, opacity: 0 },
    animate: isMobile ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1 },
    exit: isMobile ? { y: "100%", opacity: 0 } : { scale: 0.95, opacity: 0 },
  };

  // Coming Soon State
  if (!FEATURE_FLAGS.STAKING_ENABLED) {
    const metadata = FEATURE_METADATA.staking;
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          variants={modalVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-[340px] md:max-w-[400px]"
          onClick={(e) => e.stopPropagation()}
        >
          <GlassCard className="w-full shadow-2xl overflow-hidden relative bg-[#0A0A0A] border-white/10 flex flex-col rounded-2xl border">
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between relative z-10 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Droplets className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Liquid Staking</h2>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Coming Soon</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            {/* Coming Soon Content - Compact */}
            <div className="px-4 py-5 text-center">
              <div className="mb-4 flex justify-center">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                    <Clock className="w-7 h-7 text-cyan-400" />
                  </div>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-cyan-400 text-xs font-medium">Coming Soon</span>
              </div>

              <h3 className="text-lg font-bold text-white mb-1.5">{metadata?.name || 'Liquid Staking'}</h3>
              <p className="text-zinc-400 text-xs leading-relaxed mb-3">{metadata?.description || 'This feature is under development.'}</p>

              {metadata?.expectedLaunch && (
                <p className="text-zinc-500 text-[10px]">Expected: {metadata.expectedLaunch}</p>
              )}
            </div>

            {/* Footer - Only Go to Chat */}
            <div className="px-4 py-3 border-t border-white/5">
              <NeonButton onClick={onClose} className="w-full text-sm py-2.5">
                Go to Chat
              </NeonButton>
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    );
  }

  const card = (
    <GlassCard
      className="w-full shadow-2xl overflow-hidden relative bg-[#0A0A0A] border-white/10 max-h-[78vh] md:max-h-[85vh] md:h-auto md:min-h-[540px] flex flex-col rounded-2xl border pb-safe overflow-y-auto"
    >
          {/* Gradient Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-primary/10 blur-[60px] pointer-events-none" />

          <AnimatePresence mode="wait">
          {/* --- STATE 1: INPUT --- */}
          {viewState === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col h-full"
            >
              {/* Header */}
              <div className="p-6 flex items-center justify-between relative z-10">
                 <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                      <Droplets className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-display font-bold text-white">Liquid Staking</h2>
                      <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
                        Stake ETH, keep liquidity
                      </div>
                    </div>
                 </div>
                 <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                 </button>
              </div>

              <div className="px-6 pb-8 space-y-2 relative z-10 flex-1 flex flex-col">

                {/* Mode toggle */}
	                <div className="grid grid-cols-2 gap-2">
	                  <button
	                    type="button"
	                    onClick={() => setMode('stake')}
	                    className={`py-2 rounded-xl border transition-colors text-xs font-medium ${
	                      mode === 'stake'
	                        ? 'bg-primary/15 border-primary/30 text-white'
	                        : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
	                    }`}
	                  >
		                    Stake (stETH)
	                  </button>
	                  <button
	                    type="button"
	                    onClick={() => {
	                      setMode('unstake');
	                    }}
	                    className={`py-2 rounded-xl border transition-colors text-xs font-medium ${
	                      mode === 'unstake'
	                        ? 'bg-primary/15 border-primary/30 text-white'
	                        : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
	                    }`}
	                  >
	                    Unstake (ETH)
	                  </button>
	                </div>

                {mode === 'stake' ? (
                  <>
                    {/* Stake method */}
                    <MethodToggle
                      leftLabel="Protocol (Lido)"
                      rightLabel="Best price (market)"
                      leftActive={stakeMethod === 'mint'}
                      onLeft={() => setStakeMethod('mint')}
                      onRight={() => setStakeMethod('swap')}
                    />

                    {/* Stake Input */}
                    <DataInput
                      label="You Pay"
                      value={stakeAmount}
                      balance={
                        loadingEthBalance
                          ? 'Available: ...'
                          : `Available: ${ethBalanceHuman ?? '--'} ETH`
                      }
                      onMaxClick={ethBalanceHuman ? () => setStakeAmount(ethBalanceHuman) : undefined}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (!isValidAmountInput(next)) return;
                        setStakeAmount(next);
                      }}
                      rightElement={
                        <div className="flex items-center gap-1.5 sm:gap-2 bg-black border border-white/10 rounded-full px-2.5 sm:px-3 py-1.5 sm:py-2 min-h-[40px] sm:min-h-[44px]">
                          <img src={ETH_ICON} alt="ETH" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full" />
                          <span className="text-white font-medium text-sm sm:text-base">{STAKE_SYMBOL}</span>
                        </div>
                      }
                    />

                    {/* Arrow Indicator */}
                    <div className="flex justify-center -my-3 relative z-20">
                      <button className="bg-[#0A0A0A] border border-white/10 p-1.5 sm:p-2 rounded-xl text-zinc-400 hover:text-primary hover:border-primary/50 transition-all">
                        <ArrowDown className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>

                    {/* Receive Input (Read Only) */}
	                    <DataInput
	                      label="You Get"
	                      value={stakeReceiveAmount}
                      placeholder=""
                      readOnly
                      className="text-zinc-400"
                      rightElement={
                        <div className="flex items-center gap-1.5 sm:gap-2 bg-black border border-white/10 rounded-full px-2.5 sm:px-3 py-1.5 sm:py-2 min-h-[40px] sm:min-h-[44px]">
                          <img src={STETH_ICON} alt="stETH" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full" />
                          <span className="text-white font-medium text-sm sm:text-base">stETH</span>
                        </div>
                      }
                    />
                  </>
                ) : (
                  <>
                    {/* Unstake method */}
                    <MethodToggle
                      leftLabel="Protocol (Lido)"
                      rightLabel="Best price (market)"
                      leftActive={unstakeMethod === 'queue'}
                      onLeft={() => setUnstakeMethod('queue')}
                      onRight={() => setUnstakeMethod('instant')}
                    />

                    {/* Unstake Input */}
                    <DataInput
                      label="You Pay"
                      value={unstakeAmount}
                      balance={`Available: ${stEthBalanceHuman ?? '--'} stETH`}
                      onMaxClick={stEthBalanceHuman ? () => setUnstakeAmount(stEthBalanceHuman) : undefined}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (!isValidAmountInput(next)) return;
                        setUnstakeAmount(next);
                      }}
                      placeholder="0.00"
                      rightElement={
                        <div className="flex items-center gap-1.5 sm:gap-2 bg-black border border-white/10 rounded-full px-2.5 sm:px-3 py-1.5 sm:py-2 min-h-[40px] sm:min-h-[44px]">
                          <img src={STETH_ICON} alt="stETH" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full" />
                          <span className="text-white font-medium text-sm sm:text-base">stETH</span>
                        </div>
                      }
                    />

                    {/* Receive (queue) */}
	                    <DataInput
	                      label="You Get"
	                      value={unstakeReceiveAmount}
                      placeholder=""
                      readOnly
                      className="text-zinc-400"
                      rightElement={
                        <div className="flex items-center gap-1.5 sm:gap-2 bg-black border border-white/10 rounded-full px-2.5 sm:px-3 py-1.5 sm:py-2 min-h-[40px] sm:min-h-[44px]">
                          <img src={ETH_ICON} alt="ETH" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full" />
                          <span className="text-white font-medium text-sm sm:text-base">ETH</span>
                        </div>
                      }
                    />
                  </>
                )}

                {/* Info Block */}
                <div className="py-2 flex flex-col gap-2 text-xs px-2 mt-4">
                  <div className="flex items-center gap-1 text-zinc-500">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>
                      {mode === 'stake'
                        ? (stakeMethod === 'swap' ? 'Market swap to stETH' : 'Mint stETH')
                        : (unstakeMethod === 'instant' ? 'Instant swap to ETH' : 'Withdrawal queue')
                      }
                      {' · '}APY {formatAPY(protocolAPY)}
                    </span>
                  </div>
                  {shouldQuoteSwap && (
                    <div className="text-[11px] text-zinc-600">
                      {quoting ? 'Calculating quote…' : swapQuote?.provider ? `Quote via ${swapQuote.provider}` : 'Quote unavailable.'}
                    </div>
                  )}
                  {mode === 'unstake' && unstakeMethod === 'queue' && (
                    <div className="text-[11px] text-zinc-600">
                      Standard is slower but avoids market slippage. Final amount is set by the withdrawal queue.
                    </div>
                  )}
                </div>

                {/* Position (real data only) */}
                <div className="mt-2 space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <div className="text-xs text-zinc-500">
                      <span className="text-white/90 font-medium">Your stETH</span>
                    </div>
                    <button
                      onClick={refreshAll}
                      className="inline-flex items-center gap-2 text-xs text-primary/90 hover:text-primary transition-colors"
                      disabled={loadingCore || loadingExtras}
                      type="button"
                    >
                      <RefreshCcw className={`w-3.5 h-3.5 ${loadingCore || loadingExtras ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 px-2">
                    <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">stETH</div>
                      <div className="mt-1 text-white font-mono text-sm">{formatWei(userPosition?.stETHBalance)}</div>
                    </div>
                    <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500">wstETH</div>
                      <div className="mt-1 text-white font-mono text-sm">{formatWei(userPosition?.wstETHBalance)}</div>
                    </div>
                  </div>

                  {/* Actionable claim (only when ready) */}
                  {claimableRequestIds.length > 0 && (
                    <div className="px-2">
                      <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-center justify-between gap-3">
                        <div className="text-xs text-zinc-300">
                          <span className="text-white font-medium">Withdrawal ready.</span> Claim {claimableRequestIds.length} to receive ETH.
                        </div>
                        <button
                          type="button"
                          onClick={handleClaimAll}
                          disabled={isStaking}
                          className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          Claim
                        </button>
                      </div>
                    </div>
                  )}

                  {claimableRequestIds.length === 0 && pendingWithdrawalsCount > 0 && (
                    <div className="px-2">
                      <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-[11px] text-zinc-500">
                        Pending withdrawals: <span className="text-white/90 font-mono">{pendingWithdrawalsCount}</span>
                      </div>
                    </div>
                  )}

                  {(coreError || extrasError) && (
                    <div className="px-2">
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        <p className="text-red-200 text-xs">
                          {coreError || extrasError}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Advanced (optional) */}
                  <div className="px-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const next = !showAdvanced;
                        setShowAdvanced(next);
                        if (next) {
                          await loadExtras({ includeAdvanced: true });
                        }
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-xs font-medium transition-colors inline-flex items-center justify-center gap-2"
                    >
                      Advanced
                      {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {showAdvanced && (
                      <motion.div
                        key="advanced"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="px-2 pt-2 space-y-3">
                          <div className="p-3 bg-black/20 border border-white/10 rounded-xl">
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-white font-medium">Recent activity</div>
                              <div className="text-[10px] text-zinc-500">Last 10</div>
                            </div>
                            <div className="mt-2 text-[11px] text-zinc-500">
                              {loadingExtras ? 'Loading…' : history.length === 0 ? 'No activity yet.' : `${history[0]?.type ?? 'tx'} · ${history[0]?.status ?? ''}`}
                            </div>
                          </div>

                          <div className="p-3 bg-black/20 border border-white/10 rounded-xl">
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-white font-medium">Tracking</div>
                              <div className="text-[10px] text-zinc-500">Last 30 days</div>
                            </div>
                            <div className="mt-2 text-[11px] text-zinc-500">
                              {loadingExtras
                                ? 'Loading…'
                                : !portfolio
                                  ? 'No portfolio data yet.'
                                  : portfolio.assets.length === 0 && portfolio.dailyMetrics.length === 0
                                    ? 'No snapshots tracked yet.'
                                    : `Assets: ${portfolio.assets.length} · Snapshots: ${portfolio.dailyMetrics.length}`}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Action Button */}
                <div className="mt-auto pt-4">
                  <NeonButton onClick={() => setViewState('review')}>
                    {mode === 'stake'
                      ? (stakeMethod === 'swap' ? 'Stake (market)' : 'Stake')
                      : (unstakeMethod === 'instant' ? 'Unstake (market)' : 'Unstake (queue)')}
                  </NeonButton>
                </div>

              </div>
            </motion.div>
          )}

          {/* --- STATE 2: REVIEW (Swap Mold) --- */}
          {viewState === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col h-full"
            >
              {/* Header */}
              <div className="p-6 flex items-center justify-between relative z-10">
                 <h2 className="text-lg font-display font-bold text-white">
                   {mode === 'stake'
                     ? (stakeMethod === 'swap' ? 'Confirm stake (market)' : 'Confirm stake')
                     : (unstakeMethod === 'instant' ? 'Confirm unstake (market)' : 'Confirm unstake (queue)')}
                 </h2>
                 <button onClick={() => setViewState('input')} className="text-zinc-500 hover:text-white">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
              </div>

              <div className="px-6 pb-8 flex-1 flex flex-col relative z-10 overflow-y-auto custom-scrollbar">
                
                {/* Top Highlights */}
                <div className="flex items-center justify-between mb-6">
                   <div className="flex items-center gap-2">
	                      <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded border border-blue-500/20 flex items-center gap-1">
	                        <Check className="w-3 h-3" />
	                        {mode === 'stake' ? 'Stake' : 'Unstake'}
	                      </span>
	                   </div>
	                </div>

                {/* Main Details Card (Swap Mold) */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4 space-y-4 mb-4">
                   <div className="flex items-center gap-2 mb-2">
	                      <span className="font-medium text-white text-sm sm:text-base">
	                       {mode === 'stake'
	                         ? (stakeMethod === 'swap' ? 'Stake (market)' : 'Stake (Lido)')
	                         : (unstakeMethod === 'instant' ? 'Unstake (market)' : 'Unstake (queue)')}
	                      </span>
                   </div>

                   {/* Visual Swap inside Card */}
                   <div className="flex items-center justify-center gap-3 sm:gap-4 py-3 bg-black/20 rounded-lg border border-white/5">
                     <div className="flex items-center gap-2">
                       <img src={mode === 'stake' ? ETH_ICON : STETH_ICON} alt="from" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full" />
                       <div className="text-left">
                         <div className="text-white font-mono text-sm sm:text-base font-bold">{mode === 'stake' ? stakeAmount : (unstakeAmount || '—')}</div>
                         <div className="text-zinc-500 text-[10px] sm:text-xs">{mode === 'stake' ? STAKE_SYMBOL : 'stETH'}</div>
                       </div>
                     </div>
                     <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-600" />
                     <div className="flex items-center gap-2">
                       <img src={mode === 'stake' ? STETH_ICON : ETH_ICON} alt="to" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full" />
                       <div className="text-left">
                         <div className="text-white font-mono text-sm sm:text-base font-bold">
                           {mode === 'stake' ? (stakeReceiveAmount || '—') : (unstakeReceiveAmount || '—')}
                         </div>
                          <div className="text-zinc-500 text-[10px] sm:text-xs">{mode === 'stake' ? 'stETH' : STAKE_SYMBOL}</div>
                        </div>
                      </div>
                   </div>

                   {mode === 'unstake' && unstakeMethod === 'queue' && (
                     <div className="text-[11px] text-zinc-500">
                       If approval is required, you may confirm 2 transactions (approve + request).
                     </div>
                   )}
                </div>

                {/* Secondary Info / Receipt */}
                {mode === 'stake' && (
                  <div className="space-y-3 mb-6">
                    <div className="flex items-start gap-3 p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                      <Receipt className="w-4 h-4 text-blue-400 mt-0.5" />
                      <div className="text-xs text-zinc-400 leading-relaxed">
                        stETH balance tracks staking rewards automatically.
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {stakingError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 mb-4">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-red-200 text-xs">{stakingError}</p>
                  </div>
                )}
                {txWarning && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2 mb-4">
                    <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <p className="text-amber-200 text-xs">{txWarning}</p>
                  </div>
                )}

                {/* Final Button */}
                <div className="mt-auto">
                  <NeonButton
                    onClick={mode === 'stake' ? handleStake : handleUnstake}
                    disabled={isStaking}
                    className="w-full bg-white text-black hover:bg-zinc-200 shadow-none disabled:opacity-50"
                  >
                    {isStaking
                      ? 'Confirming in Wallet...'
                      : mode === 'stake'
                        ? (stakeMethod === 'swap' ? 'Confirm stake (market)' : 'Confirm stake')
                        : (unstakeMethod === 'instant' ? 'Confirm unstake' : 'Confirm request')}
                  </NeonButton>
                  {isStaking && (
                    <p className="text-xs text-zinc-500 text-center mt-2">
                      Please confirm the transaction in your wallet
                    </p>
                  )}
                </div>

              </div>
            </motion.div>
          )}

          {/* --- STATE 3: SUCCESS --- */}
          {viewState === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col h-full items-center justify-center p-6"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
                <Check className="w-8 h-8 sm:w-10 sm:h-10 text-green-500" />
              </div>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-white mb-2">
                {mode === 'stake' ? 'Stake submitted!' : 'Unstake submitted!'}
              </h2>
              <div className="flex items-center justify-center gap-2 mb-2">
                <p className="text-zinc-400 text-center text-sm sm:text-base">
                  {txSummary || 'Transaction submitted'}
                </p>
              </div>
              {mode === 'stake' && (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <img src={STETH_ICON} alt="stETH" className="w-5 h-5 rounded-full" />
                  <p className="text-zinc-500 text-xs sm:text-sm text-center">
                    stETH will be minted to your wallet after confirmation
                  </p>
                </div>
              )}

              {/* Transaction Link */}
              {txHash && (
                <a
                  href={`https://etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-primary text-sm hover:bg-white/10 transition-colors mb-6"
                >
                  <span className="font-mono truncate max-w-[200px]">{txHash.slice(0, 10)}...{txHash.slice(-8)}</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              <div className="w-full space-y-3">
                <NeonButton onClick={onClose}>
                  Done
                </NeonButton>
                <button
                  onClick={() => {
                    setViewState('input');
                    setStakeAmount('0.01');
                    setUnstakeAmount('');
                    setTxHash(null);
                    setStakingError(null);
                    setTxWarning(null);
                    setTxSummary(null);
                  }}
                  className="w-full py-3 text-zinc-400 hover:text-white transition-colors"
                >
                  New Action
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FOOTER POWERED BY */}
        <div className="py-8 relative z-10 flex items-center justify-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
           <img src="/miniapp/icons/lido_logo.png" alt="Lido" className="w-8 h-8 rounded-full" />
           <span className="text-sm font-medium text-zinc-400">Powered by Lido</span>
        </div>

    </GlassCard>
  );

  if (variant === 'panel') {
    return (
      <div className="w-full max-w-[520px] mx-auto p-4">
        {card}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pb-20 md:pb-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        variants={modalVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full md:max-w-[480px] md:my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {card}
      </motion.div>
    </motion.div>
  );
}
  const toBigInt = (value?: string | number | bigint | null): bigint | null => {
    if (value === null || value === undefined) return null;
    try {
      if (typeof value === 'bigint') return value;
      const s = typeof value === 'string' ? value : value.toString();
      if (s.startsWith('0x')) return BigInt(s);
      return BigInt(s);
    } catch {
      return null;
    }
  };

  const estimateTotalGasWei = (txs: PreparedTx[]): bigint | null => {
    try {
      let total = 0n;
      let hasAny = false;
      for (const tx of txs) {
        const gasLimit = toBigInt(tx.gasLimit);
        const maxFee = toBigInt(tx.maxFeePerGas);
        if (gasLimit && maxFee) {
          total += gasLimit * maxFee;
          hasAny = true;
        }
      }
      return hasAny ? total : null;
    } catch {
      return null;
    }
  };

  const GAS_BUFFER_WEI = 2_000_000_000_000_000n; // 0.002 ETH buffer

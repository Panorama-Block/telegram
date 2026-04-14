import { AnimatePresence } from "framer-motion";
import { ArrowLeft, Droplets, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { StakingInputView } from "@/components/staking/StakingInputView";
import { StakingStatusView } from "@/components/staking/StakingStatusView";
import { type StakingTxStage } from "@/components/staking/stakingTxState";
import { StakingReviewView } from "@/components/staking/StakingReviewView";
import { DefiWidgetModalShell } from "@/components/ui/DefiWidgetModalShell";
import { startSwapTracking, type SwapTracker } from "@/features/gateway";
import {
  useStakingApi,
  type StakingTransaction,
  type WithdrawalRequest,
} from "@/features/staking/api";
import { useStakingData } from "@/features/staking/useStakingData";
import type { PreparedTx } from "@/features/swap/types";
import { formatAmountHuman, parseAmountToWei } from "@/features/swap/utils";
import { useRateLimitCountdown, parseRetryAfter } from "@/shared/hooks/useRateLimitCountdown";
import { useIsMobileBreakpoint } from "@/shared/hooks/useIsMobileBreakpoint";
import { mapError } from "@/shared/lib/errorMapper";
import { THIRDWEB_CLIENT_ID } from "@/shared/config/thirdweb";
import { waitForEvmReceipt } from "@/shared/utils/evmReceipt";


const ETH_ICON = "https://assets.coingecko.com/coins/images/279/small/ethereum.png";
const STETH_ICON = "https://assets.coingecko.com/coins/images/13442/small/steth_logo.png";
const ETH_NATIVE_ADDRESS = "0x0000000000000000000000000000000000000000";
const STETH_ADDRESS = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84";
const GAS_BUFFER_WEI = 300_000_000_000_000n; // 0.0003 ETH

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface StakingProps {
  onClose: () => void;
  initialAmount?: string | number;
  initialMode?: "stake" | "unstake";
  initialViewState?: string;
  variant?: "modal" | "panel";
  onOpenSwapPrefill?: (params: { fromToken: string; toToken: string; amount?: string }) => void;
}

type ViewState = "input" | "review" | "status";
type ActionMode = "stake" | "unstake";
type TxExecutionResult = { hash: string; outcome: "confirmed" | "timeout" };
type UnstakePath = "queue" | "instant";
type StakingInfoPopup = "apy" | "queue" | "instant" | "instantConfirm";
type TimeoutRecoveryMeta = { chainId: number; to?: string | null; data?: string | null };
type ApyUiState = "syncing" | "fresh" | "stale" | "unavailable";

function safeParseBigInt(value: string | null | undefined): bigint | null {
  if (!value) return null;
  if (!/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function normalizeInitialAmount(raw: unknown): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  const trimmed = String(raw).trim();
  if (!trimmed) return undefined;

  if (/^\d+$/.test(trimmed) && trimmed.length > 12) {
    try {
      return formatAmountHuman(BigInt(trimmed), 18, 6);
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

function formatWei(wei: string | null | undefined, decimals = 18, maxFrac = 6): string {
  const parsed = safeParseBigInt(wei);
  if (parsed == null) return "--";
  if (parsed === 0n) return "0.00";
  // For very small values, increase precision so they don't round to 0.
  // e.g. 17713562065 with 18 decimals = 0.000000017... needs ~11 decimals to show.
  let frac = maxFrac;
  if (parsed > 0n && parsed < 10n ** BigInt(decimals - maxFrac)) {
    // Count how many leading zeros the fractional part has
    const valueDigits = parsed.toString().length;
    const leadingZeros = decimals - valueDigits;
    // Show enough decimals: leading zeros + 2 significant digits
    frac = Math.min(leadingZeros + 2, decimals);
    frac = Math.max(frac, maxFrac);
  }
  const human = formatAmountHuman(parsed, decimals, frac);
  return human === "0" ? "0.00" : human;
}

function formatAPY(apy: number | null | undefined): string {
  if (apy == null || !Number.isFinite(apy)) return "--";
  return `${apy.toFixed(4)}%`;
}


const toBigInt = (value?: string | number | bigint | null): bigint | null => {
  if (value === null || value === undefined) return null;
  try {
    if (typeof value === "bigint") return value;
    const s = typeof value === "string" ? value : value.toString();
    if (s.startsWith("0x")) return BigInt(s);
    return BigInt(s);
  } catch {
    return null;
  }
};

export function Staking({
  onClose,
  initialAmount,
  initialMode = "stake",
  variant = "modal",
  onOpenSwapPrefill,
}: StakingProps) {
  const account = useActiveAccount();
  const stakingApi = useStakingApi();
  const {
    tokens,
    userPosition,
    loading: loadingCore,
    error: coreError,
    refresh,
    clearCacheAndRefresh,
  } = useStakingData();

  const normalizedInitialAmount = normalizeInitialAmount(initialAmount);
  const [viewState, setViewState] = useState<ViewState>("input");
  const [isStaking, setIsStaking] = useState(false);
  const [mode, setMode] = useState<ActionMode>(initialMode);
  const [unstakePath, setUnstakePath] = useState<UnstakePath>("queue");
  const [infoPopup, setInfoPopup] = useState<StakingInfoPopup | null>(null);
  const [stakeAmount, setStakeAmount] = useState(() =>
    initialMode === "stake" && normalizedInitialAmount ? normalizedInitialAmount : "0.01",
  );
  const [unstakeAmount, setUnstakeAmount] = useState(() =>
    initialMode === "unstake" && normalizedInitialAmount ? normalizedInitialAmount : "",
  );
  const [stakingError, setStakingError] = useState<string | null>(null);
  const [txWarning, setTxWarning] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txHashes, setTxHashes] = useState<string[]>([]);
  const [txSummary, setTxSummary] = useState<string | null>(null);
  const [txStage, setTxStage] = useState<StakingTxStage>("idle");
  const [txStep, setTxStep] = useState<{ current: number; total: number; label: string } | null>(null);

  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(false);
  const [extrasError, setExtrasError] = useState<string | null>(null);
  const [ethBalanceHuman, setEthBalanceHuman] = useState<string | null>(null);
  const [loadingEthBalance, setLoadingEthBalance] = useState(false);
  const [ethBalanceWei, setEthBalanceWei] = useState<bigint | null>(null);

  const rateLimit = useRateLimitCountdown();

  const isMountedRef = useRef(true);
  const timeoutSyncHashRef = useRef<string | null>(null);
  const timeoutRecoveryMetaRef = useRef<TimeoutRecoveryMeta | null>(null);
  const txActionInFlightRef = useRef(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeSet = useCallback((fn: () => void) => {
    if (!isMountedRef.current) return;
    fn();
  }, []);

  const resetTxUi = useCallback(() => {
    safeSet(() => {
      setStakingError(null);
      setTxWarning(null);
      setTxHash(null);
      setTxHashes([]);
      setTxSummary(null);
      setTxStage("idle");
      setTxStep(null);
      timeoutRecoveryMetaRef.current = null;
    });
  }, [safeSet]);

  const stEthBalanceWei = userPosition?.stETHBalance ?? null;
  const stEthBalanceHuman = useMemo(() => {
    const parsed = safeParseBigInt(stEthBalanceWei);
    if (parsed == null) return null;
    return formatAmountHuman(parsed, 18, 6);
  }, [stEthBalanceWei]);

  const STAKE_SYMBOL = "ETH";

  const primaryStakingToken = useMemo(
    () => tokens.find((t) => t.symbol === "ETH") || tokens.find((t) => t.symbol === "stETH") || null,
    [tokens],
  );

  const protocolAPY = useMemo(() => {
    const fromTokens = primaryStakingToken?.stakingAPY;
    const fromPosition = userPosition?.apy ?? null;
    return fromTokens ?? fromPosition ?? null;
  }, [primaryStakingToken, userPosition?.apy]);

  const apyUiState: ApyUiState = useMemo(() => {
    if (loadingCore) return "syncing";
    if (protocolAPY == null) return "unavailable";
    if (primaryStakingToken?.apyStale) return "stale";
    return "fresh";
  }, [loadingCore, primaryStakingToken?.apyStale, protocolAPY]);

  const apyUpdatedAt = primaryStakingToken?.apyUpdatedAt ?? null;
  const apySource = primaryStakingToken?.apySource ?? null;

  const isValidAmountInput = useCallback((value: string) => {
    if (value === "") return true;
    if (!/^\d*\.?\d*$/.test(value)) return false;
    if (value === ".") return true;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0;
  }, []);

  const resolveJwtAddress = useCallback(() => {
    try {
      if (typeof window === "undefined") return null;
      const token = localStorage.getItem("authToken");
      if (!token) return null;
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      return payload.sub || payload.address || null;
    } catch {
      return null;
    }
  }, []);

  const jwtAddress = useMemo(() => resolveJwtAddress(), [resolveJwtAddress]);
  const effectiveAddress = useMemo(() => account?.address || jwtAddress || null, [account?.address, jwtAddress]);
  const addressMismatch = useMemo(
    () => !!(jwtAddress && account?.address && jwtAddress.toLowerCase() !== account.address.toLowerCase()),
    [account?.address, jwtAddress],
  );

  useEffect(() => {
    setStakingError(null);
    setTxWarning(null);
    if (mode === "stake") {
      setUnstakePath("queue");
    }
  }, [mode, stakeAmount, unstakeAmount]);

  const stakeReceiveAmount = useMemo(() => {
    if (!isValidAmountInput(stakeAmount)) return "0";
    if (stakeAmount === "" || stakeAmount === ".") return "0";
    return stakeAmount;
  }, [isValidAmountInput, stakeAmount]);

  const unstakeReceiveAmount = useMemo(() => {
    if (!isValidAmountInput(unstakeAmount)) return "0";
    if (unstakeAmount === "" || unstakeAmount === ".") return "0";
    return unstakeAmount;
  }, [isValidAmountInput, unstakeAmount]);

  const maxStakeAmountHuman = useMemo(() => {
    if (!ethBalanceWei) return null;
    const max = ethBalanceWei > GAS_BUFFER_WEI ? ethBalanceWei - GAS_BUFFER_WEI : 0n;
    return formatAmountHuman(max, 18, 6);
  }, [ethBalanceWei]);

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
        if (!cancelled) {
          setEthBalanceHuman(null);
          setEthBalanceWei(null);
        }
      } finally {
        if (!cancelled) setLoadingEthBalance(false);
      }
    };

    void fetchEthBalance();

    return () => {
      cancelled = true;
    };
  }, [effectiveAddress]);

  const pendingWithdrawalsCount = useMemo(() => withdrawals.filter((w) => !w.isClaimed).length, [withdrawals]);

  const loadExtras = useCallback(async () => {
    setLoadingExtras(true);
    setExtrasError(null);
    try {
      const withdrawalsData = await stakingApi.getWithdrawals();
      setWithdrawals(withdrawalsData);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load staking details";
      setExtrasError(message);
    } finally {
      setLoadingExtras(false);
    }
  }, [stakingApi]);

  useEffect(() => {
    void loadExtras();
  }, [loadExtras]);

  const refreshAll = useCallback(async () => {
    await refresh();
    await loadExtras();
  }, [loadExtras, refresh]);

  const refreshAllWithFreshApy = useCallback(async () => {
    await clearCacheAndRefresh();
    await loadExtras();
  }, [clearCacheAndRefresh, loadExtras]);

  const syncPostTransactionState = useCallback(async () => {
    const ATTEMPTS = 6;
    const isTestEnv = process.env.NODE_ENV === "test";
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      await refreshAll();
      if (!isTestEnv && attempt < ATTEMPTS - 1) {
        await sleep(900 + attempt * 400);
      }
    }
  }, [refreshAll]);

  const confirmAfterConsistencyCheck = useCallback(async () => {
    safeSet(() => {
      setTxStage("pending");
      setTxStep((prev) => (prev ? { ...prev, label: "Syncing on-chain state" } : prev));
    });
    await syncPostTransactionState();
    safeSet(() => {
      setTxWarning(null);
      setStakingError(null);
      setTxStage("confirmed");
    });
  }, [safeSet, syncPostTransactionState]);

  const submitHashSafely = useCallback(
    async (id: string, hash: string) => {
      try {
        await stakingApi.submitTransactionHash(id, hash);
        return null;
      } catch (err) {
        console.warn("[STAKING] Failed to submit tx hash to backend:", err);
        return "Transaction sent on-chain, but backend sync failed. Balances may update with a delay.";
      }
    },
    [stakingApi],
  );

  const startGatewayTracker = useCallback(
    async (params: {
      action: "stake" | "unstake" | "claim";
      fromAmount: string;
      toAmount: string;
      protocol: string;
    }): Promise<SwapTracker | null> => {
      const walletAddress = account?.address?.toLowerCase();
      if (!walletAddress) return null;

      const isStake = params.action === "stake";
      try {
        return await startSwapTracking({
          userId: walletAddress,
          walletAddress,
          chain: "ethereum",
          action: params.action,
          fromChainId: 1,
          toChainId: 1,
          fromAsset: {
            address: isStake ? ETH_NATIVE_ADDRESS : STETH_ADDRESS,
            symbol: isStake ? "ETH" : "stETH",
            decimals: 18,
          },
          toAsset: {
            address: isStake ? STETH_ADDRESS : ETH_NATIVE_ADDRESS,
            symbol: isStake ? "stETH" : "ETH",
            decimals: 18,
          },
          fromAmount: params.fromAmount,
          toAmount: params.toAmount,
          provider: params.protocol,
        });
      } catch (trackingError) {
        console.warn("[STAKING] Gateway tracking unavailable (continuing without history sync):", trackingError);
        return null;
      }
    },
    [account?.address],
  );

  useEffect(() => {
    if (viewState === "input") {
      resetTxUi();
    }
  }, [mode, resetTxUi, viewState]);

  const waitForReceipt = useCallback(
    async (
      hash: string,
      chainId: number,
      tracking?: { to?: string | null; data?: string | null },
    ) => {
      return await waitForEvmReceipt({
        clientId: THIRDWEB_CLIENT_ID,
        chainId,
        txHash: hash,
        timeoutMs: 5 * 60_000,
        pollIntervalMs: 2_500,
        shouldContinue: () => isMountedRef.current,
        tracking: {
          fromAddress: account?.address,
          to: tracking?.to,
          data: tracking?.data,
        },
      });
    },
    [account?.address],
  );

  const estimateGasCostWei = useCallback(async (gasLimitLike: string | number | bigint | null | undefined, chainId: number) => {
    const gasLimit = toBigInt(gasLimitLike);
    if (!gasLimit) return null;
    if (!THIRDWEB_CLIENT_ID) return null;
    try {
      const { createThirdwebClient, defineChain } = await import("thirdweb");
      const { getRpcClient, eth_gasPrice } = await import("thirdweb/rpc");
      const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });
      const rpc = getRpcClient({ client, chain: defineChain(chainId) });
      const gasPrice = await eth_gasPrice(rpc);
      return gasLimit * (gasPrice + gasPrice / 5n);
    } catch {
      return null;
    }
  }, []);

  const executeAndConfirm = useCallback(
    async (
      tx: PreparedTx,
      stepMeta: { current: number; total: number; label: string },
      onSubmitted?: (hash: string) => Promise<void> | void,
    ): Promise<TxExecutionResult> => {
      const rawChainId = (tx as any)?.chainId;
      const parsedChainId = Number(rawChainId);
      const chainId = Number.isFinite(parsedChainId) && parsedChainId > 0 ? parsedChainId : 1;
      timeoutRecoveryMetaRef.current = {
        chainId,
        to: (tx as any)?.to ?? null,
        data: (tx as any)?.data ?? null,
      };

      safeSet(() => {
        setTxStep(stepMeta);
        setTxStage("awaiting_wallet");
      });

      const executionResult =
        typeof (stakingApi as any).executeTransactionWithStatus === "function"
          ? await (stakingApi as any).executeTransactionWithStatus(tx)
          : {
              transactionHash: await stakingApi.executeTransaction(tx),
              confirmed: false,
            };

      const hash = executionResult.transactionHash;
      const confirmedByWalletSync = executionResult.confirmed === true;

      safeSet(() => {
        setTxHash(hash);
        setTxHashes((prev) => [...prev, hash]);
        setTxStage("pending");
      });

      if (onSubmitted) {
        try {
          await onSubmitted(hash);
        } catch (e) {
          console.warn("[STAKING] onSubmitted hook failed:", e);
        }
      }

      if (confirmedByWalletSync) {
        return { hash, outcome: "confirmed" };
      }

      const receipt = await waitForReceipt(hash, chainId, {
        to: (tx as any)?.to ?? null,
        data: (tx as any)?.data ?? null,
      });

      const resolvedHash =
        typeof receipt.txHash === "string" && /^0x[a-fA-F0-9]{64}$/.test(receipt.txHash)
          ? receipt.txHash
          : hash;

      if (resolvedHash !== hash) {
        safeSet(() => {
          setTxHash(resolvedHash);
          setTxHashes((prev) => prev.map((h) => (h === hash ? resolvedHash : h)));
        });
      }

      if (receipt.outcome === "reverted") {
        safeSet(() => setTxStage("failed"));
        throw new Error("Transaction reverted on-chain.");
      }

      if (receipt.outcome === "timeout") {
        safeSet(() => {
          setTxStage("timeout");
          setTxWarning((prev) => prev ?? "Transaction submitted in wallet, but on-chain confirmation is still pending.");
        });
        return { hash: resolvedHash, outcome: "timeout" };
      }

      if (receipt.outcome === "cancelled") {
        return { hash: resolvedHash, outcome: "timeout" };
      }

      return { hash: resolvedHash, outcome: "confirmed" };
    },
    [safeSet, stakingApi, waitForReceipt],
  );

  useEffect(() => {
    if (txStage !== "timeout") {
      timeoutSyncHashRef.current = null;
      return;
    }

    let cancelled = false;

    const syncTimeoutState = async () => {
      try {
        let latestHash = txHashes[txHashes.length - 1] || txHash;

        if (!latestHash) {
          const recoveryMeta = timeoutRecoveryMetaRef.current;
          if (!recoveryMeta) return;

          const recoveredHash = await stakingApi.recoverTransactionHashByPayload({
            chainId: recoveryMeta.chainId,
            to: recoveryMeta.to,
            data: recoveryMeta.data,
            timeoutMs: 25_000,
            lookbackBlocks: 96,
          });

          if (!recoveredHash || cancelled || !isMountedRef.current) return;

          latestHash = recoveredHash;
          safeSet(() => {
            setTxHash(recoveredHash);
            setTxHashes((prev) => (prev.includes(recoveredHash) ? prev : [...prev, recoveredHash]));
            setTxWarning((prev) => prev ?? "Recovered transaction hash from wallet. Waiting for on-chain confirmation.");
          });
        }

        if (timeoutSyncHashRef.current === latestHash) return;
        timeoutSyncHashRef.current = latestHash;

        const receipt = await waitForEvmReceipt({
          clientId: THIRDWEB_CLIENT_ID,
          chainId: timeoutRecoveryMetaRef.current?.chainId ?? 1,
          txHash: latestHash,
          timeoutMs: 45 * 60_000,
          pollIntervalMs: 4_000,
          shouldContinue: () => isMountedRef.current && !cancelled && txStage === "timeout",
          tracking: {
            fromAddress: account?.address,
          },
        });

        if (cancelled || !isMountedRef.current) return;

        const resolvedHash =
          typeof receipt.txHash === "string" && /^0x[a-fA-F0-9]{64}$/.test(receipt.txHash)
            ? receipt.txHash
            : latestHash;

        if (resolvedHash !== latestHash) {
          safeSet(() => {
            setTxHashes((prev) => prev.map((hash) => (hash === latestHash ? resolvedHash : hash)));
            setTxHash((prev) => (prev === latestHash ? resolvedHash : prev));
          });
        }

        if (receipt.outcome === "confirmed") {
          const hasQueuedStep = !!txStep && txStep.current < txStep.total;
          if (hasQueuedStep) {
            safeSet(() => {
              setTxWarning("Step confirmed on-chain. Click Try again to continue with the remaining step.");
            });
            return;
          }

          safeSet(() => {
            setTxWarning(null);
            setStakingError(null);
            setTxStage("pending");
          });
          await confirmAfterConsistencyCheck();
          return;
        }

        if (receipt.outcome === "reverted") {
          safeSet(() => {
            setTxStage("failed");
            setStakingError("Transaction reverted on-chain after submission.");
          });
        }
      } catch (error) {
        console.warn("[STAKING] Timeout sync watcher failed:", error);
      }
    };

    void syncTimeoutState();

    return () => {
      cancelled = true;
    };
  }, [account?.address, confirmAfterConsistencyCheck, safeSet, stakingApi, txHash, txHashes, txStage, txStep]);

  const handleStake = async () => {
    if (txActionInFlightRef.current) return;
    txActionInFlightRef.current = true;
    setIsStaking(true);
    resetTxUi();

    let submittedAny = false;
    let tracker: SwapTracker | null = null;

    try {
      if (addressMismatch) {
        throw new Error(
          `Connected wallet does not match session address (${jwtAddress}). Please connect the correct wallet.`,
        );
      }

      if (!stakeAmount || Number(stakeAmount) <= 0) {
        throw new Error("Enter a valid stake amount.");
      }

      tracker = await startGatewayTracker({
        action: "stake",
        fromAmount: stakeAmount,
        toAmount: stakeReceiveAmount || stakeAmount,
        protocol: "lido",
      });

      const stakeTx = await stakingApi.stake(stakeAmount);
      if (!stakeTx || !stakeTx.transactionData) {
        throw new Error("No transaction data received from staking service");
      }

      const stakeWei = parseAmountToWei(stakeAmount, 18);
      const gasEstimate = await estimateGasCostWei((stakeTx.transactionData as any)?.gasLimit, 1);
      const totalCost = stakeWei + (gasEstimate ?? GAS_BUFFER_WEI);

      if (ethBalanceWei && totalCost > ethBalanceWei) {
        throw new Error("Insufficient ETH for amount + gas. Reduce amount or add ETH.");
      }

      setTxSummary(`Stake ${stakeAmount} ETH (Lido)`);
      setTxStage("awaiting_wallet");
      setViewState("status");

      const result = await executeAndConfirm(
        stakeTx.transactionData as PreparedTx,
        { current: 1, total: 1, label: "Stake" },
        async (h) => {
          submittedAny = true;
          const warn = await submitHashSafely(stakeTx.id, h);
          if (warn) safeSet(() => setTxWarning(warn));
          if (tracker) {
            try {
              await tracker.addTxHash(h, 1, "stake");
              await tracker.markSubmitted();
              await tracker.markPending();
            } catch (trackingError) {
              console.warn("[STAKING] Failed to update gateway tx hash:", trackingError);
            }
          }
        },
      );

      if (result.outcome !== "confirmed") {
        throw new Error("Transaction submitted but not confirmed yet.");
      }

      console.log("[STAKING] Transaction submitted! Hash:", result.hash);
      await confirmAfterConsistencyCheck();

      if (tracker) {
        try {
          await tracker.markConfirmed(stakeReceiveAmount || stakeAmount);
        } catch (trackingError) {
          console.warn("[STAKING] Failed to mark gateway transaction as confirmed:", trackingError);
        }
      }
    } catch (error) {
      console.error("[STAKING] Error:", error);
      const rawMessage =
        error instanceof Error ? error.message || "Staking failed. Please try again." : "Staking failed. Please try again.";
      const is429 = /429|rate.?limit/i.test(rawMessage);
      if (is429) {
        rateLimit.trigger(parseRetryAfter(error));
      }
      const message = mapError(error, rawMessage);
      const isPendingLike = /submitted but not confirmed|pending|timed out/i.test(rawMessage);
      if (isPendingLike) {
        safeSet(() => setTxStage("timeout"));
      } else {
        safeSet(() => setTxStage("failed"));
      }
      setStakingError(message);
      if (tracker) {
        try {
          if (isPendingLike && submittedAny) {
            await tracker.markPending();
          } else {
            await tracker.markFailed("STAKING_TX_FAILED", message);
          }
        } catch (trackingError) {
          console.warn("[STAKING] Failed to mark gateway transaction failure:", trackingError);
        }
      }
      if (!submittedAny) {
        setViewState("review");
      }
    } finally {
      setIsStaking(false);
      txActionInFlightRef.current = false;
    }
  };

  const handleUnstake = useCallback(async () => {
    if (txActionInFlightRef.current) return;
    txActionInFlightRef.current = true;
    setIsStaking(true);
    resetTxUi();

    let submittedAny = false;
    let tracker: SwapTracker | null = null;

    try {
      if (addressMismatch) {
        throw new Error(
          `Connected wallet does not match session address (${jwtAddress}). Please connect the correct wallet.`,
        );
      }
      if (!unstakeAmount || Number(unstakeAmount) <= 0) {
        throw new Error("Enter a valid unstake amount.");
      }

      if (stEthBalanceWei) {
        const stEthWei = safeParseBigInt(stEthBalanceWei) ?? 0n;
        const unstakeWei = parseAmountToWei(unstakeAmount, 18);
        if (unstakeWei > stEthWei) {
          throw new Error(`Insufficient stETH balance. Available: ${stEthBalanceHuman}`);
        }
      }

      tracker = await startGatewayTracker({
        action: "unstake",
        fromAmount: unstakeAmount,
        toAmount: unstakeReceiveAmount || unstakeAmount,
        protocol: "lido",
      });

      const attemptUnstakeRequest = async (): Promise<StakingTransaction> => {
        const tx = await stakingApi.unstake(unstakeAmount);
        if (!tx?.transactionData) {
          throw new Error("No transaction data received from staking service");
        }
        return tx;
      };

      setTxSummary("Request withdrawal (queue)");
      setTxStage("awaiting_wallet");
      setViewState("status");

      const firstTx = await attemptUnstakeRequest();
      const gasEstimateFirst = await estimateGasCostWei((firstTx.transactionData as any)?.gasLimit, 1);
      if (ethBalanceWei && ethBalanceWei < (gasEstimateFirst ?? GAS_BUFFER_WEI)) {
        const gasHuman = formatAmountHuman(gasEstimateFirst ?? GAS_BUFFER_WEI, 18, 6);
        throw new Error(`Insufficient ETH for gas (approx ${gasHuman} ETH). Available: ${ethBalanceHuman ?? "--"} ETH.`);
      }

      const firstResult = await executeAndConfirm(
        firstTx.transactionData as PreparedTx,
        { current: 1, total: firstTx.requiresFollowUp ? 2 : 1, label: firstTx.type === "unstake_approval" ? "Approval" : "Request" },
        async (h) => {
          submittedAny = true;
          const warn = await submitHashSafely(firstTx.id, h);
          if (warn) safeSet(() => setTxWarning(warn));
          if (tracker) {
            try {
              await tracker.addTxHash(h, 1, firstTx.type === "unstake_approval" ? "approval" : "unstake");
              await tracker.markSubmitted();
              await tracker.markPending();
            } catch (trackingError) {
              console.warn("[UNSTAKE] Failed to update gateway tx hash:", trackingError);
            }
          }
        },
      );

      if (firstTx.requiresFollowUp && firstResult.outcome === "timeout") {
        throw new Error(
          "Approval submitted but not confirmed yet. Wait a moment and press Try again to continue the withdrawal request.",
        );
      }

      if (firstTx.requiresFollowUp && firstTx.followUpAction === "unstake") {
        safeSet(() => {
          setTxStage("pending");
          setTxStep({ current: 2, total: 2, label: "Prepare request" });
          setTxSummary("Approval confirmed. Preparing withdrawal request...");
        });

        const MAX_ATTEMPTS = 4;
        let secondTx: StakingTransaction | null = null;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          const candidate = await attemptUnstakeRequest();
          if (candidate.type === "unstake") {
            secondTx = candidate;
            break;
          }
          if (attempt < MAX_ATTEMPTS) {
            safeSet(() => {
              setTxStep({ current: 2, total: 2, label: `Prepare request (${attempt + 1}/${MAX_ATTEMPTS})` });
              setTxSummary("Approval confirmed. Waiting for withdrawal request to become available...");
            });
            await sleep(1600 * attempt);
          }
        }

        if (!secondTx) {
          throw new Error(
            "Approval confirmed in wallet, but the withdrawal request is not ready yet. Click \"Try again\" to continue.",
          );
        }

        const gasEstimateSecond = await estimateGasCostWei((secondTx.transactionData as any)?.gasLimit, 1);
        if (ethBalanceWei && ethBalanceWei < (gasEstimateSecond ?? GAS_BUFFER_WEI)) {
          const gasHuman = formatAmountHuman(gasEstimateSecond ?? GAS_BUFFER_WEI, 18, 6);
          throw new Error(`Insufficient ETH for gas (approx ${gasHuman} ETH). Available: ${ethBalanceHuman ?? "--"} ETH.`);
        }

        const secondResult = await executeAndConfirm(
          secondTx.transactionData as PreparedTx,
          { current: 2, total: 2, label: "Request" },
          async (h) => {
            submittedAny = true;
            const warn = await submitHashSafely(secondTx.id, h);
            if (warn) safeSet(() => setTxWarning(warn));
            if (tracker) {
              try {
                await tracker.addTxHash(h, 1, "unstake");
              } catch (trackingError) {
                console.warn("[UNSTAKE] Failed to update gateway tx hash:", trackingError);
              }
            }
          },
        );

        if (secondResult.outcome !== "confirmed") {
          throw new Error("Transaction submitted but not confirmed yet.");
        }

        await confirmAfterConsistencyCheck();

        if (tracker) {
          try {
            await tracker.markConfirmed(unstakeReceiveAmount || unstakeAmount);
          } catch (trackingError) {
            console.warn("[UNSTAKE] Failed to mark gateway transaction as confirmed:", trackingError);
          }
        }

        return;
      }

      if (firstResult.outcome !== "confirmed") {
        throw new Error("Transaction submitted but not confirmed yet.");
      }

      await confirmAfterConsistencyCheck();

      setTxHash(firstResult.hash);
      if (tracker) {
        try {
          await tracker.markConfirmed(unstakeReceiveAmount || unstakeAmount);
        } catch (trackingError) {
          console.warn("[UNSTAKE] Failed to mark gateway transaction as confirmed:", trackingError);
        }
      }
    } catch (error) {
      console.error("[UNSTAKE] Error:", error);
      const rawMessage =
        error instanceof Error ? error.message || "Unstake failed. Please try again." : "Unstake failed. Please try again.";
      const is429 = /429|rate.?limit/i.test(rawMessage);
      if (is429) {
        rateLimit.trigger(parseRetryAfter(error));
      }
      const message = mapError(error, rawMessage);
      const softPendingState =
        /submitted but not confirmed|pending|timed out/i.test(rawMessage) ||
        /withdrawal request is not ready yet/i.test(rawMessage) ||
        /approval confirmed in wallet/i.test(rawMessage);

      if (softPendingState) {
        safeSet(() => {
          setTxStage("timeout");
          setTxWarning(message);
        });
      } else {
        safeSet(() => setTxStage("failed"));
      }

      if (!softPendingState) {
        if (/rejected in wallet|user rejected|user denied/i.test(rawMessage)) {
          setStakingError("Transaction rejected in wallet. Check details and try again.");
        } else {
          setStakingError(message);
        }
      }

      if (tracker) {
        try {
          if (softPendingState && submittedAny) {
            await tracker.markPending();
          } else {
            await tracker.markFailed("UNSTAKE_TX_FAILED", message);
          }
        } catch (trackingError) {
          console.warn("[UNSTAKE] Failed to mark gateway transaction failure:", trackingError);
        }
      }

      if (!submittedAny) {
        setViewState("review");
      }
    } finally {
      setIsStaking(false);
      txActionInFlightRef.current = false;
    }
  }, [
    addressMismatch,
    confirmAfterConsistencyCheck,
    ethBalanceHuman,
    ethBalanceWei,
    estimateGasCostWei,
    executeAndConfirm,
    jwtAddress,
    rateLimit,
    resetTxUi,
    safeSet,
    stEthBalanceHuman,
    stEthBalanceWei,
    stakingApi,
    startGatewayTracker,
    submitHashSafely,
    unstakeAmount,
    unstakeReceiveAmount,
  ]);

  const claimableRequestIds = useMemo(
    () => withdrawals.filter((w) => w.isFinalized && !w.isClaimed).map((w) => String(w.requestId)),
    [withdrawals],
  );

  const handleClaimAll = useCallback(async () => {
    if (!claimableRequestIds.length) return;
    if (txActionInFlightRef.current) return;
    txActionInFlightRef.current = true;
    setIsStaking(true);
    resetTxUi();

    let submittedAny = false;
    let tracker: SwapTracker | null = null;

    try {
      if (addressMismatch) {
        throw new Error(
          `Connected wallet does not match session address (${jwtAddress}). Please connect the correct wallet.`,
        );
      }

      const claimableAmountWei = withdrawals
        .filter((w) => w.isFinalized && !w.isClaimed)
        .reduce((acc, w) => acc + (safeParseBigInt(w.amountOfStETHWei) ?? 0n), 0n);
      const claimableAmountHuman = formatAmountHuman(claimableAmountWei, 18, 6);

      tracker = await startGatewayTracker({
        action: "claim",
        fromAmount: claimableAmountHuman || "0",
        toAmount: claimableAmountHuman || "0",
        protocol: "lido",
      });

      const tx = await stakingApi.claimWithdrawals(claimableRequestIds);
      if (!tx?.transactionData) throw new Error("No claim transaction data received");

      const gasEstimate = await estimateGasCostWei((tx.transactionData as any)?.gasLimit, 1);
      if (ethBalanceWei && ethBalanceWei < (gasEstimate ?? GAS_BUFFER_WEI)) {
        const gasHuman = formatAmountHuman(gasEstimate ?? GAS_BUFFER_WEI, 18, 6);
        throw new Error(`Insufficient ETH for gas (approx ${gasHuman} ETH). Available: ${ethBalanceHuman ?? "--"} ETH.`);
      }

      setTxSummary(`Claim withdrawals (${claimableRequestIds.length})`);
      setTxStage("awaiting_wallet");
      setViewState("status");

      const claimResult = await executeAndConfirm(
        tx.transactionData as PreparedTx,
        { current: 1, total: 1, label: "Claim" },
        async (h) => {
          submittedAny = true;
          const warn = await submitHashSafely(tx.id, h);
          if (warn) safeSet(() => setTxWarning(warn));
          if (tracker) {
            try {
              await tracker.addTxHash(h, 1, "claim");
              await tracker.markSubmitted();
              await tracker.markPending();
            } catch (trackingError) {
              console.warn("[CLAIM] Failed to update gateway tx hash:", trackingError);
            }
          }
        },
      );

      if (claimResult.outcome !== "confirmed") {
        throw new Error("Transaction submitted but not confirmed yet.");
      }

      await confirmAfterConsistencyCheck();

      if (tracker) {
        try {
          await tracker.markConfirmed(claimableAmountHuman || undefined);
        } catch (trackingError) {
          console.warn("[CLAIM] Failed to mark gateway transaction as confirmed:", trackingError);
        }
      }

    } catch (e) {
      const message = e instanceof Error ? e.message || "Claim failed." : "Claim failed.";
      const isPendingLike = /submitted but not confirmed|pending|timed out/i.test(message);
      if (isPendingLike) {
        safeSet(() => setTxStage("timeout"));
      } else {
        safeSet(() => setTxStage("failed"));
      }
      setStakingError(message);
      if (tracker) {
        try {
          if (isPendingLike && submittedAny) {
            await tracker.markPending();
          } else {
            await tracker.markFailed("CLAIM_TX_FAILED", message);
          }
        } catch (trackingError) {
          console.warn("[CLAIM] Failed to mark gateway transaction failure:", trackingError);
        }
      }
      if (!submittedAny) {
        setViewState("input");
      }
    } finally {
      setIsStaking(false);
      txActionInFlightRef.current = false;
    }
  }, [
    addressMismatch,
    claimableRequestIds,
    confirmAfterConsistencyCheck,
    ethBalanceHuman,
    ethBalanceWei,
    estimateGasCostWei,
    executeAndConfirm,
    jwtAddress,
    resetTxUi,
    safeSet,
    stakingApi,
    startGatewayTracker,
    submitHashSafely,
    withdrawals,
  ]);

  const handleOpenInstantSwap = useCallback(() => {
    if (!onOpenSwapPrefill) return;
    const amount = unstakeAmount.trim();
    if (!amount || Number(amount) <= 0) {
      setStakingError("Enter a valid amount before opening Swap.");
      return;
    }

    onOpenSwapPrefill({
      fromToken: STETH_ADDRESS,
      toToken: ETH_NATIVE_ADDRESS,
      amount,
    });
    onClose();
  }, [onClose, onOpenSwapPrefill, unstakeAmount]);

  const handleContinueFromInput = useCallback(() => {
    setStakingError(null);
    setTxWarning(null);
    if (mode === "unstake" && unstakePath === "instant") {
      setInfoPopup("instantConfirm");
      return;
    }
    setViewState("review");
  }, [mode, unstakePath]);

  const isMobile = useIsMobileBreakpoint();

  const reviewTitle = mode === "stake" ? "Confirm stake (Lido)" : "Request withdrawal (queue)";

  const infoPopupCopy: Record<Exclude<StakingInfoPopup, "instantConfirm">, { title: string; body: string }> = {
    apy: {
      title: "APY and sync",
      body: "APY is fetched from protocol data. During loading, status is syncing. If data source is delayed, APY can show as updating/unavailable until the next successful refresh.",
    },
    queue: {
      title: "Queue withdrawal",
      body: "Queue has 2 phases: request now (value=0), then claim later when finalized. ETH is received only on claim.",
    },
    instant: {
      title: "Instant withdrawal",
      body: "Instant uses market swap (stETH -> ETH). You receive ETH faster, but final amount depends on market price and slippage.",
    },
  };

  const header =
    viewState === "input" ? (
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2 flex-1">
          <Droplets className="w-5 h-5 text-cyan-400" />
          <div>
            <h2 className="text-lg font-display font-bold text-white">Liquid Staking</h2>
            <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Lido · Ethereum</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-500 hover:text-white active:text-white hover:bg-white/10 active:bg-white/20 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    ) : viewState === "review" ? (
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => {
            setStakingError(null);
            setTxWarning(null);
            setViewState("input");
          }}
          className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-display font-bold text-white flex-1">{reviewTitle}</h2>
        <button
          onClick={onClose}
          className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-500 hover:text-white active:text-white hover:bg-white/10 active:bg-white/20 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    ) : null;

  return (
    <DefiWidgetModalShell
      dataTour="widget-staking"
      onClose={onClose}
      variant={variant}
      isMobile={isMobile}
      header={header}
      footer={
        <div className="py-8 flex items-center justify-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
          <img src="/miniapp/icons/lido_logo.png" alt="Lido" className="w-8 h-8 rounded-full" />
          <span className="text-sm font-medium text-zinc-400">Powered by Lido</span>
        </div>
      }
      cardClassName="md:min-h-[540px]"
      bodyClassName="custom-scrollbar"
    >

      <AnimatePresence mode="wait">
        {viewState === "input" && (
          <StakingInputView
            mode={mode}
            setMode={setMode}
            unstakePath={unstakePath}
            setUnstakePath={setUnstakePath}
            stakeAmount={stakeAmount}
            setStakeAmount={setStakeAmount}
            unstakeAmount={unstakeAmount}
            setUnstakeAmount={setUnstakeAmount}
            loadingEthBalance={loadingEthBalance}
            ethBalanceHuman={ethBalanceHuman}
            maxStakeAmountHuman={maxStakeAmountHuman}
            stEthBalanceHuman={stEthBalanceHuman}
            stakeReceiveAmount={stakeReceiveAmount}
            unstakeReceiveAmount={unstakeReceiveAmount}
            protocolAPY={protocolAPY}
            formatAPY={formatAPY}
            apyUiState={apyUiState}
            apyUpdatedAt={apyUpdatedAt}
            apySource={apySource}
            claimableRequestIds={claimableRequestIds}
            pendingWithdrawalsCount={pendingWithdrawalsCount}
            isRateLimited={rateLimit.isLimited}
            rateLimitRemaining={rateLimit.remaining}
            coreError={coreError}
            extrasError={extrasError}
            loadingCore={loadingCore}
            loadingExtras={loadingExtras}
            onRefreshAll={() => {
              void refreshAllWithFreshApy();
            }}
            formatWei={formatWei}
            stEthBalanceWei={userPosition?.stETHBalance}
            wstEthBalanceWei={userPosition?.wstETHBalance}
            onClaimAll={handleClaimAll}
            isStaking={isStaking}
            onContinue={handleContinueFromInput}
            onOpenInfo={(kind) => setInfoPopup(kind)}
            onOpenInstantSwap={handleOpenInstantSwap}
            ethIcon={ETH_ICON}
            stEthIcon={STETH_ICON}
            stakeSymbol={STAKE_SYMBOL}
          />
        )}

        {viewState === "review" && (
          <StakingReviewView
            mode={mode}
            stakeAmount={stakeAmount}
            unstakeAmount={unstakeAmount}
            stakeReceiveAmount={stakeReceiveAmount}
            unstakeReceiveAmount={unstakeReceiveAmount}
            stakeSymbol={STAKE_SYMBOL}
            ethIcon={ETH_ICON}
            stEthIcon={STETH_ICON}
            stakingError={stakingError}
            txWarning={txWarning}
            isRateLimited={rateLimit.isLimited}
            rateLimitRemaining={rateLimit.remaining}
            isStaking={isStaking}
            onConfirm={mode === "stake" ? handleStake : handleUnstake}
          />
        )}

        {viewState === "status" && (
          <StakingStatusView
            txStage={txStage}
            mode={mode}
            txStep={txStep}
            pendingWithdrawalsCount={pendingWithdrawalsCount}
            claimableRequestIds={claimableRequestIds}
            txSummary={txSummary}
            stakingError={stakingError}
            txWarning={txWarning}
            txHashes={txHashes}
            onClose={() => {
              setViewState("input");
              resetTxUi();
              onClose();
            }}
            onRetry={() => {
              setViewState("review");
              safeSet(() => {
                setStakingError(null);
                setTxWarning(null);
                setTxHash(null);
                setTxHashes([]);
                setTxStage("idle");
                setTxStep(null);
              });
            }}
            onNewAction={() => {
              setViewState("input");
              setStakeAmount("0.01");
              setUnstakeAmount("");
              setUnstakePath("queue");
              resetTxUi();
            }}
          />
        )}
      </AnimatePresence>

      {infoPopup && (
        <div className="absolute inset-0 z-40 bg-black/55 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-[360px] rounded-xl border border-white/10 bg-[#0b0d10] p-4 space-y-3">
            {infoPopup !== "instantConfirm" ? (
              <>
                <div className="text-sm font-semibold text-white">{infoPopupCopy[infoPopup].title}</div>
                <p className="text-xs text-zinc-300 leading-relaxed">{infoPopupCopy[infoPopup].body}</p>
                <button
                  type="button"
                  onClick={() => setInfoPopup(null)}
                  className="w-full py-2.5 rounded-lg bg-white text-black hover:bg-zinc-200 text-sm font-medium transition-colors"
                >
                  Got it
                </button>
              </>
            ) : (
              <>
                <div className="text-sm font-semibold text-white">Use instant swap?</div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  This opens Swap (stETH to ETH) for immediate execution. Final ETH depends on market price and slippage.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInfoPopup(null)}
                    className="py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInfoPopup(null);
                      handleOpenInstantSwap();
                    }}
                    className="py-2.5 rounded-lg bg-white text-black hover:bg-zinc-200 text-sm font-medium transition-colors"
                  >
                    Open Swap
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </DefiWidgetModalShell>
  );
}

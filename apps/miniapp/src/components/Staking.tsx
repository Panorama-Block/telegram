import { AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowLeft, Droplets, Info, RefreshCcw, X } from "lucide-react";
import { DataInput } from "@/components/ui/DataInput";
import { NeonButton } from "@/components/ui/NeonButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useActiveAccount, useSwitchActiveWalletChain } from "thirdweb/react";
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
import { useBaseStakingData } from "@/features/staking/useBaseStakingData";
import { useBaseStakingApi, type BaseTransactionBundle } from "@/features/staking/baseApi";
import type { PreparedTx } from "@/features/swap/types";
import { formatAmountHuman, parseAmountToWei } from "@/features/swap/utils";
import { useRateLimitCountdown, parseRetryAfter } from "@/shared/hooks/useRateLimitCountdown";
import { useIsMobileBreakpoint } from "@/shared/hooks/useIsMobileBreakpoint";
import { mapError } from "@/shared/lib/errorMapper";
import { THIRDWEB_CLIENT_ID } from "@/shared/config/thirdweb";
import { waitForEvmReceipt } from "@/shared/utils/evmReceipt";

const AERODROME_LOGO = "https://assets.coingecko.com/coins/images/31745/small/token.png";

const BASE_TOKEN_ICONS: Record<string, string> = {
  WETH: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
  ETH: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  USDC: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
  USDbC: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
  AERO: "https://assets.coingecko.com/coins/images/31745/small/token.png",
};

const BASE_TOKEN_DECIMALS: Record<string, number> = {
  WETH: 18, ETH: 18, AERO: 18, USDC: 6, USDbC: 6,
};

function parsePoolTokens(poolName: string): { tokenA: string; tokenB: string } {
  const match = poolName.match(/^(\w+)\/(\w+)/);
  if (match) return { tokenA: match[1], tokenB: match[2] };
  return { tokenA: "Token A", tokenB: "Token B" };
}

function formatBalance(val: string | null, maxDecimals = 6): string {
  if (!val) return "--";
  const n = parseFloat(val);
  if (!Number.isFinite(n) || n <= 0) return "0.00";
  if (n < 0.000001) return "<0.000001";
  return n.toFixed(maxDecimals).replace(/\.?0+$/, "");
}

const ETH_ICON = "https://assets.coingecko.com/coins/images/279/small/ethereum.png";
const STETH_ICON = "https://assets.coingecko.com/coins/images/13442/small/steth_logo.png";
const ETH_NATIVE_ADDRESS = "0x0000000000000000000000000000000000000000";
const STETH_ADDRESS = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84";
const GAS_BUFFER_WEI = 300_000_000_000_000n; // 0.0003 ETH

type StakingNetwork = "ethereum" | "base";

interface StakingProps {
  onClose: () => void;
  initialAmount?: string | number;
  initialMode?: "stake" | "unstake";
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

function cleanBaseError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("CALL_EXCEPTION")) return "Transaction reverted on-chain. The pool may have insufficient liquidity or the amounts are too small. Try increasing your amounts.";
  if (raw.includes("insufficient funds")) return "Insufficient funds for this transaction (including gas).";
  if (raw.includes("user rejected")) return "Transaction was rejected in your wallet.";
  if (raw.includes("not a valid numeric string")) return "Invalid amount. Please enter valid numbers.";
  if (raw.includes("HTTP 5")) return "Backend server error. Please try again.";
  if (raw.length > 120) return raw.slice(0, 120) + "...";
  return raw;
}

function formatBaseAPR(raw: string, pool?: { rewardRatePerSecond: string; totalStaked: string }): { label: string; lowTvl: boolean; newPool: boolean } {
  const num = parseFloat(raw.replace("%", ""));
  if (!Number.isFinite(num) || num <= 0) {
    // Pool has active rewards but no stakers yet
    if (pool && pool.rewardRatePerSecond !== "0" && pool.totalStaked === "0") {
      return { label: "Rewards Active", lowTvl: false, newPool: true };
    }
    return { label: "0%", lowTvl: false, newPool: false };
  }
  if (num > 10000) return { label: ">10,000%", lowTvl: true, newPool: false };
  if (num > 1000) return { label: `${(num / 1000).toFixed(1)}k%`, lowTvl: true, newPool: false };
  return { label: `${num.toFixed(2)}%`, lowTvl: false, newPool: false };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const switchChain = useSwitchActiveWalletChain();
  const stakingApi = useStakingApi();
  const {
    tokens,
    userPosition,
    loading: loadingCore,
    error: coreError,
    refresh,
    clearCacheAndRefresh,
  } = useStakingData();

  // Base / Aerodrome staking
  const {
    positions: basePositions,
    portfolioAssets: basePortfolioAssets,
    protocolInfo: baseProtocolInfo,
    apr: baseApr,
    loading: baseLoading,
    error: baseError,
    refresh: refreshBase,
  } = useBaseStakingData();
  const baseApi = useBaseStakingApi();

  const AERODROME_COMING_SOON = true; // Remove this flag when the on-chain service is deployed
  const [network, setNetwork] = useState<StakingNetwork>(AERODROME_COMING_SOON ? "ethereum" : "base");

  // Base inline staking state
  type BaseAction = "stake" | "positions";
  const [baseAction, setBaseAction] = useState<BaseAction>("stake");
  const [baseSelectedPool, setBaseSelectedPool] = useState<string>("");
  const [baseAmountA, setBaseAmountA] = useState("");
  const [baseAmountB, setBaseAmountB] = useState("");
  const [baseSlippage, setBaseSlippage] = useState("0.5");
  const [baseTxLoading, setBaseTxLoading] = useState(false);
  const [baseTxError, setBaseTxError] = useState<string | null>(null);
  const [baseTxStage, setBaseTxStage] = useState<"idle" | "preparing" | "signing" | "pending" | "confirmed" | "failed">("idle");
  const [baseTxStep, setBaseTxStep] = useState<{ current: number; total: number; label: string } | null>(null);
  const [baseTxHashes, setBaseTxHashes] = useState<string[]>([]);

  // Base wallet balances
  const [baseWalletBalances, setBaseWalletBalances] = useState<Record<string, string>>({});
  const [baseBalancesLoading, setBaseBalancesLoading] = useState(false);

  const refreshBaseBalances = useCallback(async () => {
    const addr = account?.address;
    console.log('[refreshBaseBalances] called, addr=', addr);
    if (!addr) return;
    setBaseBalancesLoading(true);
    try {
      const tokenAddrs: Record<string, string> = {
        WETH: "0x4200000000000000000000000000000000000006",
        USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      };

      let balances: Record<string, string> = {};

      // Try backend first
      try {
        const portfolio = await baseApi.getPortfolio();
        console.log('[refreshBaseBalances] portfolio result:', portfolio);
        if (portfolio?.walletBalances) {
          balances = { ...portfolio.walletBalances };
        }
      } catch (e) { console.error('[refreshBaseBalances] backend failed:', e); }

      // For any token still missing or "0", verify via thirdweb on-chain query (with timeout)
      const zeroTokens = Object.keys(tokenAddrs).filter(s => !balances[s] || parseFloat(balances[s]) === 0);
      if (zeroTokens.length > 0) {
        try {
          const { createThirdwebClient, defineChain, getContract: getTwContract } = await import("thirdweb");
          const { balanceOf } = await import("thirdweb/extensions/erc20");
          const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });
          const baseChain = defineChain(8453);

          const timeout = (ms: number) => new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms));
          await Promise.all(
            zeroTokens.map(async (symbol) => {
              try {
                const contract = getTwContract({ client, chain: baseChain, address: tokenAddrs[symbol] as `0x${string}` });
                const bal = await Promise.race([
                  balanceOf({ contract, address: addr as `0x${string}` }),
                  timeout(8000),
                ]);
                const dec = BASE_TOKEN_DECIMALS[symbol] ?? 18;
                if (bal > 0n) {
                  balances[symbol] = formatAmountHuman(bal, dec, 8);
                }
              } catch { /* keep existing value */ }
            })
          );
        } catch { /* thirdweb import failed */ }
      }

      // Always set whatever data we got — stale data is better than no data
      console.log('[refreshBaseBalances] final balances:', balances);
      if (Object.keys(balances).length > 0) {
        setBaseWalletBalances(balances);
      }
    } catch {
      // Don't reset existing balances on error
    } finally {
      setBaseBalancesLoading(false);
    }
  }, [account?.address, baseApi]);

  useEffect(() => {
    refreshBaseBalances();
  }, [refreshBaseBalances]);

  // Auto-select first pool & set default amounts
  useEffect(() => {
    if (!baseSelectedPool && baseProtocolInfo?.pools?.length) {
      setBaseSelectedPool(baseProtocolInfo.pools[0].poolId);
    }
  }, [baseSelectedPool, baseProtocolInfo]);

  const selectedBasePool = useMemo(
    () => baseProtocolInfo?.pools?.find((p) => p.poolId === baseSelectedPool) ?? null,
    [baseProtocolInfo, baseSelectedPool],
  );

  // Resolve token balances for the selected pool
  const baseTokenBalances = useMemo(() => {
    if (!selectedBasePool) return { balA: null, balB: null };
    const tokens = parsePoolTokens(selectedBasePool.poolName);
    const balA = baseWalletBalances[tokens.tokenA] ?? null;
    const balB = baseWalletBalances[tokens.tokenB] ?? null;
    return { balA, balB };
  }, [selectedBasePool, baseWalletBalances]);

  // Set sensible default amounts ONLY when pool selection changes (not on balance updates)
  useEffect(() => {
    if (!selectedBasePool) return;
    setBaseAmountA("");
    setBaseAmountB("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseSelectedPool]);

  const basePositionForPool = useMemo(
    () => basePositions.find((p) => p.poolId === baseSelectedPool) ?? null,
    [basePositions, baseSelectedPool],
  );

  const resetBaseTx = useCallback(() => {
    setBaseTxError(null);
    setBaseTxStage("idle");
    setBaseTxStep(null);
    setBaseTxHashes([]);
  }, []);

  const executeBaseTxBundle = useCallback(async (bundle: BaseTransactionBundle) => {
    if (!account) throw new Error("Wallet not connected");

    const { sendAndConfirmTransaction, createThirdwebClient, defineChain, prepareTransaction, getContract: getTwContract } = await import("thirdweb");
    const { balanceOf } = await import("thirdweb/extensions/erc20");
    const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });
    const baseChain = defineChain(8453);

    // Ensure wallet is on Base before executing
    await switchChain(baseChain);

    const hashes: string[] = [];

    for (let i = 0; i < bundle.steps.length; i++) {
      let step = bundle.steps[i];
      setBaseTxStep({ current: i + 1, total: bundle.totalSteps, label: step.description || `Step ${i + 1}` });
      setBaseTxStage("signing");

      // For "enter" bundles: before the stake step (last), wait for RPC to catch up
      // then query actual LP balance and re-encode to avoid TransferFromFailed errors.
      if (bundle.action === "enter" && i === bundle.steps.length - 1 && i >= 1) {
        // Wait for the previous tx (addLiquidity) to be indexed by the RPC
        await new Promise(r => setTimeout(r, 2000));
        try {
          const { ethers } = await import("ethers");
          const executorIface = new ethers.Interface([
            "function executeStake(bytes32 protocolId, address lpToken, uint256 amount, bytes calldata extraData) external",
          ]);
          const decoded = executorIface.decodeFunctionData("executeStake", step.data);
          const lpAddress = decoded[1] as string;
          const lpContract = getTwContract({ client, chain: baseChain, address: lpAddress as `0x${string}` });
          const lpBalance = await balanceOf({ contract: lpContract, address: account.address as `0x${string}` });
          console.log("[STAKE] LP balance before stake:", lpBalance.toString(), "pre-prepared amount:", decoded[2].toString());
          if (lpBalance > 0n) {
            const newData = executorIface.encodeFunctionData("executeStake", [
              decoded[0], decoded[1], lpBalance, decoded[3],
            ]);
            step = { ...step, data: newData, description: `Stake ${lpBalance.toString()} LP tokens in gauge` };
          } else {
            console.warn("[STAKE] LP balance is 0 — skipping re-encode, using pre-prepared amount");
          }
        } catch (reencodeErr) {
          console.error("[STAKE] Re-encode failed:", reencodeErr);
        }
      }

      console.log(`[TX] Step ${i + 1}/${bundle.steps.length}: ${step.description} → to=${step.to}, value=${step.value}`);

      const tx = prepareTransaction({
        client,
        chain: baseChain,
        to: step.to as `0x${string}`,
        data: step.data as `0x${string}`,
        value: BigInt(step.value || "0"),
        gas: step.gasLimit ? BigInt(step.gasLimit) : undefined,
      });

      try {
        const receipt = await sendAndConfirmTransaction({ transaction: tx, account });
        hashes.push(receipt.transactionHash);
        setBaseTxHashes([...hashes]);
        setBaseTxStage("pending");

        if (receipt.status === "reverted") {
          throw new Error(`Step ${i + 1} ("${step.description}") reverted on-chain`);
        }
      } catch (txErr: unknown) {
        const msg = txErr instanceof Error ? txErr.message : String(txErr);
        throw new Error(`Step ${i + 1}/${bundle.steps.length} ("${step.description}") failed: ${msg}`);
      }
    }

    return hashes;
  }, [account, switchChain]);

  const handleBaseStake = useCallback(async () => {
    if (baseTxLoading) return;
    setBaseTxLoading(true);
    resetBaseTx();

    try {
      if (!account) throw new Error("Connect your wallet first");
      if (!baseSelectedPool) throw new Error("Select a pool");
      if (!baseAmountA && !baseAmountB) throw new Error("Enter at least one token amount");

      // Validate balances before sending
      const poolInfo = selectedBasePool;
      const tokens = poolInfo ? parsePoolTokens(poolInfo.poolName) : { tokenA: "WETH", tokenB: "USDC" };
      const balA = parseFloat(baseWalletBalances[tokens.tokenA] ?? "0");
      const balB = parseFloat(baseWalletBalances[tokens.tokenB] ?? "0");
      // Use 0.1% tolerance to avoid false positives from floating point rounding
      if (baseAmountA && parseFloat(baseAmountA) > balA * 1.001) throw new Error(`Insufficient ${tokens.tokenA} balance. You have ${balA.toFixed(6)} but need ${baseAmountA}`);
      if (baseAmountB && parseFloat(baseAmountB) > balB * 1.001) throw new Error(`Insufficient ${tokens.tokenB} balance. You have ${balB.toFixed(6)} but need ${baseAmountB}`);

      setBaseTxStage("preparing");
      const decA = BASE_TOKEN_DECIMALS[tokens.tokenA] ?? 18;
      const decB = BASE_TOKEN_DECIMALS[tokens.tokenB] ?? 18;
      const weiA = baseAmountA ? parseAmountToWei(baseAmountA, decA).toString() : "0";
      const weiB = baseAmountB ? parseAmountToWei(baseAmountB, decB).toString() : "0";
      const bundle = await baseApi.prepareEnter({
        poolId: baseSelectedPool,
        amountA: weiA,
        amountB: weiB,
        slippageBps: Math.round(parseFloat(baseSlippage) * 100),
      });

      const hashes = await executeBaseTxBundle(bundle);
      setBaseTxStage("confirmed");
      setBaseTxHashes(hashes);

      // Refresh data and balances
      setTimeout(() => { void refreshBase(); refreshBaseBalances(); }, 2000);
    } catch (err) {
      setBaseTxError(cleanBaseError(err));
      setBaseTxStage("failed");
    } finally {
      setBaseTxLoading(false);
    }
  }, [account, baseAmountA, baseAmountB, baseApi, baseSelectedPool, selectedBasePool, baseSlippage, baseWalletBalances, baseTxLoading, executeBaseTxBundle, refreshBase, refreshBaseBalances, resetBaseTx]);

  const handleBaseUnstake = useCallback(async (poolId: string) => {
    if (baseTxLoading) return;
    setBaseTxLoading(true);
    resetBaseTx();

    try {
      if (!account) throw new Error("Connect your wallet first");

      setBaseTxStage("preparing");
      const bundle = await baseApi.prepareExit(poolId);
      const hashes = await executeBaseTxBundle(bundle);
      setBaseTxStage("confirmed");
      setBaseTxHashes(hashes);

      setTimeout(() => void refreshBase(), 2000);
    } catch (err) {
      setBaseTxError(cleanBaseError(err));
      setBaseTxStage("failed");
    } finally {
      setBaseTxLoading(false);
    }
  }, [account, baseApi, baseTxLoading, executeBaseTxBundle, refreshBase, refreshBaseBalances, resetBaseTx]);

  const handleBaseClaim = useCallback(async (poolId: string) => {
    if (baseTxLoading) return;
    setBaseTxLoading(true);
    resetBaseTx();

    try {
      if (!account) throw new Error("Connect your wallet first");

      setBaseTxStage("preparing");
      const bundle = await baseApi.prepareClaim(poolId);
      const hashes = await executeBaseTxBundle(bundle);
      setBaseTxStage("confirmed");
      setBaseTxHashes(hashes);

      setTimeout(() => void refreshBase(), 2000);
    } catch (err) {
      setBaseTxError(cleanBaseError(err));
      setBaseTxStage("failed");
    } finally {
      setBaseTxLoading(false);
    }
  }, [account, baseApi, baseTxLoading, executeBaseTxBundle, refreshBase, refreshBaseBalances, resetBaseTx]);

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
      <div className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-white">Liquid Staking</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Network selector */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10">
          <button
            onClick={() => setNetwork("base")}
            className={`flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition-colors ${network === "base" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            Base (Aerodrome)
          </button>
          <button
            onClick={() => setNetwork("ethereum")}
            className={`flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition-colors ${network === "ethereum" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            Ethereum (Lido)
          </button>
        </div>
      </div>
    ) : viewState === "review" ? (
      <div className="p-6 flex items-center justify-between">
        <h2 className="text-lg font-display font-bold text-white">{reviewTitle}</h2>
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
      </div>
    ) : null;

  return (
    <DefiWidgetModalShell
      onClose={onClose}
      variant={variant}
      isMobile={isMobile}
      header={header}
      footer={
        network === "base" ? (
          <div className="py-8 flex items-center justify-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
            <img src={AERODROME_LOGO} alt="Aerodrome" className="w-6 h-6 rounded-full" />
            <span className="text-sm font-medium text-zinc-400">Powered by Aerodrome Finance</span>
          </div>
        ) : (
          <div className="py-8 flex items-center justify-center gap-3 opacity-80 hover:opacity-100 transition-opacity">
            <img src="/miniapp/icons/lido_logo.png" alt="Lido" className="w-8 h-8 rounded-full" />
            <span className="text-sm font-medium text-zinc-400">Powered by Lido</span>
          </div>
        )
      }
      cardClassName="md:min-h-[540px]"
      bodyClassName="custom-scrollbar"
    >
      {/* ========== BASE (AERODROME) VIEW ========== */}
      {network === "base" && (() => {
        const poolTokens = selectedBasePool ? parsePoolTokens(selectedBasePool.poolName) : { tokenA: "Token A", tokenB: "Token B" };
        const apr = selectedBasePool ? formatBaseAPR(selectedBasePool.estimatedAPR, selectedBasePool) : null;
        return (
        <div className="flex flex-col h-full relative">
          {AERODROME_COMING_SOON && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0A0A0A]/90 backdrop-blur-sm">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2M12 2a10 10 0 100 20 10 10 0 000-20z" />
                </svg>
              </div>
              <span className="text-base font-semibold text-white mb-1">Coming Soon</span>
              <span className="text-xs text-zinc-500 text-center px-8">Aerodrome on-chain integration is not yet deployed. Switch to Ethereum (Lido) to stake now.</span>
            </div>
          )}
          <div className="px-6 pb-8 space-y-4 relative z-10 flex-1 flex flex-col">

            {/* Action mode tabs: Stake / Positions */}
            <div className="grid grid-cols-2 gap-2">
              {(["stake", "positions"] as BaseAction[]).map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => { setBaseAction(action); resetBaseTx(); }}
                  className={`py-2 rounded-xl border transition-colors text-xs font-medium capitalize ${
                    baseAction === action
                      ? "bg-primary/15 border-primary/30 text-white"
                      : "bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {action === "positions" ? `Positions${basePositions.length > 0 ? ` (${basePositions.length})` : ""}` : "Stake"}
                </button>
              ))}
            </div>

            {/* ---- STAKE TAB ---- */}
            {baseAction === "stake" && (
              <>
                {/* Pool header */}
                {selectedBasePool && (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/10">
                    <div className="flex items-center -space-x-1.5">
                      {BASE_TOKEN_ICONS[poolTokens.tokenA] && <img src={BASE_TOKEN_ICONS[poolTokens.tokenA]} alt="" className="w-7 h-7 rounded-full border-2 border-black" />}
                      {BASE_TOKEN_ICONS[poolTokens.tokenB] && <img src={BASE_TOKEN_ICONS[poolTokens.tokenB]} alt="" className="w-7 h-7 rounded-full border-2 border-black" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-white">{selectedBasePool.poolName}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${selectedBasePool.stable ? "bg-blue-500/15 text-blue-400" : "bg-yellow-500/15 text-yellow-400"}`}>
                          {selectedBasePool.stable ? "Stable" : "Volatile"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] mt-0.5">
                        {apr && <span className="text-zinc-500">APR <span className={`font-semibold ${apr.newPool ? "text-cyan-400" : "text-emerald-400"}`}>{apr.label}</span></span>}
                        <button
                          onClick={() => void refreshBase()}
                          type="button"
                          className="inline-flex items-center gap-1 text-primary/90 hover:text-primary transition-colors"
                          disabled={baseLoading}
                        >
                          <RefreshCcw className={`w-3 h-3 ${baseLoading ? "animate-spin" : ""}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {baseLoading && !baseProtocolInfo && (
                  <div className="flex items-center justify-center py-8 text-zinc-500 text-sm gap-2">
                    <RefreshCcw className="w-4 h-4 animate-spin" />
                    Loading pools...
                  </div>
                )}

                {baseError && (
                  <div className="px-2">
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
                      <Info className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                      <p className="text-red-200 text-xs">{baseError}</p>
                    </div>
                  </div>
                )}

                {!selectedBasePool && !baseLoading && baseProtocolInfo && baseProtocolInfo.pools.length === 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-6 text-center text-zinc-500 text-sm">
                    No pools available at the moment
                  </div>
                )}

                {selectedBasePool && (
                  <>
                    <div className="rounded-xl border border-white/10 bg-blue-500/5 px-3 py-2 text-[11px] text-zinc-400 leading-relaxed">
                      Provide liquidity to the {selectedBasePool.poolName} pool on Aerodrome. You receive LP tokens staked in the gauge, earning AERO rewards.
                    </div>

                    <DataInput
                      label={`You provide (${poolTokens.tokenA})`}
                      balance={baseBalancesLoading ? "Available: ..." : `Available: ${formatBalance(baseTokenBalances.balA)} ${poolTokens.tokenA}`}
                      onMaxClick={baseTokenBalances.balA ? () => {
                        // Use raw balance string, trim trailing zeros for display
                        const raw = baseTokenBalances.balA!;
                        const n = parseFloat(raw);
                        if (!Number.isFinite(n) || n <= 0) return;
                        // Reduce by 0.1% to avoid rounding-induced TransferFromFailed
                        const safe = n * 0.999;
                        const dec = BASE_TOKEN_DECIMALS[poolTokens.tokenA] ?? 18;
                        const frac = Math.min(dec, 8);
                        setBaseAmountA(safe >= 1 ? safe.toFixed(4) : safe.toFixed(frac).replace(/0+$/, "").replace(/\.$/, ""));
                      } : undefined}
                      value={baseAmountA}
                      placeholder="0.00"
                      onChange={(e) => { if (/^\d*\.?\d*$/.test(e.target.value)) setBaseAmountA(e.target.value); }}
                      rightElement={
                        <div className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-3 py-2 min-h-[40px]">
                          {BASE_TOKEN_ICONS[poolTokens.tokenA] && <img src={BASE_TOKEN_ICONS[poolTokens.tokenA]} alt="" className="w-5 h-5 rounded-full" />}
                          <span className="text-white font-medium text-sm">{poolTokens.tokenA}</span>
                        </div>
                      }
                    />

                    <div className="h-1" />

                    <DataInput
                      label={`You provide (${poolTokens.tokenB})`}
                      balance={baseBalancesLoading ? "Available: ..." : `Available: ${formatBalance(baseTokenBalances.balB)} ${poolTokens.tokenB}`}
                      onMaxClick={baseTokenBalances.balB ? () => {
                        const raw = baseTokenBalances.balB!;
                        const n = parseFloat(raw);
                        if (!Number.isFinite(n) || n <= 0) return;
                        const safe = n * 0.999;
                        const dec = BASE_TOKEN_DECIMALS[poolTokens.tokenB] ?? 18;
                        const frac = Math.min(dec, 8);
                        setBaseAmountB(safe >= 1 ? safe.toFixed(4) : safe.toFixed(frac).replace(/0+$/, "").replace(/\.$/, ""));
                      } : undefined}
                      value={baseAmountB}
                      placeholder="0.00"
                      onChange={(e) => { if (/^\d*\.?\d*$/.test(e.target.value)) setBaseAmountB(e.target.value); }}
                      rightElement={
                        <div className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-3 py-2 min-h-[40px]">
                          {BASE_TOKEN_ICONS[poolTokens.tokenB] && <img src={BASE_TOKEN_ICONS[poolTokens.tokenB]} alt="" className="w-5 h-5 rounded-full" />}
                          <span className="text-white font-medium text-sm">{poolTokens.tokenB}</span>
                        </div>
                      }
                    />

                    <div className="flex items-center justify-between px-2 text-xs">
                      <span className="inline-flex items-center gap-1 text-zinc-400">
                        Estimated APR {apr ? <span className={`font-semibold ${apr.newPool ? "text-cyan-400" : "text-emerald-400"}`}>{apr.label}</span> : "—"}
                        <Info className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-zinc-500">Slippage: {baseSlippage}%</span>
                    </div>

                    {/* Stake CTA */}
                    <div className="mt-auto pt-2">
                      <NeonButton
                        onClick={handleBaseStake}
                        disabled={baseTxLoading || (!baseAmountA && !baseAmountB)}
                      >
                        {baseTxLoading ? "Processing..." : "Stake Liquidity"}
                      </NeonButton>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ---- POSITIONS TAB ---- */}
            {baseAction === "positions" && (
              <>
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-zinc-500 font-medium">Your Positions</span>
                  <button
                    onClick={() => void refreshBase()}
                    type="button"
                    className="inline-flex items-center gap-1 text-primary/90 hover:text-primary transition-colors text-xs"
                    disabled={baseLoading}
                  >
                    <RefreshCcw className={`w-3.5 h-3.5 ${baseLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                </div>

                {baseLoading && basePositions.length === 0 && (
                  <div className="flex items-center justify-center py-8 text-zinc-500 text-sm gap-2">
                    <RefreshCcw className="w-4 h-4 animate-spin" />
                    Loading positions...
                  </div>
                )}

                {!baseLoading && basePositions.length === 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-8 text-center space-y-2">
                    <p className="text-zinc-500 text-sm">No active positions</p>
                    <p className="text-zinc-600 text-xs">Stake liquidity in a pool to see your positions here.</p>
                  </div>
                )}

                {basePositions.map((pos) => {
                  const posTokens = parsePoolTokens(pos.poolName);
                  const poolInfo = baseProtocolInfo?.pools?.find((p) => p.poolId === pos.poolId);
                  const posApr = poolInfo ? formatBaseAPR(poolInfo.estimatedAPR, poolInfo) : null;
                  const hasStakedLP = safeParseBigInt(pos.stakedBalance) != null && safeParseBigInt(pos.stakedBalance)! > 0n;
                  const portfolio = basePortfolioAssets.find((a) => a.poolId === pos.poolId);
                  const tokenABal = portfolio ? parseFloat(portfolio.tokenA.balance) : 0;
                  const tokenBBal = portfolio ? parseFloat(portfolio.tokenB.balance) : 0;
                  // Use position earnedRewards (raw wei) or fall back to portfolio pendingRewards (formatted)
                  const rewardsBigRaw = safeParseBigInt(pos.earnedRewards);
                  const hasRewardsFromPosition = rewardsBigRaw != null && rewardsBigRaw > 0n;
                  const portfolioRewards = portfolio ? parseFloat(portfolio.pendingRewards) : 0;
                  const hasRewards = hasRewardsFromPosition || portfolioRewards > 0;

                  return (
                    <div
                      key={pos.poolId}
                      className="rounded-xl border border-white/10 bg-black/40 overflow-hidden"
                    >
                      {/* Position header */}
                      <div className="flex items-center gap-3 p-3 border-b border-white/5">
                        <div className="flex items-center -space-x-1.5">
                          {BASE_TOKEN_ICONS[posTokens.tokenA] && <img src={BASE_TOKEN_ICONS[posTokens.tokenA]} alt="" className="w-6 h-6 rounded-full border-2 border-black" />}
                          {BASE_TOKEN_ICONS[posTokens.tokenB] && <img src={BASE_TOKEN_ICONS[posTokens.tokenB]} alt="" className="w-6 h-6 rounded-full border-2 border-black" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-white truncate">{pos.poolName}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${pos.stable ? "bg-blue-500/15 text-blue-400" : "bg-yellow-500/15 text-yellow-400"}`}>
                              {pos.stable ? "Stable" : "Volatile"}
                            </span>
                          </div>
                          {posApr && (
                            <div className="text-[11px] text-zinc-500 mt-0.5">
                              APR <span className="text-emerald-400 font-semibold">{posApr.label}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Position details */}
                      <div className="space-y-0">
                        {/* Underlying token balances (when available) or LP amount */}
                        {tokenABal > 0 || tokenBBal > 0 ? (
                          <div className="grid grid-cols-2 gap-px bg-white/5">
                            <div className="p-3 bg-black/60">
                              <div className="text-[10px] uppercase tracking-widest text-zinc-500">{posTokens.tokenA}</div>
                              <div className="mt-1 text-white font-mono text-sm">
                                {tokenABal.toFixed(tokenABal < 0.01 ? 6 : 4)}
                              </div>
                            </div>
                            <div className="p-3 bg-black/60">
                              <div className="text-[10px] uppercase tracking-widest text-zinc-500">{posTokens.tokenB}</div>
                              <div className="mt-1 text-white font-mono text-sm">
                                {tokenBBal.toFixed(tokenBBal < 0.01 ? 6 : 2)}
                              </div>
                            </div>
                          </div>
                        ) : hasStakedLP ? (
                          <div className="px-3 py-2.5 border-t border-white/5 bg-black/60">
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Staked LP</div>
                            <div className="mt-1 text-white font-mono text-sm">{formatWei(pos.stakedBalance)}</div>
                          </div>
                        ) : null}

                        {/* Rewards row */}
                        {hasRewards && (
                          <div className="flex items-center justify-between px-3 py-2.5 border-t border-white/5 bg-black/60">
                            <span className="text-[10px] uppercase tracking-widest text-zinc-500">Pending Rewards</span>
                            <span className="text-sm font-mono text-amber-400">
                              {hasRewardsFromPosition
                                ? `${formatWei(pos.earnedRewards, pos.rewardToken.decimals)} ${pos.rewardToken.symbol}`
                                : `${portfolioRewards.toFixed(portfolioRewards < 0.001 ? 6 : 4)} ${portfolio!.rewardTokenSymbol}`
                              }
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Info note when LP=0 but rewards exist */}
                      {!hasStakedLP && hasRewards && (
                        <div className="px-3 py-2 bg-yellow-500/5 border-t border-white/5">
                          <p className="text-[10px] text-yellow-400/80">
                            Rewards will be automatically collected on your next stake operation.
                          </p>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2 p-3 border-t border-white/5">
                        {hasStakedLP && (
                          <button
                            type="button"
                            onClick={() => void handleBaseUnstake(pos.poolId)}
                            disabled={baseTxLoading}
                            className="flex-1 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            {baseTxLoading ? "..." : "Unstake"}
                          </button>
                        )}
                        {hasStakedLP && hasRewards && (
                          <button
                            type="button"
                            onClick={() => void handleBaseClaim(pos.poolId)}
                            disabled={baseTxLoading}
                            className="flex-1 py-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            {baseTxLoading ? "..." : "Claim Rewards"}
                          </button>
                        )}
                        {!hasStakedLP && !hasRewards && (
                          <span className="text-xs text-zinc-500 py-2">Position fully withdrawn</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* Transaction status (shared) */}
            {baseTxStage !== "idle" && (
              <div className="px-2">
                <div className={`p-3 rounded-xl border text-xs space-y-2 ${
                  baseTxStage === "confirmed" ? "bg-emerald-500/10 border-emerald-500/20" :
                  baseTxStage === "failed" ? "bg-red-500/10 border-red-500/20" :
                  "bg-blue-500/10 border-blue-500/20"
                }`}>
                  <div className="flex items-center gap-2">
                    {(baseTxStage === "preparing" || baseTxStage === "signing" || baseTxStage === "pending") && (
                      <RefreshCcw className="w-3 h-3 text-cyan-400 animate-spin" />
                    )}
                    <span className={
                      baseTxStage === "confirmed" ? "text-emerald-400" :
                      baseTxStage === "failed" ? "text-red-400" :
                      "text-cyan-400"
                    }>
                      {baseTxStage === "preparing" && "Preparing transaction..."}
                      {baseTxStage === "signing" && (baseTxStep ? `Sign ${baseTxStep.label} (${baseTxStep.current}/${baseTxStep.total})` : "Awaiting wallet signature...")}
                      {baseTxStage === "pending" && (baseTxStep ? `Confirming ${baseTxStep.label} (${baseTxStep.current}/${baseTxStep.total})` : "Confirming...")}
                      {baseTxStage === "confirmed" && "Transaction confirmed!"}
                      {baseTxStage === "failed" && "Transaction failed"}
                    </span>
                  </div>
                  {baseTxError && <div className="text-red-400">{baseTxError}</div>}
                  {baseTxHashes.length > 0 && (
                    <div className="space-y-1">
                      {baseTxHashes.map((hash, i) => (
                        <a
                          key={hash}
                          href={`https://basescan.org/tx/${hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-cyan-400 hover:text-cyan-300 font-mono truncate text-[11px]"
                        >
                          Tx {i + 1}: {hash.slice(0, 10)}...{hash.slice(-8)}
                        </a>
                      ))}
                    </div>
                  )}
                  {(baseTxStage === "confirmed" || baseTxStage === "failed") && (
                    <button
                      onClick={resetBaseTx}
                      type="button"
                      className="mt-1 text-xs text-zinc-400 hover:text-white transition-colors"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
        );
      })()}

      {/* ========== ETHEREUM (LIDO) VIEW ========== */}
      {network === "ethereum" && (
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
      )}

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

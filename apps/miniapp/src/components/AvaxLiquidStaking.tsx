'use client';

import { useCallback, useEffect, useState } from 'react';
import { Droplets, X, RefreshCw, ExternalLink } from 'lucide-react';
import { useActiveAccount } from 'thirdweb/react';
import { DefiWidgetModalShell } from '@/components/ui/DefiWidgetModalShell';
import { useAvaxStakingApi, type AvaxUnlockRequest } from '@/features/staking/avaxStakingApi';
import { useLendingApi } from '@/features/lending';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';
import { waitForEvmReceipt } from '@/shared/utils/evmReceipt';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const AVAX_CHAIN_ID = 43114;
const AVAX_DECIMALS = 18;
const SAVAX_ICON = 'https://assets.coingecko.com/coins/images/21630/small/benqi.png';
const AVAX_ICON = 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png';
const SNOWTRACE_TX = (hash: string) => `https://snowtrace.io/tx/${hash}`;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatWei(wei: string | null | undefined, decimals = 18, maxFrac = 4): string {
  if (!wei) return '0';
  try {
    const val = Number(BigInt(wei)) / 10 ** decimals;
    return val.toLocaleString('en-US', { maximumFractionDigits: maxFrac });
  } catch {
    return '0';
  }
}

function parseToWei(amount: string, decimals = 18): string {
  try {
    const trimmed = amount.trim();
    if (!trimmed || isNaN(Number(trimmed))) return '0';
    const parts = trimmed.split('.');
    const intPart = BigInt(parts[0] || '0');
    const fracStr = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals);
    const fracPart = BigInt(fracStr);
    return (intPart * BigInt(10 ** decimals) + fracPart).toString();
  } catch {
    return '0';
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Tab = 'stake' | 'unstake';
type UnstakeView = 'request' | 'redeem';
type TxStatus = 'idle' | 'preparing' | 'awaiting_wallet' | 'pending' | 'confirmed' | 'failed';

interface AvaxLiquidStakingProps {
  onClose: () => void;
  initialMode?: 'stake' | 'unstake';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AvaxLiquidStaking({ onClose, initialMode = 'stake' }: AvaxLiquidStakingProps) {
  const account = useActiveAccount();
  const avaxApi = useAvaxStakingApi();
  const lendingApi = useLendingApi(); // reuse for tx execution (handles AVAX chain switch)

  /* ---- UI state ---- */
  const [tab, setTab] = useState<Tab>(initialMode);
  const [unstakeView, setUnstakeView] = useState<UnstakeView>('request');

  /* ---- Form inputs ---- */
  const [stakeAmount, setStakeAmount] = useState('');
  const [unlockAmount, setUnlockAmount] = useState('');

  /* ---- Balances ---- */
  const [avaxBalance, setAvaxBalance] = useState<string | null>(null);
  const [sAvaxBalance, setSAvaxBalance] = useState<string | null>(null);
  const [pendingUnlocks, setPendingUnlocks] = useState<AvaxUnlockRequest[]>([]);
  const [positionLoading, setPositionLoading] = useState(false);

  /* ---- Tx state ---- */
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [redeemingIndex, setRedeemingIndex] = useState<number | null>(null);

  /* ---------------------------------------------------------------- */
  /*  Fetch AVAX balance                                               */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!account?.address) return;
    let cancelled = false;

    const fetchAvaxBalance = async () => {
      try {
        const { createThirdwebClient, defineChain } = await import('thirdweb');
        const { eth_getBalance, getRpcClient } = await import('thirdweb/rpc');
        const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });
        const rpc = getRpcClient({ client, chain: defineChain(AVAX_CHAIN_ID) });
        const bal = await eth_getBalance(rpc, { address: account.address as `0x${string}` });
        if (!cancelled) setAvaxBalance(bal.toString());
      } catch {
        if (!cancelled) setAvaxBalance(null);
      }
    };

    fetchAvaxBalance();
    return () => { cancelled = true; };
  }, [account?.address]);

  /* ---------------------------------------------------------------- */
  /*  Fetch position (sAVAX balance + pending unlocks)                */
  /* ---------------------------------------------------------------- */
  const fetchPosition = useCallback(async () => {
    if (!account?.address) return;
    setPositionLoading(true);
    try {
      const pos = await avaxApi.getPosition();
      if (pos) {
        setSAvaxBalance(pos.sAvaxBalance);
        setPendingUnlocks(pos.pendingUnlocks);
      }
    } catch (e) {
      console.warn('[AvaxLiquidStaking] getPosition failed:', e);
    } finally {
      setPositionLoading(false);
    }
  }, [avaxApi, account?.address]);

  useEffect(() => { fetchPosition(); }, [fetchPosition]);

  /* ---------------------------------------------------------------- */
  /*  Execute a prepared tx using lendingApi (handles chain switch)   */
  /* ---------------------------------------------------------------- */
  const executeTx = useCallback(async (tx: { to: string; data: string; value: string; chainId: number }) => {
    setTxStatus('awaiting_wallet');
    setTxHash(null);
    setTxError(null);

    const result = await (lendingApi as any).executeTransactionWithStatus(tx);
    const hash: string = result.transactionHash;
    setTxHash(hash);
    setTxStatus('pending');

    const receipt = await waitForEvmReceipt({
      clientId: THIRDWEB_CLIENT_ID,
      chainId: AVAX_CHAIN_ID,
      txHash: hash,
      timeoutMs: 120_000,
    });

    if (receipt.outcome === 'confirmed') {
      setTxStatus('confirmed');
      await fetchPosition();
    } else if (receipt.outcome === 'reverted') {
      setTxStatus('failed');
      setTxError('Transaction reverted on chain.');
    } else {
      setTxStatus('confirmed'); // timeout — treat as likely confirmed, user can verify on explorer
    }
  }, [lendingApi, fetchPosition]);

  /* ---------------------------------------------------------------- */
  /*  Stake                                                            */
  /* ---------------------------------------------------------------- */
  const handleStake = useCallback(async () => {
    const amountWei = parseToWei(stakeAmount);
    if (amountWei === '0') { setTxError('Enter a valid amount.'); return; }
    setTxStatus('preparing');
    setTxError(null);
    try {
      const tx = await avaxApi.prepareStake(amountWei);
      if (!tx) throw new Error('No transaction returned from backend.');
      await executeTx(tx);
    } catch (e: any) {
      setTxStatus('failed');
      setTxError(e?.message ?? 'Stake failed.');
    }
  }, [avaxApi, stakeAmount, executeTx]);

  /* ---------------------------------------------------------------- */
  /*  Request Unlock                                                   */
  /* ---------------------------------------------------------------- */
  const handleRequestUnlock = useCallback(async () => {
    const amountWei = parseToWei(unlockAmount);
    if (amountWei === '0') { setTxError('Enter a valid sAVAX amount.'); return; }
    setTxStatus('preparing');
    setTxError(null);
    try {
      const tx = await avaxApi.prepareRequestUnlock(amountWei);
      if (!tx) throw new Error('No transaction returned from backend.');
      await executeTx(tx);
    } catch (e: any) {
      setTxStatus('failed');
      setTxError(e?.message ?? 'Request unlock failed.');
    }
  }, [avaxApi, unlockAmount, executeTx]);

  /* ---------------------------------------------------------------- */
  /*  Redeem                                                           */
  /* ---------------------------------------------------------------- */
  const handleRedeem = useCallback(async (index: number) => {
    setRedeemingIndex(index);
    setTxStatus('preparing');
    setTxError(null);
    try {
      const tx = await avaxApi.prepareRedeem(index);
      if (!tx) throw new Error('No transaction returned from backend.');
      await executeTx(tx);
    } catch (e: any) {
      setTxStatus('failed');
      setTxError(e?.message ?? 'Redeem failed.');
    } finally {
      setRedeemingIndex(null);
    }
  }, [avaxApi, executeTx]);

  const resetTx = () => {
    setTxStatus('idle');
    setTxHash(null);
    setTxError(null);
    setStakeAmount('');
    setUnlockAmount('');
  };

  const isSubmitting = txStatus === 'preparing' || txStatus === 'awaiting_wallet' || txStatus === 'pending';

  /* ---------------------------------------------------------------- */
  /*  Render helpers                                                   */
  /* ---------------------------------------------------------------- */

  const TxStatusBanner = () => {
    if (txStatus === 'idle') return null;
    const color =
      txStatus === 'confirmed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
      txStatus === 'failed'    ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                  'bg-blue-500/10 border-blue-500/20 text-blue-400';
    const label =
      txStatus === 'preparing'      ? 'Preparing transaction…' :
      txStatus === 'awaiting_wallet'? 'Waiting for wallet confirmation…' :
      txStatus === 'pending'        ? 'Transaction submitted, waiting for confirmation…' :
      txStatus === 'confirmed'      ? 'Transaction confirmed!' :
                                      `Failed: ${txError ?? 'Unknown error'}`;

    return (
      <div className={`rounded-xl border px-4 py-3 text-sm ${color} mb-4`}>
        <p>{label}</p>
        {txHash && (
          <a
            href={SNOWTRACE_TX(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center gap-1 text-xs opacity-70 hover:opacity-100"
          >
            View on Snowtrace <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {(txStatus === 'confirmed' || txStatus === 'failed') && (
          <button onClick={resetTx} className="mt-2 text-xs underline opacity-70 hover:opacity-100">
            {txStatus === 'confirmed' ? 'Make another transaction' : 'Try again'}
          </button>
        )}
      </div>
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Stake tab                                                        */
  /* ---------------------------------------------------------------- */
  const StakeTab = () => (
    <div className="space-y-4">
      {/* Balance */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-400">Available</span>
        <button
          className="text-cyan-400 font-medium"
          onClick={() => {
            if (avaxBalance) {
              const gasBuf = 3_000_000_000_000_000n; // 0.003 AVAX buffer
              const bal = BigInt(avaxBalance);
              const safe = bal > gasBuf ? bal - gasBuf : 0n;
              setStakeAmount(formatWei(safe.toString(), 18, 6));
            }
          }}
        >
          {avaxBalance ? `${formatWei(avaxBalance, 18, 4)} AVAX` : '—'} <span className="text-xs">Max</span>
        </button>
      </div>

      {/* Input */}
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <input
          type="number"
          min="0"
          placeholder="0.00"
          value={stakeAmount}
          onChange={(e) => setStakeAmount(e.target.value)}
          disabled={isSubmitting}
          className="flex-1 bg-transparent text-lg text-white placeholder-zinc-500 outline-none"
        />
        <div className="flex items-center gap-2">
          <img src={AVAX_ICON} alt="AVAX" className="w-5 h-5 rounded-full" />
          <span className="font-semibold text-white">AVAX</span>
        </div>
      </div>

      {/* Arrow */}
      <div className="text-center text-zinc-500 text-lg">↓</div>

      {/* You receive */}
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center gap-3">
        <span className="flex-1 text-lg text-zinc-400">{stakeAmount || '0.00'}</span>
        <div className="flex items-center gap-2">
          <img src={SAVAX_ICON} alt="sAVAX" className="w-5 h-5 rounded-full" />
          <span className="font-semibold text-white">sAVAX</span>
        </div>
      </div>

      <p className="text-xs text-zinc-500 text-center">
        sAVAX accrues staking rewards automatically via Benqi on Avalanche.
      </p>

      {/* Submit */}
      <button
        onClick={handleStake}
        disabled={isSubmitting || !stakeAmount}
        className="w-full rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed py-3 font-semibold text-black transition-colors"
      >
        {isSubmitting ? 'Processing…' : 'Stake AVAX'}
      </button>
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  Request Unlock tab                                               */
  /* ---------------------------------------------------------------- */
  const RequestUnlockTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-400">sAVAX balance</span>
        <button
          className="text-cyan-400 font-medium"
          onClick={() => { if (sAvaxBalance) setUnlockAmount(formatWei(sAvaxBalance, 18, 6)); }}
        >
          {sAvaxBalance ? `${formatWei(sAvaxBalance, 18, 4)} sAVAX` : '—'} <span className="text-xs">Max</span>
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <input
          type="number"
          min="0"
          placeholder="0.00"
          value={unlockAmount}
          onChange={(e) => setUnlockAmount(e.target.value)}
          disabled={isSubmitting}
          className="flex-1 bg-transparent text-lg text-white placeholder-zinc-500 outline-none"
        />
        <div className="flex items-center gap-2">
          <img src={SAVAX_ICON} alt="sAVAX" className="w-5 h-5 rounded-full" />
          <span className="font-semibold text-white">sAVAX</span>
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        Unlock requests have a cooldown period (~2 days). After the cooldown, you can redeem AVAX.
      </p>

      <button
        onClick={handleRequestUnlock}
        disabled={isSubmitting || !unlockAmount}
        className="w-full rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed py-3 font-semibold text-black transition-colors"
      >
        {isSubmitting ? 'Processing…' : 'Request Unlock'}
      </button>
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  Redeem tab                                                       */
  /* ---------------------------------------------------------------- */
  const RedeemTab = () => (
    <div className="space-y-3">
      {positionLoading ? (
        <p className="text-center text-zinc-500 text-sm py-4">Loading pending unlocks…</p>
      ) : pendingUnlocks.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-zinc-400 text-sm">No pending unlock requests.</p>
          <p className="text-zinc-500 text-xs mt-1">Request an unlock first from the "Request" tab.</p>
        </div>
      ) : (
        pendingUnlocks.map((req) => (
          <div
            key={req.index}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
          >
            <div>
              <p className="text-white font-medium text-sm">{formatWei(req.shareAmount, 18, 4)} sAVAX</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                {req.redeemable ? '✅ Ready to redeem' : `🔒 Unlocks ${formatDate(req.unlockTimeISO)}`}
              </p>
            </div>
            <button
              onClick={() => handleRedeem(req.index)}
              disabled={!req.redeemable || isSubmitting || redeemingIndex === req.index}
              className="rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 text-xs font-semibold text-black transition-colors"
            >
              {redeemingIndex === req.index ? '…' : 'Redeem'}
            </button>
          </div>
        ))
      )}

      <button
        onClick={fetchPosition}
        disabled={positionLoading}
        className="w-full flex items-center justify-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 py-2 transition-colors"
      >
        <RefreshCw className={`w-3 h-3 ${positionLoading ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  Header                                                           */
  /* ---------------------------------------------------------------- */
  const header = (
    <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-cyan-500/10 p-2">
          <Droplets className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="font-semibold text-white text-base">Liquid Staking</h2>
          <p className="text-xs text-zinc-500 mt-0.5">PANORAMA · AVALANCHE</p>
        </div>
      </div>
      <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
        <X className="w-5 h-5" />
      </button>
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <DefiWidgetModalShell
      onClose={onClose}
      header={header}
      gradientClassName="bg-cyan-500/10"
      showMobileHandle
    >
      <div className="px-5 py-4">
        {/* Tabs: Stake / Unstake */}
        <div className="flex gap-1 rounded-xl bg-white/5 p-1 mb-5">
          {(['stake', 'unstake'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); resetTx(); }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors capitalize ${
                tab === t ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t === 'stake' ? 'Stake' : 'Unstake'}
            </button>
          ))}
        </div>

        {/* Unstake sub-tabs */}
        {tab === 'unstake' && (
          <div className="flex gap-1 rounded-xl bg-white/5 p-1 mb-4">
            {(['request', 'redeem'] as UnstakeView[]).map((v) => (
              <button
                key={v}
                onClick={() => { setUnstakeView(v); resetTx(); }}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors capitalize ${
                  unstakeView === v ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {v === 'request' ? 'Request Unlock' : 'Redeem'}
              </button>
            ))}
          </div>
        )}

        {/* Tx status banner */}
        <TxStatusBanner />

        {/* Content */}
        {tab === 'stake' && <StakeTab />}
        {tab === 'unstake' && unstakeView === 'request' && <RequestUnlockTab />}
        {tab === 'unstake' && unstakeView === 'redeem' && <RedeemTab />}
      </div>
    </DefiWidgetModalShell>
  );
}

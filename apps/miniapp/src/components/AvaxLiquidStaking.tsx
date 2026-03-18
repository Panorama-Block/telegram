'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Droplets, X, RefreshCw, ExternalLink, ArrowDown, Info, RefreshCcw } from 'lucide-react';
import { useActiveAccount } from 'thirdweb/react';
import { DefiWidgetModalShell } from '@/components/ui/DefiWidgetModalShell';
import { DataInput } from '@/components/ui/DataInput';
import { NeonButton } from '@/components/ui/NeonButton';
import { useAvaxStakingApi, type AvaxUnlockRequest } from '@/features/staking/avaxStakingApi';
import { useLendingApi } from '@/features/lending';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';
import { waitForEvmReceipt } from '@/shared/utils/evmReceipt';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const AVAX_CHAIN_ID = 43114;
const SAVAX_ICON = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/assets/0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE/logo.png';
const AVAX_ICON = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png';
const BENQI_ICON = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/assets/0x8729438EB15e2C8B576fCc6AeCdA6A148776C0F5/logo.png';
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
/*  Token pill — stable reference, never re-mounts                    */
/* ------------------------------------------------------------------ */

function TokenPill({ icon, alt, symbol }: { icon: string; alt: string; symbol: string }) {
  return (
    <div className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-3 py-2 min-h-[40px]">
      <img src={icon} alt={alt} className="w-5 h-5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      <span className="text-white font-medium text-sm">{symbol}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AvaxLiquidStaking({ onClose, initialMode = 'stake' }: AvaxLiquidStakingProps) {
  const account = useActiveAccount();
  const avaxApi = useAvaxStakingApi();
  const lendingApi = useLendingApi();

  /* ---- UI state ---- */
  const [tab, setTab] = useState<Tab>(initialMode);
  const [unstakeView, setUnstakeView] = useState<UnstakeView>('request');

  /* ---- Form inputs ---- */
  const [stakeAmount, setStakeAmount] = useState('');
  const [unlockAmount, setUnlockAmount] = useState('');

  /* ---- Balances ---- */
  const [avaxBalance, setAvaxBalance] = useState<string | null>(null);
  const [sAvaxBalance, setSAvaxBalance] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<string | null>(null);
  const [apy, setApy] = useState<number | null>(null);
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
  /*  Fetch position                                                   */
  /* ---------------------------------------------------------------- */
  const fetchPosition = useCallback(async () => {
    if (!account?.address) return;
    setPositionLoading(true);
    try {
      const pos = await avaxApi.getPosition();
      if (pos) {
        setSAvaxBalance(pos.sAvaxBalance);
        setExchangeRate(pos.exchangeRate);
        setApy(pos.apy ?? null);
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
  /*  Execute tx                                                       */
  /* ---------------------------------------------------------------- */
  const executeTx = useCallback(async (tx: { to: string; data: string; value: string; chainId: number }) => {
    setTxStatus('awaiting_wallet');
    setTxHash(null);
    setTxError(null);
    const result = await (lendingApi as any).executeTransactionWithStatus(tx);
    const hash: string = result.transactionHash;
    setTxHash(hash);
    setTxStatus('pending');
    const receipt = await waitForEvmReceipt({ clientId: THIRDWEB_CLIENT_ID, chainId: AVAX_CHAIN_ID, txHash: hash, timeoutMs: 120_000 });
    if (receipt.outcome === 'confirmed') {
      setTxStatus('confirmed');
      await fetchPosition();
    } else if (receipt.outcome === 'reverted') {
      setTxStatus('failed');
      setTxError('Transaction reverted on chain.');
    } else {
      setTxStatus('confirmed');
    }
  }, [lendingApi, fetchPosition]);

  /* ---------------------------------------------------------------- */
  /*  Handlers                                                         */
  /* ---------------------------------------------------------------- */
  const handleStake = useCallback(async () => {
    const amountWei = parseToWei(stakeAmount);
    if (amountWei === '0') { setTxError('Enter a valid amount.'); return; }
    setTxStatus('preparing'); setTxError(null);
    try {
      const tx = await avaxApi.prepareStake(amountWei);
      if (!tx) throw new Error('No transaction returned from backend.');
      await executeTx(tx);
    } catch (e: any) { setTxStatus('failed'); setTxError(e?.message ?? 'Stake failed.'); }
  }, [avaxApi, stakeAmount, executeTx]);

  const handleRequestUnlock = useCallback(async () => {
    const amountWei = parseToWei(unlockAmount);
    if (amountWei === '0') { setTxError('Enter a valid sAVAX amount.'); return; }
    setTxStatus('preparing'); setTxError(null);
    try {
      const tx = await avaxApi.prepareRequestUnlock(amountWei);
      if (!tx) throw new Error('No transaction returned from backend.');
      await executeTx(tx);
    } catch (e: any) { setTxStatus('failed'); setTxError(e?.message ?? 'Request unlock failed.'); }
  }, [avaxApi, unlockAmount, executeTx]);

  const handleRedeem = useCallback(async (index: number) => {
    setRedeemingIndex(index); setTxStatus('preparing'); setTxError(null);
    try {
      const tx = await avaxApi.prepareRedeem(index);
      if (!tx) throw new Error('No transaction returned from backend.');
      await executeTx(tx);
    } catch (e: any) { setTxStatus('failed'); setTxError(e?.message ?? 'Redeem failed.'); }
    finally { setRedeemingIndex(null); }
  }, [avaxApi, executeTx]);

  const resetTx = () => { setTxStatus('idle'); setTxHash(null); setTxError(null); setStakeAmount(''); setUnlockAmount(''); };

  const isSubmitting = txStatus === 'preparing' || txStatus === 'awaiting_wallet' || txStatus === 'pending';

  /* ---------------------------------------------------------------- */
  /*  Derived values                                                   */
  /* ---------------------------------------------------------------- */
  const estimatedAvax = useMemo(() => {
    if (!unlockAmount || !exchangeRate) return '0.00';
    try {
      const sWei = parseToWei(unlockAmount);
      const avaxWei = (BigInt(sWei) * BigInt(exchangeRate)) / BigInt(10 ** 18);
      return formatWei(avaxWei.toString(), 18, 4);
    } catch { return '0.00'; }
  }, [unlockAmount, exchangeRate]);

  /* ---------------------------------------------------------------- */
  /*  Stable token pills (defined outside render to keep identity)    */
  /* ---------------------------------------------------------------- */
  const avaxPill  = <TokenPill icon={AVAX_ICON}  alt="AVAX"  symbol="AVAX"  />;
  const sAvaxPill = <TokenPill icon={SAVAX_ICON} alt="sAVAX" symbol="sAVAX" />;

  /* ---------------------------------------------------------------- */
  /*  Tx status banner                                                 */
  /* ---------------------------------------------------------------- */
  const txColor =
    txStatus === 'confirmed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
    txStatus === 'failed'    ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                               'bg-blue-500/10 border-blue-500/20 text-blue-400';
  const txLabel =
    txStatus === 'preparing'       ? 'Preparing transaction…' :
    txStatus === 'awaiting_wallet' ? 'Waiting for wallet confirmation…' :
    txStatus === 'pending'         ? 'Transaction submitted, waiting for confirmation…' :
    txStatus === 'confirmed'       ? 'Transaction confirmed!' :
                                     `Failed: ${txError ?? 'Unknown error'}`;

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
          <p className="text-xs text-zinc-500 mt-0.5">BENQI · AVALANCHE</p>
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
    <DefiWidgetModalShell onClose={onClose} header={header} gradientClassName="bg-cyan-500/10" showMobileHandle>
      <div className="px-6 pb-8 space-y-4 relative z-10">

        {/* Main tabs */}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => { setTab('stake'); resetTx(); }}
            className={`py-2 rounded-xl border transition-colors text-xs font-medium ${tab === 'stake' ? 'bg-primary/15 border-primary/30 text-white' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'}`}>
            Stake
          </button>
          <button type="button" onClick={() => { setTab('unstake'); resetTx(); }}
            className={`py-2 rounded-xl border transition-colors text-xs font-medium ${tab === 'unstake' ? 'bg-primary/15 border-primary/30 text-white' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'}`}>
            Unstake
          </button>
        </div>

        {/* Unstake sub-tabs */}
        {tab === 'unstake' && (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setUnstakeView('request'); resetTx(); }}
              className={`py-2 rounded-xl border transition-colors text-xs font-medium ${unstakeView === 'request' ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'}`}>
              Request Unlock
            </button>
            <button type="button" onClick={() => { setUnstakeView('redeem'); resetTx(); }}
              className={`py-2 rounded-xl border transition-colors text-xs font-medium ${unstakeView === 'redeem' ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'}`}>
              Redeem
            </button>
          </div>
        )}

        {/* Tx status banner */}
        {txStatus !== 'idle' && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${txColor}`}>
            <p>{txLabel}</p>
            {txHash && (
              <a href={SNOWTRACE_TX(txHash)} target="_blank" rel="noopener noreferrer"
                className="mt-1 flex items-center gap-1 text-xs opacity-70 hover:opacity-100">
                View on Snowtrace <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {(txStatus === 'confirmed' || txStatus === 'failed') && (
              <button onClick={resetTx} className="mt-2 text-xs underline opacity-70 hover:opacity-100">
                {txStatus === 'confirmed' ? 'Make another transaction' : 'Try again'}
              </button>
            )}
          </div>
        )}

        {/* ── STAKE TAB ── */}
        {tab === 'stake' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-blue-500/5 px-3 py-2 text-[11px] text-zinc-400 leading-relaxed">
              Stake AVAX via Benqi and receive sAVAX. Rewards accrue automatically in your sAVAX balance.
            </div>

            <DataInput
              label="You stake"
              value={stakeAmount}
              balance={`Available: ${avaxBalance ? `${formatWei(avaxBalance, 18, 4)} AVAX` : '--'}`}
              onMaxClick={avaxBalance ? () => {
                const gasBuf = 3_000_000_000_000_000n;
                const bal = BigInt(avaxBalance);
                const safe = bal > gasBuf ? bal - gasBuf : 0n;
                setStakeAmount(formatWei(safe.toString(), 18, 6));
              } : undefined}
              onChange={(e) => {
                const v = e.target.value;
                if (!/^(\d+(\.\d*)?|\.\d*)$/.test(v) && v !== '') return;
                setStakeAmount(v);
              }}
              rightElement={avaxPill}
            />

            <div className="flex justify-center -my-3 relative z-20">
              <div className="bg-[#0A0A0A] border border-white/10 p-1.5 rounded-xl text-zinc-400">
                <ArrowDown className="w-4 h-4" />
              </div>
            </div>

            <DataInput
              label="You receive"
              value={stakeAmount || '0.00'}
              readOnly
              className="text-zinc-400"
              rightElement={sAvaxPill}
            />

            <div className="flex items-center justify-between px-2 text-xs">
              <span className="inline-flex items-center gap-1 text-zinc-400">
                Estimated APY {apy !== null ? `${apy.toFixed(2)}%` : '—'}
                <Info className="w-3.5 h-3.5" />
              </span>
              <button type="button" onClick={fetchPosition} disabled={positionLoading}
                className="inline-flex items-center gap-2 text-cyan-400/90 hover:text-cyan-400 transition-colors">
                <RefreshCcw className={`w-3.5 h-3.5 ${positionLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 px-2">
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">sAVAX</div>
                <div className="mt-1 text-white font-mono text-sm">{formatWei(sAvaxBalance, 18, 4)}</div>
              </div>
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Pending Unlocks</div>
                <div className="mt-1 text-white font-mono text-sm">{pendingUnlocks.length}</div>
              </div>
            </div>

            <NeonButton onClick={handleStake} disabled={isSubmitting || !stakeAmount}>
              {isSubmitting ? 'Processing…' : 'Stake AVAX'}
            </NeonButton>

            <div className="flex items-center justify-center gap-2">
              <img src={BENQI_ICON} alt="Benqi" className="w-5 h-5 rounded-full" />
              <span className="text-xs text-zinc-500">Powered by Benqi</span>
            </div>
          </div>
        )}

        {/* ── REQUEST UNLOCK TAB ── */}
        {tab === 'unstake' && unstakeView === 'request' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-400 leading-relaxed">
              Unlock requests have a ~15-day cooldown. After it expires, redeem your AVAX in the Redeem tab.
            </div>

            <DataInput
              label="You unstake"
              value={unlockAmount}
              balance={`Available: ${sAvaxBalance ? `${formatWei(sAvaxBalance, 18, 4)} sAVAX` : '--'}`}
              onMaxClick={sAvaxBalance ? () => setUnlockAmount(formatWei(sAvaxBalance, 18, 6)) : undefined}
              onChange={(e) => {
                const v = e.target.value;
                if (!/^(\d+(\.\d*)?|\.\d*)$/.test(v) && v !== '') return;
                setUnlockAmount(v);
              }}
              rightElement={sAvaxPill}
            />

            <div className="flex justify-center -my-3 relative z-20">
              <div className="bg-[#0A0A0A] border border-white/10 p-1.5 rounded-xl text-zinc-400">
                <ArrowDown className="w-4 h-4" />
              </div>
            </div>

            <DataInput
              label="You receive"
              value={estimatedAvax}
              readOnly
              className="text-zinc-400"
              rightElement={avaxPill}
            />

            <NeonButton onClick={handleRequestUnlock} disabled={isSubmitting || !unlockAmount}>
              {isSubmitting ? 'Processing…' : 'Request Unlock'}
            </NeonButton>

            <div className="flex items-center justify-center gap-2">
              <img src={BENQI_ICON} alt="Benqi" className="w-5 h-5 rounded-full" />
              <span className="text-xs text-zinc-500">Powered by Benqi</span>
            </div>
          </div>
        )}

        {/* ── REDEEM TAB ── */}
        {tab === 'unstake' && unstakeView === 'redeem' && (
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
                <div key={req.index} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
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
            <button onClick={fetchPosition} disabled={positionLoading}
              className="w-full flex items-center justify-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 py-2 transition-colors">
              <RefreshCw className={`w-3 h-3 ${positionLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        )}

      </div>
    </DefiWidgetModalShell>
  );
}

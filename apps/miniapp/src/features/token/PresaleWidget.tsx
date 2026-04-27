'use client'

import { useState } from 'react'
import { CountdownTimer } from './CountdownTimer'
import { AllocationModal } from './AllocationModal'
import { TOKEN_CONFIG, CURRENCIES, type Currency } from './config'

export function PresaleWidget() {
  const [currency, setCurrency] = useState<Currency>('USDT')
  const [payAmount, setPayAmount] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const usdValue = (parseFloat(payAmount) || 0) * TOKEN_CONFIG.rates[currency]
  const tokensReceived =
    usdValue > 0
      ? Math.floor(usdValue / TOKEN_CONFIG.seedPrice).toLocaleString('en-US')
      : ''

  const filledPct = Math.round(
    (TOKEN_CONFIG.raisedUSD / TOKEN_CONFIG.hardCapUSD) * 100,
  )

  // Minimum in the selected currency, not just USD
  const minInCurrency = TOKEN_CONFIG.minInvestmentUSD / TOKEN_CONFIG.rates[currency]
  const canRequest =
    parseFloat(payAmount) >= minInCurrency && parseFloat(payAmount) > 0

  const dotColor: Record<Currency, string> = {
    USDT: 'bg-emerald-400',
    USDC: 'bg-emerald-400',
    ETH: 'bg-pano-text-accent',
    BNB: 'bg-yellow-400',
  }

  return (
    <>
      {/* Outer glow wrapper */}
      <div className="relative w-full max-w-[480px] mx-auto">
        {/* Ambient glow ring */}
        <div className="absolute -inset-px rounded-[22px] bg-gradient-to-br from-pano-primary/40 via-pano-primary/10 to-pano-primary/40 blur-sm pointer-events-none" />

        {/* Card */}
        <div className="relative bg-[#0A1520] border border-pano-primary/30 rounded-[20px] px-7 py-8 shadow-[0_0_60px_hsl(var(--pano-primary)/0.12)] overflow-hidden">
          {/* Subtle dot grid */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(rgba(15,244,198,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(15,244,198,0.03) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          <div className="relative">
            {/* ── Header ── */}
            <h2 className="text-center text-[22px] font-black text-pano-text-accent tracking-tight mb-1">
              Buy $PANBLK Now
            </h2>
            <p className="text-center text-[11px] text-white/40 uppercase tracking-[0.18em] mb-6">
              Panorama Block · Seed Round
            </p>

            {/* Stage badge */}
            <div className="flex justify-center mb-5">
              <span className="bg-pano-primary/10 border border-pano-primary/30 rounded-full px-4 py-1.5 text-[11px] font-semibold text-pano-text-accent uppercase tracking-widest">
                Seed Round Open
              </span>
            </div>

            {/* Countdown */}
            <p className="text-center text-[10px] text-white/35 uppercase tracking-[0.15em] mb-2">
              Seed round closes in
            </p>
            <CountdownTimer />

            {/* ── Current price ── */}
            <div className="bg-pano-primary/[0.06] border border-pano-primary/15 rounded-xl px-5 py-4 text-center mb-3">
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Seed Price</p>
              <p className="text-[32px] font-black text-white leading-none">
                ${TOKEN_CONFIG.seedPrice.toFixed(3)}
              </p>
            </div>

            {/* Listing price + upside */}
            <div className="flex items-center justify-center gap-3 mb-5">
              <span className="text-[11px] text-white/40 uppercase tracking-wide">Listing Price</span>
              <span className="text-base font-bold text-pano-text-accent">
                ${TOKEN_CONFIG.listingPrice.toFixed(2)}
              </span>
              <span className="bg-pano-text-accent text-[#050B12] text-[10px] font-black px-2.5 py-0.5 rounded-full -rotate-1 inline-block select-none">
                +{TOKEN_CONFIG.upsidePercent}%
              </span>
            </div>

            {/* ── Progress bar ── */}
            <div className="mb-5">
              <div className="flex justify-between text-[10px] text-white/40 mb-1.5">
                <span>Raised</span>
                <span>{filledPct}% filled</span>
              </div>
              <div className="bg-white/[0.07] rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pano-primary to-pano-primary-hover rounded-full"
                  style={{ width: `${filledPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-white/45 mt-1.5">
                <strong className="text-pano-text-accent">
                  ${TOKEN_CONFIG.raisedUSD.toLocaleString()}
                </strong>
                <span>
                  Hard Cap:{' '}
                  <strong className="text-white/60">
                    ${TOKEN_CONFIG.hardCapUSD.toLocaleString()}
                  </strong>
                </span>
              </div>
            </div>

            <hr className="border-white/[0.06] mb-5" />

            {/* ── Currency selector ── */}
            <div className="mb-4">
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-2">
                Select currency to pay with
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {CURRENCIES.map(cur => (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => {
                      setCurrency(cur)
                      setPayAmount('')
                    }}
                    className={`h-9 rounded-lg text-[11px] font-semibold transition-all ${
                      currency === cur
                        ? 'bg-pano-primary/10 border border-pano-primary/40 text-pano-text-accent'
                        : 'bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/20'
                    }`}
                  >
                    {cur}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Pay input ── */}
            <div className="mb-3">
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1.5">You pay</p>
              <div className="bg-white/[0.05] border border-white/10 focus-within:border-pano-primary/40 rounded-xl flex items-center px-4 h-14 transition-colors gap-3">
                <input
                  type="number"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder="0"
                  min={0}
                  className="bg-transparent flex-1 text-white text-2xl font-bold outline-none placeholder-white/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-white/50 whitespace-nowrap flex-shrink-0">
                  <span className={`w-2 h-2 rounded-full ${dotColor[currency]}`} />
                  {currency}
                </div>
              </div>
              <p className="text-[10px] text-white/25 mt-1 text-right">
                Min ${TOKEN_CONFIG.minInvestmentUSD.toLocaleString()} ·{' '}
                Max ${TOKEN_CONFIG.maxInvestmentUSD.toLocaleString()}
              </p>
            </div>

            {/* ── Receive output ── */}
            <div className="mb-5">
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1.5">
                You receive
              </p>
              <div className="bg-pano-primary/[0.04] border border-pano-primary/15 rounded-xl flex items-center px-4 h-14 gap-3">
                <input
                  type="text"
                  value={tokensReceived}
                  placeholder="0"
                  readOnly
                  className="bg-transparent flex-1 text-pano-text-accent text-xl font-bold outline-none placeholder-white/20"
                />
                <span className="text-pano-text-accent text-[13px] font-bold tracking-wide flex-shrink-0">
                  $PANBLK
                </span>
              </div>
            </div>

            {/* ── CTA ── */}
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              disabled={!canRequest}
              className="w-full h-14 rounded-xl bg-gradient-to-r from-pano-primary to-pano-primary-hover text-black font-black text-[15px] tracking-wide transition-all disabled:opacity-35 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99] mb-3 flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Request Allocation
            </button>

            {!canRequest && payAmount && (
              <p className="text-center text-[10px] text-white/30 mb-3">
                Minimum investment: ${TOKEN_CONFIG.minInvestmentUSD.toLocaleString()} USD
              </p>
            )}

            {/* How it works anchor */}
            <div className="flex justify-center mb-5">
              <a
                href="#how-it-works"
                className="text-[11px] text-white/30 hover:text-white/55 transition-colors underline underline-offset-4"
              >
                How does this work?
              </a>
            </div>

            {/* ── Stats strip ── */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { val: TOKEN_CONFIG.totalSupply, label: 'Total Supply', accent: false },
                { val: TOKEN_CONFIG.seedAllocPercent, label: 'Seed Alloc', accent: true },
                { val: TOKEN_CONFIG.tgeFDV, label: 'TGE FDV', accent: false },
              ].map(({ val, label, accent }) => (
                <div
                  key={label}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-xl py-3 text-center"
                >
                  <p className={`text-[14px] font-bold ${accent ? 'text-pano-text-accent' : 'text-white'}`}>
                    {val}
                  </p>
                  <p className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* ── Vesting note ── */}
            <div className="bg-yellow-500/[0.06] border border-yellow-500/20 rounded-xl px-4 py-3 text-[10.5px] text-yellow-400/70 text-center leading-relaxed">
              ⚠ Seed tokens: {TOKEN_CONFIG.vestingCliffMonths}-month cliff +{' '}
              {TOKEN_CONFIG.vestingDurationMonths}-month linear vesting.
              <br />
              {TOKEN_CONFIG.tgeUnlockPercent}% available at TGE · Monthly release from Month{' '}
              {TOKEN_CONFIG.vestingCliffMonths + 1}.
            </div>
          </div>
        </div>
      </div>

      <AllocationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        amount={payAmount}
        currency={currency}
        tokensReceived={tokensReceived}
      />
    </>
  )
}

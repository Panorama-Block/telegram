'use client'

import { useState } from 'react'
import { CURRENCIES, TOKEN_CONFIG, SALE_ENDS_AT } from './config'
import { fmtUSD, useCalc, useLiveParticipants, useLiveRaised } from './tokenHooks'
import { CCY_DOT } from './tokenData'
import { LiveDot, Countdown } from './TokenPrimitives'
import { AllocationModal } from './AllocationModal'

function BigStat({
  label, value, sub, accent,
}: {
  label: string; value: string; sub?: string; accent?: boolean
}) {
  return (
    <div
      className="rounded-xl px-3 md:px-4 py-3 md:py-4 backdrop-blur-sm"
      style={{ background: 'rgba(20, 20, 22, 0.65)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1.5 md:mb-2">{label}</div>
      <div className={`font-display tabular-nums text-xl md:text-2xl font-bold leading-none ${accent ? 'text-cyan-400' : 'text-white'}`}>
        {value}
      </div>
      {sub && <div className="font-mono text-[9px] md:text-[10.5px] text-white/35 mt-1.5 md:mt-2 tabular-nums">{sub}</div>}
    </div>
  )
}

export function TokenLive() {
  const raised       = useLiveRaised()
  const participants = useLiveParticipants()
  const filledPct    = (raised / TOKEN_CONFIG.hardCapUSD) * 100
  const calc         = useCalc()
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <section id="live" className="border-t border-white/[0.05]">

      {/* ── Header + stats + progress — full width ── */}
      <div className="px-4 md:px-12 pt-10 md:pt-12 pb-6 md:pb-8">
        <h2 className="font-display text-3xl md:text-5xl font-bold text-white tracking-tight mb-6 md:mb-8 text-center">
          Sale, in real time.
        </h2>

        <div className="grid grid-cols-3 gap-2 md:gap-3 mb-4 md:mb-5">
          <BigStat label="Raised"       value={fmtUSD(raised)}               accent sub="↑ live" />
          <BigStat label="Participants" value={participants.toLocaleString()} sub="+3 last hour" />
          <BigStat label="Filled"       value={`${filledPct.toFixed(1)}%`}   sub={`of ${fmtUSD(TOKEN_CONFIG.hardCapUSD)}`} />
        </div>

        <div>
          <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-white/40 mb-2">
            <span>Hard cap progress</span>
            <span className="text-cyan-400 tabular-nums">{filledPct.toFixed(2)}%</span>
          </div>
          <div className="bg-white/[0.04] rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-300 rounded-full transition-all duration-700 relative"
              style={{ width: `${filledPct}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Two equal cards — stack on mobile ── */}
      <div className="px-4 md:px-12 pb-4 grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8 items-stretch">

        {/* ── Card 1: Sale active — countdown ── */}
        <div
            className="rounded-2xl overflow-hidden flex flex-col backdrop-blur-xl"
            style={{ background: 'rgba(15, 15, 17, 0.85)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="px-5 md:px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LiveDot />
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-300">
                  Sale active
                </span>
              </div>
              <span className="font-mono text-[10px] text-white/30 tabular-nums">est. May 9, 2026</span>
            </div>

            <div className="px-5 md:px-6 py-6 md:py-7 flex-1 flex flex-col justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35 mb-4 text-center">
                  Round closes in
                </div>
                <Countdown target={SALE_ENDS_AT} />
              </div>

              <div className="border-t border-white/[0.05] mt-5 md:mt-6 pt-5 md:pt-6 grid grid-cols-2 gap-x-4 md:gap-x-6 gap-y-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-1">Seed price</div>
                  <div className="font-display tabular-nums text-xl md:text-2xl text-white font-bold">
                    ${TOKEN_CONFIG.seedPrice.toFixed(3)}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-1">At listing</div>
                  <div className="flex items-baseline gap-1.5">
                    <div className="font-display tabular-nums text-xl md:text-2xl text-cyan-400 font-bold">
                      ${TOKEN_CONFIG.listingPrice.toFixed(2)}
                    </div>
                    <span className="font-mono text-[10px] text-cyan-400/70">×4</span>
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-1">Min · Max</div>
                  <div className="font-display tabular-nums text-sm md:text-base text-white/80">
                    ${TOKEN_CONFIG.minInvestmentUSD} — ${Math.floor(TOKEN_CONFIG.maxInvestmentUSD / 1_000)}K
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-1">FDV at TGE</div>
                  <div className="font-display tabular-nums text-sm md:text-base text-white/80">{TOKEN_CONFIG.tgeFDV}</div>
                </div>
              </div>

              <div className="mt-5 md:mt-6 pt-5 border-t border-white/[0.05]">
                <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-white/40 mb-2">
                  <span>Capital raised</span>
                  <span className="text-cyan-400 tabular-nums">{filledPct.toFixed(1)}%</span>
                </div>
                <div className="bg-white/[0.05] rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-700"
                    style={{ width: `${filledPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 font-mono text-[11px] tabular-nums">
                  <span className="text-cyan-400">{fmtUSD(raised)}</span>
                  <span className="text-white/40">of {fmtUSD(TOKEN_CONFIG.hardCapUSD)}</span>
                </div>
              </div>
            </div>
        </div>

        {/* ── Card 2: Claim allocation — calculator ── */}
        <div
          className="rounded-2xl p-5 md:p-6 flex flex-col backdrop-blur-xl"
          style={{
            background: 'rgba(13, 18, 18, 0.85)',
            border: '1px solid rgba(34,211,238,0.18)',
            boxShadow: '0 0 60px rgba(34,211,238,0.08), inset 0 0 40px rgba(34,211,238,0.03)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-white">Claim allocation</h3>
            <div className="flex items-center gap-2 font-mono text-[10px] text-cyan-400/80 uppercase tracking-wider">
              <LiveDot color="cyan" /> 1 USD = {Math.floor(1 / TOKEN_CONFIG.seedPrice)} PANBLK
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5 mb-4">
            {CURRENCIES.map((cur) => (
              <button
                key={cur}
                type="button"
                onClick={() => { calc.setCurrency(cur); calc.setPayAmount('') }}
                className={`h-9 rounded-lg text-[11px] md:text-[12px] font-mono font-semibold uppercase tracking-wider flex items-center justify-center gap-1 md:gap-1.5 transition-all ${
                  calc.currency === cur
                    ? 'bg-cyan-400/10 border border-cyan-400/40 text-cyan-400'
                    : 'bg-white/[0.03] border border-white/[0.06] text-white/45 hover:text-white/70'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${CCY_DOT[cur] ?? 'bg-white/40'}`} />
                {cur}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-1.5">You pay</div>
              <div className={`bg-white/[0.04] border rounded-xl flex items-center px-3 h-12 gap-2 ${calc.payAmount ? 'border-cyan-400/30' : 'border-white/10'}`}>
                <input
                  type="number"
                  value={calc.payAmount}
                  onChange={e => calc.setPayAmount(e.target.value)}
                  placeholder="0"
                  className="bg-transparent flex-1 text-white text-lg font-display font-bold outline-none placeholder-white/15 tabular-nums w-full min-w-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="font-mono text-[11px] text-white/50">{calc.currency}</span>
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-1.5">You get</div>
              <div className="bg-cyan-400/[0.05] border border-cyan-400/20 rounded-xl flex items-center px-3 h-12 gap-2">
                <div className="flex-1 text-cyan-400 text-lg font-display font-bold tabular-nums truncate">
                  {calc.tokensReceived > 0
                    ? calc.tokensReceived.toLocaleString()
                    : <span className="text-white/15">0</span>
                  }
                </div>
                <span className="font-mono text-[11px] text-cyan-400 font-bold">PANBLK</span>
              </div>
            </div>
          </div>

          {calc.tokensReceived > 0 && (
            <div className="font-mono text-[11px] text-white/45 tabular-nums mb-3 flex justify-between flex-wrap gap-1">
              <span>≈ {fmtUSD(calc.valueAtListing)} at listing</span>
              <span className="text-cyan-400">+{TOKEN_CONFIG.upsidePercent}% upside</span>
            </div>
          )}

          {/* push CTA to bottom so cards stay aligned */}
          <div className="flex-1" />

          <button
            type="button"
            disabled={!calc.canRequest}
            onClick={() => setModalOpen(true)}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 text-black font-bold text-sm tracking-wide transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.99] font-display"
            style={{ boxShadow: calc.canRequest ? '0 8px 32px rgba(34,211,238,0.35)' : 'none' }}
          >
            Request allocation →
          </button>

          {/* sale params */}
          <div className="mt-5 md:mt-6 pt-5 border-t border-white/[0.05]">
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/35 mb-3">
              Sale parameters
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 font-mono text-[11px]">
              {([
                ['hard_cap',   fmtUSD(TOKEN_CONFIG.hardCapUSD)],
                ['soft_cap',   fmtUSD(TOKEN_CONFIG.softCapUSD)],
                ['min_alloc',  fmtUSD(TOKEN_CONFIG.minInvestmentUSD)],
                ['max_alloc',  fmtUSD(TOKEN_CONFIG.maxInvestmentUSD)],
                ['tge_unlock', `${TOKEN_CONFIG.tgeUnlockPercent}%`],
                ['cliff',      `${TOKEN_CONFIG.vestingCliffMonths} months`],
                ['vesting',    `${TOKEN_CONFIG.vestingDurationMonths} mo linear`],
                ['fdv_at_tge', TOKEN_CONFIG.tgeFDV],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="text-white/40">{k}</span>
                  <span className="text-cyan-400 tabular-nums">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Trust bar — centered below both cards ── */}
      <div className="px-4 md:px-12 pb-8 md:pb-12 flex items-center justify-center gap-2 md:gap-3 font-mono text-[10px] uppercase tracking-[0.15em] text-white/30 flex-wrap">
        <span>Audited by Halborn</span>
        <span className="text-white/20">·</span>
        <span>Multisig verified</span>
        <span className="text-white/20">·</span>
        <span>KYC required</span>
      </div>

      <AllocationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        amount={calc.payAmount}
        currency={calc.currency}
        tokensReceived={calc.tokensReceived > 0 ? calc.tokensReceived.toLocaleString() : '0'}
      />
    </section>
  )
}

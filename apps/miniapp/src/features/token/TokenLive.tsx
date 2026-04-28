'use client'

import { useState } from 'react'
import { TOKEN_CONFIG, SALE_ENDS_AT } from './config'
import { LiveDot, Countdown } from './TokenPrimitives'
import { AllocationModal } from './AllocationModal'

export function TokenLive() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <section id="live" className="border-t border-white/[0.05]">

      <div className="px-4 md:px-12 pt-10 md:pt-12 pb-6 md:pb-8 text-center">
        <h2 className="font-display text-3xl md:text-5xl font-bold text-white tracking-tight mb-2">
          Seed Round — Live
        </h2>
        <p className="font-mono text-[11px] text-white/35">
          Limited allocation · Closes May 29, 2026
        </p>
      </div>

      <div className="px-4 md:px-12 pb-4 grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8 items-stretch">

        {/* Card 1: Countdown + pricing */}
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
            <span className="font-mono text-[10px] text-white/30 tabular-nums">est. May 29, 2026</span>
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
                  <span className="font-mono text-[10px] text-cyan-400/70">×{(TOKEN_CONFIG.listingPrice / TOKEN_CONFIG.seedPrice).toFixed(1)}</span>
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
          </div>
        </div>

        {/* Card 2: Request allocation */}
        <div
          className="rounded-2xl p-5 md:p-6 flex flex-col backdrop-blur-xl"
          style={{
            background: 'rgba(13, 18, 18, 0.85)',
            border: '1px solid rgba(34,211,238,0.18)',
            boxShadow: '0 0 60px rgba(34,211,238,0.08), inset 0 0 40px rgba(34,211,238,0.03)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-bold text-white">Request Allocation</h3>
            <div className="font-mono text-[10px] text-cyan-400/70 uppercase tracking-wider">
              1 USD = {Math.floor(1 / TOKEN_CONFIG.seedPrice)} PANBLK
            </div>
          </div>

          <p className="font-mono text-[11px] text-white/40 leading-relaxed mb-5">
            Submit your wallet address and intended amount. Our team reviews every request and sends payment instructions only after confirming your allocation.
          </p>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 text-black font-bold text-sm tracking-wide transition-all hover:brightness-110 active:scale-[0.99] font-display mb-5"
            style={{ boxShadow: '0 8px 32px rgba(34,211,238,0.35)' }}
          >
            Request Allocation →
          </button>

          <div className="pt-5 border-t border-white/[0.05]">
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/35 mb-3">
              Sale parameters
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 font-mono text-[11px]">
              {([
                ['hard_cap',  `$${(TOKEN_CONFIG.hardCapUSD / 1_000).toFixed(0)}K`],
                ['min_alloc', `$${TOKEN_CONFIG.minInvestmentUSD.toLocaleString()}`],
                ['max_alloc', `$${(TOKEN_CONFIG.maxInvestmentUSD / 1_000).toFixed(0)}K`],
                ['cliff',     `${TOKEN_CONFIG.vestingCliffMonths} months`],
                ['vesting',   `${TOKEN_CONFIG.vestingDurationMonths} mo linear`],
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

      <div className="px-4 md:px-12 pb-8 md:pb-12 flex items-center justify-center gap-2 md:gap-3 font-mono text-[10px] uppercase tracking-[0.15em] text-white/30 flex-wrap">
        <span>Multisig verified</span>
        <span className="text-white/20">·</span>
        <span>KYC required</span>
      </div>

      <AllocationModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </section>
  )
}

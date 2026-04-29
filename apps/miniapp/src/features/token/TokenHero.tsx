'use client'

function handleSmoothScroll(e: React.MouseEvent<HTMLAnchorElement>, targetId: string) {
  e.preventDefault()
  const el = document.querySelector(targetId)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function TokenHero() {
  return (
    <section id="overview" className="relative px-4 md:px-12 pt-12 md:pt-20 pb-16 md:pb-24 overflow-hidden">
<div className="relative z-10 text-center flex flex-col items-center">
        <h1
          className="font-display font-normal text-white tracking-[-0.02em] leading-[1.1] mb-6 md:mb-7"
          style={{ fontSize: 'clamp(28px, 4.5vw, 64px)' }}
        >
          The token for an <span className="text-cyan-400">agentic</span> economy.
        </h1>

        <p className="text-white/45 text-sm md:text-base leading-relaxed mb-8 md:mb-10 font-light max-w-xl">
          Panorama Block Protocol — a multi-chain AI agent network for composable DeFi,
          built on rigorous cryptoeconomic research led by UCLA faculty and other top
          universities. This Pre-Seed round is open to qualified participants. Token
          availability is on a first-come, first-served basis.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="#live"
            onClick={(e) => handleSmoothScroll(e, '#live')}
            className="h-10 md:h-11 px-6 rounded-full bg-cyan-400 text-black font-display font-medium text-sm hover:brightness-110 transition inline-flex items-center"
            style={{ boxShadow: '0 8px 32px rgba(34,211,238,0.3)' }}
          >
            Request allocation →
          </a>
          <a
            href="#about"
            onClick={(e) => handleSmoothScroll(e, '#about')}
            className="h-10 md:h-11 px-6 rounded-full border border-white/15 text-white/70 font-mono text-[12px] uppercase tracking-wider hover:border-white/30 hover:text-white transition inline-flex items-center"
          >
            About us
          </a>
        </div>
      </div>
    </section>
  )
}

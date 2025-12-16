import React from 'react'

const data = [
  {
    title: 'Phase 1 — Launch',
    items: [
      'Deploy DeFi agents in Telegram with swaps, staking, lending and cross-chain intents.',
      'Ship Mini App + gateway with secure auth and in-app wallet.',
    ],
  },
  {
    title: 'Phase 2 — Expansion',
    items: [
      'Add chains (Solana, Sonic, Bera) and new yield primitives.',
      'Composable strategies with risk profiles and guardrails.',
    ],
  },
  {
    title: 'Phase 3 — Orchestration',
    items: [
      'Multi-agent coordination for multi-step flows and portfolio balancing.',
      'Adaptive routing with live pricing, gas, and slippage controls.',
    ],
  },
  {
    title: 'Phase 4 — Enterprise',
    items: [
      'Institutional features: treasury automations, staking ops, compliance hooks.',
      'Mobile super-app experience with offline-safe sessions.',
    ],
  },
]

type StepSide = 'left' | 'right'

const Step = ({ index, title, items, side }: { index: number; title: string; items: string[]; side: StepSide }) => {
  const isLeft = side === 'left'
  return (
    <div className={`relative ${isLeft ? 'md:pr-12 md:mr-auto' : 'md:pl-12 md:ml-auto'}`}>
      {/* Marker by the central line */}
      <span
        className={`hidden md:inline-block absolute top-1/2 -translate-y-1/2 ${isLeft ? 'right-[-12px]' : 'left-[-12px]'} h-6 w-6`}
      >
        <span className="absolute inset-0 rounded-full bg-landing-highlight/10 ring-2 ring-landing-highlight/40" />
        <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-landing-highlight shadow-[0_0_16px_hsl(180_100%_50%/.6)]" />
        <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-landing-highlight/40 animate-ping" />
      </span>

      {/* Card */}
      <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-landing-tertiary via-[#0c0c0c] to-landing-background border border-landing-border/70 shadow-[0_10px_40px_rgba(0,0,0,0.45)] transition-transform hover:-translate-y-1">
        <div className="h-[3px] w-full bg-gradient-to-r from-landing-highlight/70 via-landing-highlight/20 to-transparent" />
        <div className="p-5 md:p-6 space-y-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-landing-highlight/15 ring-1 ring-landing-highlight/40 text-landing-highlight text-xs font-semibold">
              {index.toString().padStart(2, '0')}
            </span>
            <h3 className="text-landing-title text-xl md:text-2xl font-display tracking-tight">
              <span className="text-landing-highlight">{title}</span>
            </h3>
          </div>
          <ul className="space-y-2 text-landing-text text-base leading-relaxed max-w-[68ch] animate-slideUp">
            {items.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-landing-highlight/70 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* Hover glow border */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-0 ring-landing-highlight/0 transition-all duration-300 group-hover:ring-2 group-hover:ring-landing-highlight/15" />
        {/* Decorative gradient flare */}
        <div className={`pointer-events-none absolute ${isLeft ? 'right-0' : 'left-0'} top-0 h-full w-24 bg-gradient-to-${isLeft ? 'l' : 'r'} from-landing-highlight/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
      </div>
    </div>
  )
}

const Roadmap = () => {
  return (
    <section id="roadmap" className="relative mt-14 md:mt-24">
      <h2 className="text-landing-title text-3xl lg:text-5xl text-center font-display tracking-tight">Roadmap</h2>

      {/* Timeline container */}
      <div className="relative mx-auto mt-8 md:mt-12 max-w-5xl md:max-w-6xl px-4">
        {/* Central vertical line */}
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-full w-[2px] bg-gradient-to-b from-landing-highlight/40 via-landing-border/70 to-transparent">
          {/* Moving dash */}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,hsl(180_100%_50%/.6)_50%,transparent_100%)] bg-[length:2px_36px] animate-marquee opacity-60" />
        </div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-y-6 md:gap-y-10">
          <div className="md:col-start-1">
            <Step index={1} title={data[0].title} items={data[0].items} side="left" />
          </div>
          <div className="md:col-start-2">
            <Step index={2} title={data[1].title} items={data[1].items} side="right" />
          </div>
          <div className="md:col-start-1">
            <Step index={3} title={data[2].title} items={data[2].items} side="left" />
          </div>
          <div className="md:col-start-2">
            <Step index={4} title={data[3].title} items={data[3].items} side="right" />
          </div>
        </div>
      </div>
    </section>
  )
}

export default Roadmap

import React from 'react'

const data = [
  {
    title: 'Phase 1',
    items: [
      'Deploy first DeFi-focused AI agents on Telegram, enabling swaps, staking, lending, and multi-chain operations through simple prompts, establishing a modular multi-agent infrastructure supporting composable money legos strategies.',
    ],
  },
  {
    title: 'Phase 2',
    items: [
      'Expand agents to additional networks and integrate a broader set of DeFi yield protocols. Implement flexible composability layers that adjust strategy parameters according to varying user risk profiles and optimization objectives.',
    ],
  },
  {
    title: 'Phase 3',
    items: [
      'Enhance multi-agent orchestration with advanced reasoning modules coordinating complex multi-step workflows across protocols and chains while dynamically adjusting allocations, leverage, and portfolio distribution based on predefined strategy templates, evolving from simple prompt-driven commands to fully adaptive, multi-chain strategy execution.',
    ],
  },
  {
    title: 'Phase 4',
    items: [
      'Activate enterprise-grade multi-agent framework for institutional applications, including corporate liquidity management, institutional staking, micropayments, insurance and lending. Expand accessibility through familiar messaging and mobile interfaces and launch a fully featured mobile super app for high-utility DeFi management.',
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
      <div className="group relative overflow-hidden rounded-2xl bg-landing-tertiary/60 border border-landing-border/70 backdrop-blur-sm transition-transform hover:-translate-y-0.5">
        {/* Accent */}
        <div className="h-0.5 w-full bg-gradient-to-r from-landing-highlight/60 via-landing-highlight/20 to-transparent" />
        <div className="p-5 md:p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-landing-highlight/15 ring-1 ring-landing-highlight/40 text-landing-highlight text-xs font-medium">
              {index}
            </span>
            <h3 className="text-landing-title text-xl md:text-2xl">
              <span className="text-landing-highlight">{title}</span>
            </h3>
          </div>
          <ul className="list-disc pl-5 space-y-2 text-landing-text text-base leading-relaxed max-w-[68ch] animate-slideUp">
            {items.map((item, i) => (
              <li key={i}>{item}</li>
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
      <h2 className="text-landing-title text-3xl lg:text-5xl text-center">Roadmap</h2>

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

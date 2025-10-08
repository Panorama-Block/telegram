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

const Card = ({ title, items, className = '' }: { title: string; items: string[]; className?: string }) => (
  <div className={`relative overflow-hidden rounded-2xl bg-landing-tertiary/40 border border-landing-border shadow-[0px_16px_57.7px_0px_rgba(0,0,0,0.42)] backdrop-blur-sm ${className}`}>
    {/* Accent bar */}
    <div className="h-1 w-full bg-gradient-to-r from-landing-highlight/40 via-landing-highlight/20 to-transparent" />
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-3 mb-4">
        {/* Checkpoint dot replacing icons */}
        <span className="relative inline-flex items-center justify-center w-6 h-6">
          <span className="absolute inline-flex w-2.5 h-2.5 rounded-full bg-landing-highlight" />
          <span className="absolute inline-flex w-5 h-5 rounded-full ring-2 ring-landing-highlight/40" />
        </span>
        <h3 className="text-landing-title text-2xl md:text-3xl">
          <span className="text-landing-highlight">{title}</span>
        </h3>
      </div>
      <ul className="list-disc pl-5 space-y-3 text-landing-text text-base md:text-lg">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  </div>
)

const Connector = () => {
  // Decorative connector line that links the four cards
  // Scales with container using preserveAspectRatio="none"
  const styles = `
    .roadmap-connector .flow-base { stroke: #404040; stroke-opacity: 0.9; }
    .roadmap-connector .flow-glow { stroke: #00FFFF; filter: drop-shadow(0 0 6px rgba(0,255,255,0.4)); }
    .roadmap-connector .flow-dash { stroke-dasharray: 14 18; animation: dash-move 18s linear infinite; }
    @keyframes dash-move { to { stroke-dashoffset: -500; } }
  `
  return (
    <div className="pointer-events-none absolute inset-0 z-0 hidden md:block">
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <svg className="roadmap-connector" width="100%" height="100%" viewBox="0 0 1200 620" preserveAspectRatio="none">
        <defs>
          <linearGradient id="rm-base" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4C4C4C" stopOpacity="1" />
            <stop offset="95%" stopColor="#4C4C4C" stopOpacity="1" />
            <stop offset="100%" stopColor="#4C4C4C" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Orthogonal path: horizontal + vertical only */}
        <path d="M 140 140 L 720 140 L 720 500 L 980 500 L 260 500" stroke="url(#rm-base)" strokeWidth="1" fill="none" className="flow-base" />
        {/* Glow overlay */}
        <path d="M 140 140 L 720 140 L 720 500 L 980 500 L 260 500" stroke="#00FFFF" strokeWidth="1" fill="none" className="flow-glow flow-dash" />
      </svg>
    </div>
  )
}

const Roadmap = () => {
  return (
    <div id="roadmap" className="relative flex flex-col gap-6 mt-32">
      <h2 className="text-landing-title text-3xl lg:text-5xl text-center">Roadmap</h2>

      {/* Grid + connecting vector */}
      <div className="relative w-full px-4 md:px-8 lg:px-12 mt-12">
        <Connector />
        <div className="relative z-10 grid grid-cols-12 gap-4 md:gap-6 lg:gap-8">
          {/* Row 1: 7/5 split for asymmetry */}
          <div className="col-span-12 md:col-span-7">
            <Card title={data[0].title} items={data[0].items} />
          </div>
          <div className="col-span-12 md:col-span-5">
            <Card title={data[1].title} items={data[1].items} />
          </div>

          {/* Row 2: 4/8 split to vary rhythm (swap Phase 3 with 4) */}
          <div className="col-span-12 md:col-span-4">
            <Card title={data[3].title} items={data[3].items} />
          </div>
          <div className="col-span-12 md:col-span-8">
            <Card title={data[2].title} items={data[2].items} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Roadmap

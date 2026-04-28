const TEAM = [
  { name: 'Alex Nascimento',    role: 'CEO · UCLA Blockchain faculty · Author' },
  { name: 'Mikael Björn',       role: 'CTO · ex-Hedera Hashgraph & Baanx' },
  { name: 'Dr. Mattia Rattaggi',role: 'Sr. Advisor · Co-founder, Amina Bank' },
  { name: 'Inteli Engineers',   role: '4× full-stack blockchain · São Paulo' },
]

const FEATURES = [
  'Cross-chain liquidity & yield via conversational prompt',
  'AI co-pilot handles routing, execution & fee optimization',
  'No dashboards. No manual wallet config. No protocol navigation.',
  'Telegram Mini Apps as the primary delivery surface',
]

const STATS = [
  { label: 'Seed price',  value: '$0.025' },
  { label: 'TGE listing', value: '$0.08'  },
  { label: 'Upside',      value: '+220%'  },
  { label: 'Round cap',   value: '$500K'  },
]

function Card({
  tag, title, children, accent = false,
}: {
  tag: string; title: string; children: React.ReactNode; accent?: boolean
}) {
  return (
    <div
      className="rounded-2xl p-5 md:p-6 flex flex-col gap-4 backdrop-blur-xl"
      style={{
        background: accent ? 'rgba(13,18,18,0.88)' : 'rgba(15,15,17,0.82)',
        border: `1px solid ${accent ? 'rgba(34,211,238,0.18)' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: accent ? '0 0 48px rgba(34,211,238,0.06), inset 0 0 32px rgba(34,211,238,0.03)' : 'none',
      }}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-400/70">{tag}</div>
      <h3 className="font-display text-white font-semibold text-lg leading-tight">{title}</h3>
      {children}
    </div>
  )
}

export function TokenBriefing() {
  return (
    <section id="about" className="px-4 md:px-12 py-10 md:py-14 border-t border-white/[0.05]">
      <div className="flex flex-col items-center gap-2 mb-8 md:mb-10">
        <h2
          className="font-display font-bold text-white tracking-tight text-center"
          style={{ fontSize: 'clamp(28px, 3.8vw, 52px)' }}
        >
          About Panorama Block
        </h2>
        <p className="font-mono text-[11px] text-white/40 text-center">UCLA × Inteli × Amina Bank</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">

        {/* Card 1 — Who We Are */}
        <Card tag="01 / Team" title="Who We Are">
          <p className="text-white/50 text-[13px] leading-relaxed">
            A collaboration between UCLA's MQE program and a team of builders, academics,
            and institutional finance veterans — united by a single thesis: DeFi needs smarter infrastructure.
          </p>
          <ul className="mt-1 space-y-2.5">
            {TEAM.map(({ name, role }) => (
              <li key={name} className="flex flex-col gap-0.5">
                <span className="font-display text-white text-[13px] font-semibold">{name}</span>
                <span className="font-mono text-[10px] text-white/40 leading-snug">{role}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Card 2 — What We're Building */}
        <Card tag="02 / Product" title="What We're Building">
          <p className="text-white/50 text-[13px] leading-relaxed">
            A modular AI infrastructure layer for DeFi. Fragmented Web3 data unified across
            multiple chains into composable strategies — delivered through the world's most familiar interface: a chat window.
          </p>
          <ul className="mt-1 space-y-2">
            {FEATURES.map((f, i) => (
              <li key={i} className="flex gap-2 text-[12px] text-white/55 leading-relaxed">
                <span className="text-cyan-400/60 mt-0.5 flex-shrink-0">›</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Card 3 — Why $PANBLK */}
        <Card tag="03 / Token" title="Why buy $PANBLK" accent>
          <p className="text-white/50 text-[13px] leading-relaxed">
            Early Seed investors enter at $0.025, with structural protections aligning holders
            to long-term value creation. Beyond price, $PANBLK accrues governance rights, priority access,
            and fee discounts as the network grows.
          </p>

          <div className="grid grid-cols-2 gap-2 mt-1">
            {STATS.map(({ label, value }) => (
              <div
                key={label}
                className="rounded-xl px-3 py-3"
                style={{ background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.12)' }}
              >
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/40 mb-1">{label}</div>
                <div className="font-display tabular-nums text-xl font-bold text-cyan-400">{value}</div>
              </div>
            ))}
          </div>

          <div className="font-mono text-[10px] text-white/35 leading-relaxed mt-1">
            6-month cliff · 24-month linear vesting · $500K capped round
          </div>
        </Card>
      </div>
    </section>
  )
}

import { ROADMAP } from './tokenData'
import { Pill, LiveDot } from './TokenPrimitives'

export function TokenRoadmap() {
  return (
    <section id="roadmap" className="px-4 md:px-12 py-10 md:py-14 border-t border-white/[0.05]">
      <div className="flex flex-col items-center gap-2 mb-6 md:mb-8">
        <div>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-white tracking-tight text-center w-full">
            Roadmap.
          </h2>
        </div>
        <div className="font-mono text-[11px] text-white/40">4 phases · Q2 2026 → Q1 2027</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative">
        {/* Timeline line — desktop only */}
        <div className="hidden lg:block absolute top-[10px] left-[6%] right-[6%] h-px bg-gradient-to-r from-cyan-400 via-cyan-400/40 to-white/10" />

        {ROADMAP.map((r) => {
          const isLive = r.status === 'live'
          const isNext = r.status === 'next'
          return (
            <div key={r.phase} className="relative lg:pt-7">
              {/* Timeline node — desktop only */}
              <div
                className={`hidden lg:block absolute top-0 left-3 w-5 h-5 rounded-full border-2 ${
                  isLive
                    ? 'bg-cyan-400 border-cyan-400'
                    : isNext
                    ? 'bg-[#050505] border-cyan-400/60'
                    : 'bg-[#050505] border-white/20'
                }`}
                style={isLive ? { boxShadow: '0 0 20px #22d3ee' } : undefined}
              >
                {isLive && (
                  <span className="absolute inset-0 rounded-full bg-cyan-400 animate-ping opacity-60" />
                )}
              </div>

              <div
                className="rounded-2xl p-4 md:p-5 backdrop-blur-xl"
                style={{
                  background: isLive ? 'rgba(12, 18, 18, 0.88)' : 'rgba(15, 15, 17, 0.82)',
                  border: `1px solid ${isLive ? 'rgba(34,211,238,0.22)' : 'rgba(255,255,255,0.07)'}`,
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[11px] tracking-wider text-cyan-400/80">{r.phase}</span>
                  {isLive && <Pill tone="live"><LiveDot /> Live</Pill>}
                  {isNext && (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">Next</span>
                  )}
                </div>
                <h3 className="font-display text-white font-semibold text-base mb-3">{r.title}</h3>
                <ul className="space-y-1.5">
                  {r.items.map((it, j) => (
                    <li key={j} className="flex gap-2 text-[11.5px] text-white/55 leading-relaxed">
                      <span className="text-cyan-400/60 mt-0.5">›</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

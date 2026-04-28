const STEPS = [
  {
    n: '01',
    title: 'Submit Your Request',
    body: 'Enter your wallet address, a contact method, and your intended investment amount. The process takes less than 2 minutes.',
    hint: 'Min $500 · Max $500K',
  },
  {
    n: '02',
    title: 'We Review & Confirm',
    body: 'Our team reviews every request internally. Serious allocations are prioritised. You\'ll receive confirmation within 24 hours.',
    hint: 'Manual review · No bots',
  },
  {
    n: '03',
    title: 'Receive Payment Instructions',
    body: 'Once confirmed, we send you the verified wallet address and exact transfer amount. After you send, we verify the transaction and confirm your allocation.',
    hint: 'Via email · Telegram',
  },
]

export function TokenHowItWorks() {
  return (
    <section id="how-it-works" className="px-4 md:px-12 py-10 md:py-14 border-t border-white/[0.05]">

      <div className="flex flex-col items-center gap-2 mb-8 md:mb-10">
        <h2
          className="font-display font-bold text-white tracking-tight text-center"
          style={{ fontSize: 'clamp(28px, 3.8vw, 52px)' }}
        >
          How It Works
        </h2>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(15,15,17,0.82)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-cyan-400 via-cyan-400/40 to-transparent" />

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y divide-white/[0.06] md:divide-y-0 md:divide-x md:divide-white/[0.06]">
          {STEPS.map(({ n, title, body, hint }, i) => (
            <div key={n} className="relative p-6 md:p-8 overflow-hidden group">

              <div
                className="absolute -bottom-6 -right-3 font-display font-bold leading-none select-none pointer-events-none transition-opacity duration-500 group-hover:opacity-[0.07]"
                style={{ fontSize: '9rem', color: 'rgba(255,255,255,0.04)' }}
                aria-hidden
              >
                {n}
              </div>

              <div
                className="md:hidden absolute top-0 left-0 w-[2px] h-full"
                style={{
                  background: i === 0
                    ? 'linear-gradient(to bottom, #22d3ee, rgba(34,211,238,0.2))'
                    : i === 1
                    ? 'linear-gradient(to bottom, rgba(34,211,238,0.2), rgba(34,211,238,0.05))'
                    : 'rgba(255,255,255,0.05)',
                }}
              />

              <div className="relative z-10 flex flex-col gap-3 pl-2 md:pl-0">
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.25em]"
                    style={{ color: i === 0 ? '#22d3ee' : 'rgba(255,255,255,0.3)' }}
                  >
                    Step {n}
                  </span>
                  {i === 0 && (
                    <span
                      className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.2)' }}
                    >
                      Start here
                    </span>
                  )}
                </div>

                <h3 className="font-display text-white font-semibold text-lg leading-tight">{title}</h3>

                <p className="font-mono text-[12px] text-white/45 leading-relaxed">{body}</p>

                <div className="font-mono text-[10px] text-white/30 mt-1 flex items-center gap-1.5">
                  <span className="text-cyan-400/50">›</span>
                  {hint}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

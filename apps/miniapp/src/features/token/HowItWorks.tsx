const steps = [
  {
    n: '01',
    title: 'Calculate',
    body: 'Enter the amount you want to invest. The calculator instantly shows how many $PANBLK tokens you will receive at the seed price of $0.025.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m-6 4h6m-3 5h3M4 5a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" />
      </svg>
    ),
  },
  {
    n: '02',
    title: 'Request',
    body: 'Submit your EVM wallet address and desired allocation. Your spot in the seed round is then reserved and confirmed by our team manually.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    n: '03',
    title: 'Transfer',
    body: 'Send the exact amount to our verified multisig address shown after submission. Then confirm via Telegram with your transaction hash.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="w-full max-w-3xl mx-auto px-4 py-16">
      <div className="text-center mb-10">
        <p className="text-[11px] text-pano-text-accent uppercase tracking-[0.2em] mb-2">
          Simple Process
        </p>
        <h2 className="text-2xl font-bold text-white">How It Works</h2>
        <p className="text-white/40 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
          The seed round is a manually-verified process — intentionally simple and transparent.
          No automation, no risk of funds being lost in a contract.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {steps.map(({ n, title, body, icon }) => (
          <div
            key={n}
            className="relative bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 hover:border-pano-primary/25 transition-colors"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-pano-primary/10 border border-pano-primary/25 flex items-center justify-center text-pano-text-accent flex-shrink-0">
                {icon}
              </div>
              <span className="text-4xl font-black text-white/[0.06] leading-none select-none">
                {n}
              </span>
            </div>
            <h3 className="text-white font-bold text-base mb-2">{title}</h3>
            <p className="text-white/40 text-xs leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      {/* Trust note */}
      <div className="mt-8 text-center">
        <p className="text-xs text-white/25 leading-relaxed max-w-md mx-auto">
          Questions? Reach us directly on{' '}
          <a
            href="https://t.me/panoramablock"
            target="_blank"
            rel="noopener noreferrer"
            className="text-pano-text-accent hover:underline"
          >
            Telegram
          </a>
          . We confirm every allocation personally.
        </p>
      </div>
    </section>
  )
}

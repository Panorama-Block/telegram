import { TokenHeader }      from './TokenHeader'
import { TokenHero }        from './TokenHero'
import { TokenBriefing }    from './TokenBriefing'
import { TokenLive }        from './TokenLive'
import { TokenHowItWorks }  from './TokenHowItWorks'
import { TokenRoadmap }     from './TokenRoadmap'

export function TokenPage() {
  return (
    <div className="relative bg-[#050505] text-white min-h-screen">
      {/* Ambient glow layer — makes backdrop-blur visible on dark bg */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: -1 }} aria-hidden>
        <div
          className="absolute -top-20 left-1/2 -translate-x-1/2 w-[900px] h-[700px]"
          style={{ background: 'radial-gradient(ellipse at top, rgba(34,211,238,0.08) 0%, transparent 60%)' }}
        />
        <div
          className="absolute top-[40%] -left-40 w-[600px] h-[600px]"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 65%)' }}
        />
        <div
          className="absolute top-[65%] -right-40 w-[500px] h-[500px]"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.04) 0%, transparent 65%)' }}
        />
      </div>

      <TokenHeader />

      <div className="max-w-6xl mx-auto w-full">
        <TokenHero />
        <TokenBriefing />
        <TokenLive />
        <TokenHowItWorks />
        <TokenRoadmap />

        <footer className="px-4 md:px-12 py-6 md:py-8 border-t border-white/[0.05] flex flex-wrap items-center justify-between gap-4">
        <div className="font-mono text-[11px] text-white/30 tracking-wider">
          © 2026 Panorama Block · multisig 0xa3F4…91dE verified · UCLA × São Paulo × Zurich
        </div>
        <nav className="font-mono text-[11px] text-white/30 tracking-wider flex gap-5">
          <a
            href="https://docs.panoramablock.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/60 transition-colors"
          >
            Docs
          </a>
          <span className="hover:text-white/60 transition-colors cursor-pointer">Audit</span>
          <a
            href="https://t.me/panoramablock"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/60 transition-colors"
          >
            Telegram
          </a>
          <span className="hover:text-white/60 transition-colors cursor-pointer">Risk disclosure</span>
        </nav>
      </footer>
      </div>
    </div>
  )
}

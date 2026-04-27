import Image from 'next/image'
import Link from 'next/link'
import { PresaleWidget } from './PresaleWidget'
import { HowItWorks } from './HowItWorks'
import logo from '../../../public/panorama_block.svg'

export function TokenPage() {
  return (
    <div className="min-h-screen bg-[#050B12] text-white">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <Link href="/landing" className="flex-shrink-0">
          <Image src={logo} alt="Panorama Block" width={120} height={90} />
        </Link>

        <nav className="flex items-center gap-5 text-sm">
          <a
            href="#how-it-works"
            className="text-white/40 hover:text-white transition-colors hidden sm:block"
          >
            How it works
          </a>
          <a
            href="https://docs.panoramablock.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/40 hover:text-white transition-colors hidden sm:block"
          >
            Docs
          </a>
          <a
            href="https://t.me/panoramablock"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-pano-primary/30 text-pano-text-accent hover:bg-pano-primary/10 transition-colors text-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.247l-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L6.51 14.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.836.968z" />
            </svg>
            Telegram
          </a>
        </nav>
      </header>

      {/* ── Hero copy ── */}
      <div className="text-center pt-8 pb-10 px-4">
        <p className="text-[11px] text-pano-text-accent uppercase tracking-[0.2em] mb-3">
          Seed Round · Live Now
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-black text-white tracking-tight mb-3 leading-tight">
          Own a piece of{' '}
          <span className="text-pano-text-accent">Panorama Block</span>
        </h1>
        <p className="text-white/40 text-base max-w-md mx-auto leading-relaxed">
          The AI-first DeFi platform built for Telegram's 950M+ users.
          Participate in the seed round before the public listing.
        </p>
      </div>

      {/* ── Presale Widget ── */}
      <div className="px-4 pb-10">
        <PresaleWidget />
      </div>

      {/* ── How It Works ── */}
      <HowItWorks />

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.05] mt-4 py-8 px-6 text-center">
        <p className="text-white/20 text-xs leading-relaxed">
          © {new Date().getFullYear()} Panorama Block ·{' '}
          This is not financial advice. Participation involves risk.{' '}
          <a href="#" className="underline underline-offset-2 hover:text-white/40 transition-colors">
            Terms
          </a>
          {' · '}
          <a
            href="https://docs.panoramablock.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-white/40 transition-colors"
          >
            Docs
          </a>
        </p>
      </footer>
    </div>
  )
}

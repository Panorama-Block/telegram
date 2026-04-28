'use client'

import Image from 'next/image'
import logo from '../../../public/panorama_block.svg'

const NAV = [
  { label: 'Overview',    anchor: '#overview'    },
  { label: 'About',       anchor: '#about'       },
  { label: 'How It Works',anchor: '#how-it-works'},
  { label: 'Roadmap',     anchor: '#roadmap'     },
] as const

function handleSmoothScroll(e: React.MouseEvent<HTMLAnchorElement>, targetId: string) {
  e.preventDefault()
  const el = document.querySelector(targetId)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function TokenHeader() {
  return (
    <header className="w-full border-b border-white/[0.04]">
      {/* Main bar */}
      <div className="relative flex items-center px-4 md:px-12 py-6 md:py-4 w-full">

        {/* Left: logo */}
        <div className="w-fit hidden md:block">
          <Image src={logo} alt="Panorama Block" className="w-[80px] md:w-auto" width={140} height={105} />
        </div>

        {/* Center: nav — absolutely centered */}
        <nav className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-4 md:gap-8 text-base md:text-lg text-white/60">
          {NAV.map(({ label, anchor }) => (
            <a
              key={label}
              href={anchor}
              onClick={(e) => handleSmoothScroll(e, anchor)}
              className="hover:text-white transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>

      </div>

      {/* Mobile-only: scrollable nav row */}
      <nav className="lg:hidden flex items-center gap-1 px-4 pb-3 overflow-x-auto scrollbar-hide">
        {NAV.map(({ label, anchor }) => (
          <a
            key={label}
            href={anchor}
            onClick={(e) => handleSmoothScroll(e, anchor)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-sm text-white/60 hover:text-white border border-white/[0.08] hover:border-white/20 transition-colors whitespace-nowrap"
          >
            {label}
          </a>
        ))}
      </nav>
    </header>
  )
}

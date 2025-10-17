'use client'

import Image from 'next/image'
import logo from '../../../../public/panorama_block.svg'

const Header = () => {
  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault()
    const element = document.querySelector(targetId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <header className='relative flex items-center px-4 md:px-12 py-6 md:py-4 w-full'>
      {/* Left: brand */}
      <div className="w-fit hidden md:block">
        <Image src={logo} alt="Panorama Block Logo" className='w-[80px] md:w-auto' width={140} height={105} />
      </div>

      {/* Center: absolute to guarantee perfect centering regardless of left content width */}
      <nav className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 flex items-center gap-4 md:gap-8 text-base md:text-lg text-landing-text">
        <a href="#about" onClick={(e) => handleSmoothScroll(e, '#about')} className="hover:text-white transition-colors">About</a>
        <a href="#vision" onClick={(e) => handleSmoothScroll(e, '#vision')} className="hover:text-white transition-colors">Vision</a>
        <a href="#roadmap" onClick={(e) => handleSmoothScroll(e, '#roadmap')} className="hover:text-white transition-colors">Roadmap</a>
        <a href="#resources" onClick={(e) => handleSmoothScroll(e, '#resources')} className="hover:text-white transition-colors">Resources</a>
      </nav>

      {/* Right spacer (keeps header height consistent and allows future CTA) */}
      <div className="ml-auto hidden md:block w-[140px]" aria-hidden />
    </header>
  )
}

export default Header

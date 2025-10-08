import Image from 'next/image'
import logo from '../../../../public/new-logo.png'

const Header = () => {
  return (
    <header className='flex items-center px-4 md:px-12 py-8 w-full'>
      <div className="w-fit">
        <Image src={logo} alt="Panorama Block Logo" className='w-[80px] md:w-auto' width={140} height={105} />
      </div>
      <div className="flex-1 flex justify-center gap-3 md:gap-8 text-sm sm:text-base sm:mr-12 md:mr-24 md:text-lg text-landing-text">
        <a href="#about" className="hover:text-cyan-600 transition-colors">About</a>
        <a href="#vision" className="hover:text-cyan-600 transition-colors">Vision</a>
        <a href="#roadmap" className="hover:text-cyan-600 transition-colors">Roadmap</a>
        <a href="#resources" className="hover:text-cyan-600 transition-colors">Resources</a>
      </div>
    </header>
  )
}

export default Header

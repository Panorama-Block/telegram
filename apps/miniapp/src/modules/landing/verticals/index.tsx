import Image from 'next/image'
import vertical1 from '../../../../public/landing/verticals/1.svg'
import vertical2 from '../../../../public/landing/verticals/2.svg'
import vertical3 from '../../../../public/landing/verticals/3.svg'

const Verticals = () => {
  return (
    <div id="vision" className="relative flex flex-col gap-4 md:gap-8 mt-8 md:mt-20 overflow-hidden">
      {/* Animated background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-landing-highlight/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-landing-primary/20 rounded-full blur-3xl" />
      </div>

      <h2 className="relative text-landing-title text-3xl lg:text-5xl text-center z-10 font-sans">Our Verticals</h2>
      <div className="relative py-4 md:py-8 mt-4 md:mt-8 z-10">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 px-4 md:px-12 lg:px-16 xl:px-20 justify-center items-center max-w-[1400px] mx-auto">
          <Image src={vertical1} alt="" className="rounded-[20px] object-cover w-full md:w-auto md:max-w-[400px] lg:max-w-[450px]" width={550} height={550} />
          <Image src={vertical2} alt="" className="rounded-[20px] object-cover w-full md:w-auto md:max-w-[400px] lg:max-w-[450px]" width={550} height={550} />
          <Image src={vertical3} alt="" className="rounded-[20px] object-cover w-full md:w-auto md:max-w-[400px] lg:max-w-[450px]" width={550} height={550} />
        </div>
      </div>
    </div>
  )
}

export default Verticals

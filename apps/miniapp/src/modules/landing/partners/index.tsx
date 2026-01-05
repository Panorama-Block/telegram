import Image from 'next/image'
import icp from '../../../../public/landing/partners/icp.svg'
import xrp from '../../../../public/landing/partners/xrp.svg'
import chainlink from '../../../../public/landing/partners/chainlink.svg'
import avax from '../../../../public/landing/partners/avax.svg'
import stacks from '../../../../public/landing/partners/stacks.svg'
import morpheus from '../../../../public/landing/partners/morpheus.svg'
import inteli from '../../../../public/landing/partners/inteli.svg'
import lmu from '../../../../public/landing/partners/lmu.svg'
import uniswap from '../../../../public/landing/partners/uniswap.svg'

const images = [
  { src: icp, alt: 'Internet Computer' },
  { src: xrp, alt: 'XRP' },
  { src: chainlink, alt: 'Chainlink' },
  { src: avax, alt: 'Avalanche' },
  { src: stacks, alt: 'Stacks' },
  { src: morpheus, alt: 'Morpheus' },
  { src: inteli, alt: 'Inteli' },
  { src: lmu, alt: 'LMU' },
  { src: uniswap, alt: 'Uniswap' },
]

const Partners = () => {
  return (
    <div className="mt-16 md:mt-32 lg:mt-40">
      <h2 className="text-landing-title text-center text-2xl lg:text-3xl lg:text-4xl px-14 mb-4 md:mb-8 font-sans">Proudly Colaborating with:</h2>
      <div className="relative flex overflow-x-hidden">
        <div className="animate-marquee whitespace-nowrap flex my-8 gap-16 pr-16">
          {images.map((image, index) => (
            <div key={index} className="flex items-center justify-center w-[180px] h-24">
              <Image src={image.src} alt={image.alt} className="max-h-20 sm:max-h-32 lg:max-h-24 w-auto object-contain" width={180} height={96} />
            </div>
          ))}
          {images.map((image, index) => (
            <div key={`second-${index}`} className="flex items-center justify-center w-[180px] h-24">
              <Image src={image.src} alt={image.alt} className="max-h-20 sm:max-h-32 lg:max-h-24 w-auto object-contain" width={180} height={96} />
            </div>
          ))}
        </div>

        <div className="absolute top-0 animate-marquee2 whitespace-nowrap flex my-8 gap-16 pr-16">
          {images.map((image, index) => (
            <div key={`second-${index}`} className="flex items-center justify-center w-[180px] h-24">
              <Image src={image.src} alt={image.alt} className="max-h-20 sm:max-h-32 lg:max-h-24 w-auto object-contain" width={180} height={96} />
            </div>
          ))}
          {images.map((image, index) => (
            <div key={`third-${index}`} className="flex items-center justify-center w-[180px] h-24">
              <Image src={image.src} alt={image.alt} className="max-h-20 sm:max-h-32 lg:max-h-24 w-auto object-contain" width={180} height={96} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Partners

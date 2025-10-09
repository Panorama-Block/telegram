import Image from 'next/image'
import icp from '../../../../public/landing/partners/icp.svg'
import xrp from '../../../../public/landing/partners/xrp.svg'
import chainlink from '../../../../public/landing/partners/chainlink.svg'
import avax from '../../../../public/landing/partners/avax.svg'
import stacks from '../../../../public/landing/partners/stacks.svg'
import morpheus from '../../../../public/landing/partners/morpheus.svg'
import inteli from '../../../../public/landing/partners/inteli.svg'
import uclaBlockchain from '../../../../public/landing/partners/ucla.svg'
import lmu from '../../../../public/landing/partners/lmu.svg'

const images = [
  { src: icp, alt: 'Internet Computer' },
  { src: xrp, alt: 'XRP' },
  { src: chainlink, alt: 'Chainlink' },
  { src: avax, alt: 'Avalanche' },
  { src: stacks, alt: 'Stacks' },
  { src: morpheus, alt: 'Morpheus' },
  { src: inteli, alt: 'Inteli' },
  { src: uclaBlockchain, alt: 'UCLA Blockchain' },
  { src: lmu, alt: 'LMU' },
]

const Partners = () => {
  return (
    <div className="mt-32 lg:mt-40">
      <h2 className="text-landing-title text-center text-2xl lg:text-3xl lg:text-4xl px-14 mb-8">Proudly Colaborating with:</h2>
      <div className="relative flex overflow-x-hidden">
        <div className="animate-marquee whitespace-nowrap flex my-8 gap-16 pr-16">
          {images.map((image, index) => (
            <div key={index} className="min-w-[150px]">
              <Image src={image.src} alt={image.alt} className="h-20 sm:h-32 lg:h-24 w-auto object-contain" width={150} height={96} />
            </div>
          ))}
          {images.map((image, index) => (
            <div key={`second-${index}`} className="min-w-[150px]">
              <Image src={image.src} alt={image.alt} className="h-20 sm:h-32 lg:h-24 w-auto object-contain" width={150} height={96} />
            </div>
          ))}
        </div>

        <div className="absolute top-0 animate-marquee2 whitespace-nowrap flex my-8 gap-16 pr-16">
          {images.map((image, index) => (
            <div key={`second-${index}`} className="min-w-[150px]">
              <Image src={image.src} alt={image.alt} className="h-20 sm:h-32 lg:h-24 w-auto object-contain" width={150} height={96} />
            </div>
          ))}
          {images.map((image, index) => (
            <div key={`third-${index}`} className="min-w-[150px]">
              <Image src={image.src} alt={image.alt} className="h-20 sm:h-32 lg:h-24 w-auto object-contain" width={150} height={96} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Partners

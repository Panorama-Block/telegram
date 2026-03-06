import Image from 'next/image'
import icp from '../../../../public/landing/partners/icp.svg'
import xrp from '../../../../public/landing/partners/xrp.svg'
import chainlink from '../../../../public/landing/partners/chainlink.svg'
import avax from '../../../../public/landing/partners/avalanche.svg'
import stacks from '../../../../public/landing/partners/stacks.svg'
import morpheus from '../../../../public/landing/partners/morpheus.svg'
import inteli from '../../../../public/landing/partners/inteli.svg'
import lmu from '../../../../public/landing/partners/lmu.svg'
import uniswap from '../../../../public/landing/partners/uniswap.svg'
import mbtc from '../../../../public/landing/partners/m_btc.svg'
import ucla from '../../../../public/landing/partners/ucla.svg'

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
  { src: mbtc, alt: 'mBTC' },
  { src: ucla, alt: 'UCLA' },
]

const PartnerCard = ({ image }: { image: { src: any; alt: string; extraClass?: string } }) => (
  <div className="flex items-center justify-center w-[270px] h-36 transition-transform duration-300 ease-out hover:scale-110 hover:z-10 cursor-pointer">
    <Image src={image.src} alt={image.alt} className={`max-h-[120px] sm:max-h-[192px] lg:max-h-36 w-auto object-contain ${image.extraClass || ''}`} width={270} height={144} />
  </div>
)

const Partners = () => {
  return (
    <div className="mt-16 md:mt-32 lg:mt-40">
      <h2 className="text-landing-title text-center text-2xl lg:text-3xl lg:text-4xl px-14 mb-4 md:mb-8">Proudly Colaborating with:</h2>
      <div className="relative flex overflow-x-hidden group">
        <div className="animate-marquee group-hover:[animation-play-state:paused] whitespace-nowrap flex my-8 gap-16 pr-16">
          {images.map((image, index) => (
            <PartnerCard key={index} image={image} />
          ))}
          {images.map((image, index) => (
            <PartnerCard key={`second-${index}`} image={image} />
          ))}
        </div>

        <div className="absolute top-0 animate-marquee2 group-hover:[animation-play-state:paused] whitespace-nowrap flex my-8 gap-16 pr-16">
          {images.map((image, index) => (
            <PartnerCard key={`second-${index}`} image={image} />
          ))}
          {images.map((image, index) => (
            <PartnerCard key={`third-${index}`} image={image} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Partners

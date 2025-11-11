import Image from 'next/image'
import logo from '../../../../public/panorama_block.svg'

const Footer = () => {
  return (
    <footer id="resources" className="relative text-landing-text mt-32">
      <div className="border-t border-landing-border">
        {/* Main Footer Content */}
        <div className="flex flex-col md:flex-row py-12">
          {/* Logo Section - Left Side */}
          <div className="flex flex-col gap-6 px-6 md:px-8 lg:px-12 md:w-2/5 lg:w-1/2 mx-auto md:mx-0">
            <Image src={logo} alt="Panorama Block" width={140} height={105} className="mx-auto md:mx-0" />
            <p className="text-base text-landing-text leading-relaxed text-center md:text-left max-w-md">
               Building the future of cross-chain Agentic Yield Strategies
            </p>
          </div>

          {/* Contact Section */}
          <div className="relative flex flex-col gap-4 px-6 md:px-8 lg:px-12 mt-8 md:mt-0 md:w-1/5 mx-auto md:mx-0">
            <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-landing-border hidden md:block" />
            <h3 className="text-landing-title text-xl font-medium text-center md:text-left">Contact Us</h3>
            <ul className="flex flex-col gap-3 text-center md:text-left">
              <li>
                <a
                  href="mailto:info@panoramablock.com"
                  className="text-landing-text hover:text-landing-highlight transition-colors duration-200"
                >
                  info@panoramablock.com
                </a>
              </li>
            </ul>
          </div>

          {/* Resources Section */}
          <div className="relative flex flex-col gap-4 px-6 md:px-8 lg:px-12 mt-8 md:mt-0 md:w-1/5 lg:w-1/4 mx-auto md:mx-0">
            <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-landing-border hidden md:block" />
            <h3 className="text-landing-title text-xl font-medium text-center md:text-left">Resources</h3>
            <ul className="flex flex-col gap-3 text-center md:text-left">
              <li>
                <a
                  href="https://docs.panoramablock.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-landing-text hover:text-landing-highlight transition-colors duration-200"
                >
                  Documentation
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Panorama-Block"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-landing-text hover:text-landing-highlight transition-colors duration-200"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://linkedin.com/company/panoramablock"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-landing-text hover:text-landing-highlight transition-colors duration-200"
                >
                  LinkedIn
                </a>
              </li>
              <li>
                <a
                  href="https://x.com/panorama_block"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-landing-text hover:text-landing-highlight transition-colors duration-200"
                >
                  X
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright Bar */}
        <div className="border-t border-landing-border py-6 px-6 md:px-8 lg:px-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-landing-text">
              © {new Date().getFullYear()} Panorama Block. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm">
              <a href="#" className="text-landing-text hover:text-landing-highlight transition-colors duration-200">
                Privacy Policy
              </a>
              <a href="#" className="text-landing-text hover:text-landing-highlight transition-colors duration-200">
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer

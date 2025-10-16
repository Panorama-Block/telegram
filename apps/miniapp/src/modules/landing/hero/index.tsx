'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import zicoBlue from '../../../../public/icons/zico_blue.svg'
import AuthModal from '../auth-modal'
import Banner from '../banner'

const Hero = () => {
  const [currentWord, setCurrentWord] = useState(0)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

  const words = [
    'Composable DeFi Strategies',
    'Real-Time AI Analytics',
    'Specialized Crypto Agents',
    'Cross-Chain AI Automation',
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWord((prev) => (prev + 1) % words.length)
    }, 1800)
    return () => clearInterval(interval)
  }, [words.length])

  return (
    <div className="relative flex flex-col items-center justify-center h-full mt-6 md:mt-16">
      <h1 className="text-4xl lg:text-5xl 2xl:text-6xl text-landing-title w-[90%] md:w-full md:max-w-[1200px] mx-auto px-4 md:px-0">
        <span className="flex flex-col items-center gap-5 text-center">
          A Panoramic View of
          <span className="inline-block h-[1.2em]">
            <span key={words[currentWord]} className="inline-block animate-slideUpIn text-landing-highlight">
              {words[currentWord]}
            </span>
          </span>
          <div className="flex mx-auto w-fit h-8 mt-6" />
        </span>
      </h1>
      <span className="text-white text-xl mx-auto text-center w-[90%] md:max-w-[600px] mt-4 lg:mt-0">
        Fusing multi-chain data pipelines with AI reasoning frameworks to empower decentralized, composable financial automation.
      </span>

      <div className="flex flex-col items-center mx-auto w-fit mt-8 gap-8 z-50">
        <Button
          onClick={() => setIsAuthModalOpen(true)}
          className="min-w-[180px] h-14 rounded-[30px] bg-white text-black hover:bg-gray-100 text-lg font-semibold"
        >
          Launch App
        </Button>
      </div>

      {/* Prompt Banner */}
      <div className="w-full mt-12 mb-8">
        <Banner />
      </div>

      {/* Zico Blue Logo */}
      <div className="relative mt-8 mb-16">
        {/* Multiple layered blur effects for stronger glow */}
        <div className="absolute inset-0 bg-cyan-400/30 blur-3xl rounded-full animate-pulse" />
        <div className="absolute inset-0 bg-landing-highlight/20 blur-2xl rounded-full" style={{ animationDelay: '0.5s' }} />
        <div className="absolute -inset-4 bg-cyan-500/15 blur-3xl rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
        <Image
          src={zicoBlue}
          alt="Zico Blue"
          width={192}
          height={192}
          className="relative h-28 w-28 sm:h-32 sm:w-32 lg:h-40 lg:w-40"
        />
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  )
}

export default Hero

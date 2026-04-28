'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { useActiveWallet, useDisconnect } from 'thirdweb/react'
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb'
import zicoBlue from '../../../../public/icons/zico_blue.svg'
import Banner from '../banner'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap } from 'lucide-react'

const Hero = () => {
  const activeWallet = useActiveWallet()
  const { disconnect } = useDisconnect()
  const [currentWord, setCurrentWord] = useState(0)
  const [isLaunching, setIsLaunching] = useState(false)
  const [showSeedModal, setShowSeedModal] = useState(false)

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

  const handleLaunchApp = async () => {
    setIsLaunching(true)

    try {
      // 1. Disconnect wallet via Thirdweb (if connected)
      if (activeWallet) {
        try {
          await disconnect(activeWallet)
          console.log('[LaunchApp] Wallet disconnected')
        } catch (error) {
          console.warn('[LaunchApp] Wallet disconnect failed:', error)
        }
      }

      // 2. Clear ALL localStorage (only if 12h passed since last clear)
      if (typeof window !== 'undefined') {
        const now = Date.now()
        const lastClearKey = 'launchapp_last_clear_at'
        const lastClearRaw = localStorage.getItem(lastClearKey)
        const lastClearAt = lastClearRaw ? Number(lastClearRaw) : 0
        const twelveHoursMs = 12 * 60 * 60 * 1000
        const shouldClear = !lastClearAt || Number.isNaN(lastClearAt) || now - lastClearAt >= twelveHoursMs

        if (shouldClear) {
          // Application auth tokens
          const appKeys = [
            'authToken',
            'authPayload',
            'authSignature',
            'telegram_user',
            'userAddress',
          ]
          appKeys.forEach(key => localStorage.removeItem(key))

          // Thirdweb-specific keys
          const clientId = THIRDWEB_CLIENT_ID
          if (clientId) {
            const thirdwebKeys = [
              `walletToken-${clientId}`,
              `thirdwebEwsWalletToken-${clientId}`,
              `thirdweb_auth_token_${clientId}`,
              `thirdwebEwsWalletUserId-${clientId}`,
            ]
            thirdwebKeys.forEach(key => localStorage.removeItem(key))
          }
          localStorage.removeItem('thirdwebAuthToken')

          // Clear any residual thirdweb/wallet keys
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('thirdweb') || key.startsWith('walletToken')) {
              localStorage.removeItem(key)
            }
          })

          // Clear TON Connect keys
          Object.keys(localStorage).forEach(key => {
            const lower = key.toLowerCase()
            if (lower.startsWith('tonconnect') || lower.startsWith('ton-connect') || lower.includes('tonconnect')) {
              localStorage.removeItem(key)
            }
          })

          // 3. Clear sessionStorage completely
          Object.keys(sessionStorage).forEach(key => {
            sessionStorage.removeItem(key)
          })

          localStorage.setItem(lastClearKey, String(now))
          console.log('[LaunchApp] All storage cleared')
        } else {
          console.log('[LaunchApp] Storage clear skipped (within 12h window)')
        }
      }

      // 4. Small delay to ensure everything is cleared
      await new Promise(resolve => setTimeout(resolve, 150))

      // 5. Full page reload to /newchat (clears React state completely)
      const params = new URLSearchParams(window.location.search)
      const tma = params.get('tma')
      const nextUrl = tma ? `/miniapp/newchat?tma=${encodeURIComponent(tma)}` : '/miniapp/newchat'
      window.location.href = nextUrl

    } catch (error) {
      console.error('[LaunchApp] Error:', error)
      // Even if something fails, force navigate
      const params = new URLSearchParams(window.location.search)
      const tma = params.get('tma')
      const nextUrl = tma ? `/miniapp/newchat?tma=${encodeURIComponent(tma)}` : '/miniapp/newchat'
      window.location.href = nextUrl
    }
  }

  return (
    <div className="relative flex flex-col items-center justify-center h-full mt-6 md:mt-16">
      <h1 className="text-4xl lg:text-5xl 2xl:text-6xl text-landing-title w-[90%] md:w-full md:max-w-[1200px] mx-auto px-4 md:px-0">
        <span className="flex flex-col items-center gap-5 text-center font-display tracking-tight">
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
          onClick={() => setShowSeedModal(true)}
          disabled={isLaunching}
          className="min-w-[180px] h-14 rounded-[30px] bg-white text-black hover:bg-gray-100 text-lg font-semibold disabled:opacity-70 disabled:cursor-wait"
        >
          {isLaunching ? 'Loading...' : 'Launch App'}
        </Button>
      </div>

      {/* Seed Round Awareness Modal */}
      <AnimatePresence>
        {showSeedModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowSeedModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-x-6 top-1/2 -translate-y-1/2 z-50 sm:inset-x-0 sm:flex sm:items-center sm:justify-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-full max-w-sm mx-auto bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-400/10 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">$PANBLK Seed Round</h2>
                      <p className="text-xs text-zinc-500 mt-0.5 font-mono">Live now · Limited allocation</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSeedModal(false)}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Panorama Block is running its <span className="text-white font-semibold">$PANBLK Seed Round</span>. Early supporters can acquire tokens at <span className="text-cyan-400 font-mono font-semibold">$0.025</span> — a{' '}
                    <span className="text-cyan-400 font-semibold">3.2×</span> discount to the <span className="text-white">$0.08 listing price</span>.
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ['Seed price', '$0.025'],
                      ['At listing', '$0.08'],
                      ['Upside', '+220%'],
                    ] as [string, string][]).map(([label, value]) => (
                      <div key={label} className="bg-zinc-900/60 border border-white/5 rounded-xl px-3 py-2.5 text-center">
                        <div className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-1">{label}</div>
                        <div className="font-mono text-sm font-bold text-cyan-400">{value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-cyan-400/5 border border-cyan-400/15 rounded-xl px-4 py-3">
                    <p className="text-xs text-cyan-300/70 leading-relaxed text-center font-mono">
                      Allocation is manual and reviewed — no payment needed now. Submit your interest and our team reaches out within 24h.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      onClick={() => { window.location.href = '/miniapp/token' }}
                      className="w-full h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 text-black font-bold text-sm tracking-wide transition-all hover:brightness-110 active:scale-[0.99]"
                      style={{ boxShadow: '0 6px 24px rgba(34,211,238,0.3)' }}
                    >
                      View Seed Round →
                    </button>
                    <button
                      onClick={() => { setShowSeedModal(false); handleLaunchApp() }}
                      disabled={isLaunching}
                      className="w-full h-10 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-all text-sm font-medium disabled:opacity-50"
                    >
                      {isLaunching ? 'Loading…' : 'Continue to App'}
                    </button>
                  </div>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
    </div>
  )
}

export default Hero

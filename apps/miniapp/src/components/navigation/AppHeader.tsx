'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useActiveAccount } from 'thirdweb/react'
import { useLogout } from '@/shared/hooks/useLogout'
import { cn } from '@/shared/lib/utils'
import logo from '../../../public/panorama_block.svg'

const NAV_LINKS = [
  { label: 'Home', href: '/chat' },
  { label: 'Swap', href: '/swap' },
  { label: 'Lending', href: '/lending' },
  { label: 'Staking', href: '/staking' },
  { label: 'DCA', href: '/dca' },
  { label: 'Docs', href: 'https://docs.panoramablock.com', external: true }
]

interface AppHeaderProps {
  className?: string
  onMenuClick?: () => void
  showMenuButton?: boolean
}

export function AppHeader({ className, onMenuClick, showMenuButton = true }: AppHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const account = useActiveAccount()
  const { logout, isLoggingOut } = useLogout()
  const [walletOpen, setWalletOpen] = useState(false)

  const handleDisconnect = () => {
    setWalletOpen(false)
    logout()
  }

  const shortAddress = account?.address
    ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
    : null

  const handleNav = (href: string, external?: boolean) => {
    if (external) {
      window.open(href, '_blank')
      return
    }
    router.push(href)
  }

  const isActive = (href: string) => {
    if (href === '/chat' && pathname === '/') return true
    if (href === '/chat') return pathname.startsWith('/chat') || pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <header className={cn(
      'sticky top-0 z-50 bg-pano-surface/80 backdrop-blur-md border-b border-pano-border safe-area-pt',
      className
    )}>
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {showMenuButton && (
            <button
              onClick={onMenuClick}
              className="lg:hidden text-pano-text-secondary hover:text-pano-text-primary rounded-md p-2 border border-transparent hover:border-pano-border-subtle"
              aria-label="Open navigation"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}

          <button
            className="flex items-center gap-2"
            onClick={() => handleNav('/chat')}
            aria-label="Go to Assistant"
          >
            <Image src={logo} alt="Panorama Block" width={32} height={32} className="h-8 w-auto" />
            <span className="hidden md:inline text-sm font-semibold tracking-wide text-pano-text-primary">PANORAMA BLOCK</span>
          </button>
        </div>

        <nav className="hidden lg:flex items-center gap-5 text-sm">
          {NAV_LINKS.map((link) => (
            <button
              key={link.href}
              onClick={() => handleNav(link.href, link.external)}
              className={cn(
                'px-2 py-1 text-pano-text-secondary hover:text-pano-text-primary transition-colors relative',
                isActive(link.href) && 'text-pano-text-primary'
              )}
            >
              {link.label}
              {isActive(link.href) && (
                <span className="absolute left-1/2 -bottom-1 h-[2px] w-6 -translate-x-1/2 bg-pano-text-primary rounded-full" />
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            className="hidden sm:flex w-10 h-10 items-center justify-center rounded-lg border border-pano-border text-pano-text-secondary hover:text-pano-text-primary hover:border-pano-border-subtle transition-colors"
            aria-label="Notifications"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-current" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>

          <div className="relative">
            <button
              onClick={() => setWalletOpen(!walletOpen)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-pano-border bg-pano-surface-elevated/50 text-sm text-pano-text-primary hover:border-pano-border-subtle transition-colors"
              aria-label="Wallet menu"
            >
              <span className="w-2 h-2 rounded-full bg-pano-primary"></span>
              <span className="font-mono">
                {shortAddress ?? 'Connect wallet'}
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {walletOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setWalletOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-pano-surface border border-pano-border rounded-xl shadow-lg z-20 overflow-hidden">
                  <button
                    onClick={() => { setWalletOpen(false); router.push('/account') }}
                    className="w-full text-left px-4 py-3 text-sm text-pano-text-primary hover:bg-pano-surface-elevated/70 transition-colors"
                  >
                    Profile
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={isLoggingOut}
                    className="w-full text-left px-4 py-3 text-sm text-pano-error hover:bg-pano-error/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoggingOut ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default AppHeader

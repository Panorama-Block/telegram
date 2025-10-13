'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/shared/lib/utils'
import { usePWA } from '@/hooks/usePWA'

interface PWAInstallPromptProps {
  className?: string
  variant?: 'banner' | 'modal' | 'inline'
  showOnMobile?: boolean
  showOnDesktop?: boolean
  autoShow?: boolean
  delay?: number
}

export function PWAInstallPrompt({
  className,
  variant = 'banner',
  showOnMobile = true,
  showOnDesktop = true,
  autoShow = true,
  delay = 3000
}: PWAInstallPromptProps) {
  const { isInstallable, isInstalled, install } = usePWA()
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    // Check if previously dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed) {
      setIsDismissed(true)
      return
    }

    // Auto show with delay
    if (autoShow && isInstallable && !isInstalled) {
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, delay)

      return () => {
        clearTimeout(timer)
        window.removeEventListener('resize', checkMobile)
      }
    }

    return () => {
      window.removeEventListener('resize', checkMobile)
    }
  }, [autoShow, delay, isInstallable, isInstalled])

  const handleInstall = async () => {
    try {
      await install()
      setIsVisible(false)
    } catch (error) {
      console.error('Installation failed:', error)
    }
  }

  const handleDismiss = () => {
    setIsVisible(false)
    setIsDismissed(true)
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  // Don't show if not installable, already installed, dismissed, or device type doesn't match
  if (!isInstallable || isInstalled || isDismissed || !isVisible) {
    return null
  }

  if ((isMobile && !showOnMobile) || (!isMobile && !showOnDesktop)) {
    return null
  }

  const BannerPrompt = () => (
    <div className={cn(
      'fixed top-0 left-0 right-0 z-50 bg-pano-primary text-pano-text-inverse p-4 shadow-lg transform transition-transform duration-300',
      'safe-area-pt',
      className
    )}>
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 18v1c0 .5-.5 1-1 1H8c-.5 0-1-.5-1-1v-1c0-.5.5-1 1-1h8c.5 0 1 .5 1 1zM17 5v9c0 .5-.5 1-1 1H8c-.5 0-1-.5-1-1V5c0-.5.5-1 1-1h8c.5 0 1 .5 1 1z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm">Install Panorama Block</p>
            <p className="text-xs opacity-90 truncate">Get faster access and work offline</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-white hover:bg-white/10"
          >
            Later
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleInstall}
            className="bg-white text-pano-primary hover:bg-white/90"
          >
            Install
          </Button>
        </div>
      </div>
    </div>
  )

  const ModalPrompt = () => (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <Card variant="glass" className="max-w-md w-full mx-auto">
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-pano-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 18v1c0 .5-.5 1-1 1H8c-.5 0-1-.5-1-1v-1c0-.5.5-1 1-1h8c.5 0 1 .5 1 1zM17 5v9c0 .5-.5 1-1 1H8c-.5 0-1-.5-1-1V5c0-.5.5-1 1-1h8c.5 0 1 .5 1 1z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-pano-text-primary mb-2">
            Install Panorama Block
          </h3>
          <p className="text-sm text-pano-text-secondary mb-6">
            Install our app for faster access, offline support, and a native app experience on your device.
          </p>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={handleDismiss}
              className="flex-1"
            >
              Not now
            </Button>
            <Button
              variant="primary"
              onClick={handleInstall}
              className="flex-1"
            >
              Install App
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )

  const InlinePrompt = () => (
    <Card variant="elevated" className={cn('p-4', className)}>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-pano-primary rounded-xl flex items-center justify-center shrink-0">
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 18v1c0 .5-.5 1-1 1H8c-.5 0-1-.5-1-1v-1c0-.5.5-1 1-1h8c.5 0 1 .5 1 1zM17 5v9c0 .5-.5 1-1 1H8c-.5 0-1-.5-1-1V5c0-.5.5-1 1-1h8c.5 0 1 .5 1 1z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-pano-text-primary mb-1">
            Install as App
          </h4>
          <p className="text-sm text-pano-text-secondary">
            Get offline access and native performance
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            Dismiss
          </Button>
          <Button variant="primary" size="sm" onClick={handleInstall}>
            Install
          </Button>
        </div>
      </div>
    </Card>
  )

  switch (variant) {
    case 'banner':
      return <BannerPrompt />
    case 'modal':
      return <ModalPrompt />
    case 'inline':
      return <InlinePrompt />
    default:
      return <BannerPrompt />
  }
}

// Hook to manually trigger install prompt
export function useInstallPrompt() {
  const { isInstallable, install } = usePWA()

  const showInstallPrompt = () => {
    if (isInstallable) {
      install()
    } else {
      console.warn('PWA install not available')
    }
  }

  return {
    isInstallable,
    showInstallPrompt
  }
}
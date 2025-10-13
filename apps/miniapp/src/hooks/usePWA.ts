'use client'

import { useEffect, useState, useCallback } from 'react'

export interface PWAState {
  isInstallable: boolean
  isInstalled: boolean
  isOffline: boolean
  isUpdateAvailable: boolean
  installingUpdate: boolean
  cacheSize: number
}

export interface PWAActions {
  install: () => Promise<void>
  updateApp: () => Promise<void>
  clearCache: () => Promise<void>
  getCacheSize: () => Promise<number>
  showInstallPrompt: () => void
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

export function usePWA(): PWAState & PWAActions {
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false)
  const [installingUpdate, setInstallingUpdate] = useState(false)
  const [cacheSize, setCacheSize] = useState(0)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  // Check if app is installed
  const checkIfInstalled = useCallback(() => {
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      const isInWebAppiOS = (window.navigator as any).standalone === true
      const isAndroidApp = document.referrer.includes('android-app://')

      setIsInstalled(isStandalone || isInWebAppiOS || isAndroidApp)
    }
  }, [])

  // Check online/offline status
  const checkOnlineStatus = useCallback(() => {
    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine)
    }
  }, [])

  // Get cache size
  const getCacheSize = useCallback(async (): Promise<number> => {
    if ('serviceWorker' in navigator) {
      const controller = navigator.serviceWorker.controller
      if (controller) {
        return new Promise((resolve) => {
          const channel = new MessageChannel()
          channel.port1.onmessage = (event) => {
            const size = event.data?.cacheSize || 0
            setCacheSize(size)
            resolve(size)
          }

          controller.postMessage(
            { type: 'GET_CACHE_SIZE' },
            [channel.port2]
          )
        })
      }
    }
    return 0
  }, [])

  // Install PWA
  const install = useCallback(async () => {
    if (!deferredPrompt) {
      console.warn('PWA install prompt not available')
      return
    }

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        console.log('PWA installed successfully')
        setIsInstalled(true)
        setIsInstallable(false)
      } else {
        console.log('PWA installation declined')
      }

      setDeferredPrompt(null)
    } catch (error) {
      console.error('PWA installation failed:', error)
    }
  }, [deferredPrompt])

  // Update app
  const updateApp = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return

    try {
      setInstallingUpdate(true)
      const registration = await navigator.serviceWorker.getRegistration()

      if (registration?.waiting) {
        // Tell the waiting SW to skip waiting and become active
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })

        // Wait for the new SW to take control
        await new Promise<void>((resolve) => {
          const handleControllerChange = () => {
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
            resolve()
          }
          navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
        })

        // Reload the page to use the new SW
        window.location.reload()
      } else {
        // Check for updates
        await registration?.update()
      }
    } catch (error) {
      console.error('App update failed:', error)
    } finally {
      setInstallingUpdate(false)
      setIsUpdateAvailable(false)
    }
  }, [])

  // Clear cache
  const clearCache = useCallback(async () => {
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys()
        await Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        )
        setCacheSize(0)
        console.log('Cache cleared successfully')
      } catch (error) {
        console.error('Failed to clear cache:', error)
      }
    }
  }, [])

  // Show install prompt
  const showInstallPrompt = useCallback(() => {
    if (deferredPrompt) {
      install()
    } else {
      console.log('Install prompt not available')
    }
  }, [deferredPrompt, install])

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Initial checks
    checkIfInstalled()
    checkOnlineStatus()
    getCacheSize()

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      const promptEvent = e as BeforeInstallPromptEvent
      setDeferredPrompt(promptEvent)
      setIsInstallable(true)
      console.log('PWA install prompt ready')
    }

    // Listen for app installed
    const handleAppInstalled = () => {
      console.log('PWA installed')
      setIsInstalled(true)
      setIsInstallable(false)
      setDeferredPrompt(null)
    }

    // Listen for online/offline changes
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    // Service Worker registration and update detection
    const registerServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
            updateViaCache: 'none'
          })

          console.log('Service Worker registered successfully')

          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('New app version available')
                  setIsUpdateAvailable(true)
                }
              })
            }
          })

          // Check for updates every 30 minutes
          setInterval(() => {
            registration.update()
          }, 30 * 60 * 1000)

        } catch (error) {
          console.error('Service Worker registration failed:', error)
        }
      }
    }

    // Add event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Register service worker
    registerServiceWorker()

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [checkIfInstalled, checkOnlineStatus, getCacheSize])

  return {
    // State
    isInstallable,
    isInstalled,
    isOffline,
    isUpdateAvailable,
    installingUpdate,
    cacheSize,
    // Actions
    install,
    updateApp,
    clearCache,
    getCacheSize,
    showInstallPrompt
  }
}

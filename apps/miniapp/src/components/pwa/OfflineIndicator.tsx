'use client'

import React from 'react'
import { cn } from '@/shared/lib/utils'
import { usePWA } from '@/hooks/usePWA'

interface OfflineIndicatorProps {
  className?: string
  variant?: 'banner' | 'badge' | 'toast'
  position?: 'top' | 'bottom'
  showOnlineStatus?: boolean
}

export function OfflineIndicator({
  className,
  variant = 'banner',
  position = 'top',
  showOnlineStatus = false
}: OfflineIndicatorProps) {
  const { isOffline } = usePWA()
  const [wasOffline, setWasOffline] = React.useState(false)
  const [showOnlineMessage, setShowOnlineMessage] = React.useState(false)

  React.useEffect(() => {
    if (isOffline) {
      setWasOffline(true)
    } else if (wasOffline && !isOffline && showOnlineStatus) {
      setShowOnlineMessage(true)
      const timer = setTimeout(() => {
        setShowOnlineMessage(false)
        setWasOffline(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isOffline, wasOffline, showOnlineStatus])

  if (!isOffline && !showOnlineMessage) {
    return null
  }

  const BannerIndicator = () => (
    <div className={cn(
      'fixed left-0 right-0 z-50 transform transition-all duration-300',
      position === 'top' ? 'top-0 safe-area-pt' : 'bottom-0 safe-area-pb',
      isOffline ? 'bg-pano-warning text-pano-text-inverse' : 'bg-pano-success text-pano-text-inverse',
      className
    )}>
      <div className="px-4 py-2 text-center">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-2">
          {isOffline ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-12.728 12.728m0-12.728l12.728 12.728" />
              </svg>
              <span className="text-sm font-medium">
                You&apos;re offline - Some features may be limited
              </span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium">
                You&apos;re back online
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )

  const BadgeIndicator = () => (
    <div className={cn(
      'fixed z-50 px-3 py-1 rounded-full text-xs font-medium shadow-lg transform transition-all duration-300',
      position === 'top' ? 'top-4 right-4 safe-area-pt' : 'bottom-4 right-4 safe-area-pb',
      isOffline ? 'bg-pano-warning text-pano-text-inverse' : 'bg-pano-success text-pano-text-inverse',
      className
    )}>
      <div className="flex items-center gap-1">
        {isOffline ? (
          <>
            <div className="w-2 h-2 bg-current rounded-full animate-pulse"></div>
            <span>Offline</span>
          </>
        ) : (
          <>
            <div className="w-2 h-2 bg-current rounded-full"></div>
            <span>Online</span>
          </>
        )}
      </div>
    </div>
  )

  const ToastIndicator = () => (
    <div className={cn(
      'fixed left-4 right-4 z-50 max-w-sm mx-auto transform transition-all duration-300',
      position === 'top' ? 'top-4 safe-area-pt' : 'bottom-4 safe-area-pb',
      className
    )}>
      <div className={cn(
        'rounded-lg p-3 shadow-lg border',
        isOffline
          ? 'bg-pano-warning text-pano-text-inverse border-pano-warning/20'
          : 'bg-pano-success text-pano-text-inverse border-pano-success/20'
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
            isOffline ? 'bg-white/20' : 'bg-white/20'
          )}>
            {isOffline ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-12.728 12.728m0-12.728l12.728 12.728" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">
              {isOffline ? 'No Internet Connection' : 'Connection Restored'}
            </p>
            <p className="text-xs opacity-90">
              {isOffline
                ? 'You can still browse cached content'
                : 'All features are now available'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  switch (variant) {
    case 'banner':
      return <BannerIndicator />
    case 'badge':
      return <BadgeIndicator />
    case 'toast':
      return <ToastIndicator />
    default:
      return <BannerIndicator />
  }
}
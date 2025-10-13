'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/shared/lib/utils'
import { usePWA } from '@/hooks/usePWA'

interface PWAUpdateNotificationProps {
  className?: string
  variant?: 'toast' | 'banner' | 'modal'
  position?: 'top' | 'bottom'
  autoUpdate?: boolean
}

export function PWAUpdateNotification({
  className,
  variant = 'toast',
  position = 'bottom',
  autoUpdate = false
}: PWAUpdateNotificationProps) {
  const { isUpdateAvailable, installingUpdate, updateApp } = usePWA()

  // Auto update if enabled
  React.useEffect(() => {
    if (autoUpdate && isUpdateAvailable && !installingUpdate) {
      updateApp()
    }
  }, [autoUpdate, isUpdateAvailable, installingUpdate, updateApp])

  if (!isUpdateAvailable) {
    return null
  }

  const handleUpdate = () => {
    updateApp()
  }

  const ToastNotification = () => (
    <div className={cn(
      'fixed left-4 right-4 z-50 max-w-md mx-auto transform transition-all duration-300',
      position === 'top' ? 'top-4 safe-area-pt' : 'bottom-4 safe-area-pb',
      className
    )}>
      <Card variant="elevated" className="p-4 bg-pano-surface shadow-lg border border-pano-primary/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-pano-primary/10 rounded-lg flex items-center justify-center shrink-0">
            {installingUpdate ? (
              <svg className="w-5 h-5 text-pano-primary animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-pano-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-pano-text-primary text-sm">
              {installingUpdate ? 'Updating...' : 'Update Available'}
            </p>
            <p className="text-xs text-pano-text-secondary">
              {installingUpdate ? 'Installing latest version' : 'New features and improvements'}
            </p>
          </div>
          {!installingUpdate && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleUpdate}
              className="shrink-0"
            >
              Update
            </Button>
          )}
        </div>
      </Card>
    </div>
  )

  const BannerNotification = () => (
    <div className={cn(
      'fixed left-0 right-0 z-50 bg-pano-primary text-pano-text-inverse p-3 shadow-lg',
      position === 'top' ? 'top-0 safe-area-pt' : 'bottom-0 safe-area-pb',
      className
    )}>
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {installingUpdate ? (
            <svg className="w-5 h-5 animate-spin shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          )}
          <div className="min-w-0">
            <span className="font-medium text-sm">
              {installingUpdate ? 'Updating app...' : 'New version available'}
            </span>
            <span className="text-xs opacity-90 ml-2">
              {installingUpdate ? 'Please wait' : 'Tap to update'}
            </span>
          </div>
        </div>
        {!installingUpdate && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleUpdate}
            className="bg-white/20 text-white hover:bg-white/30 border-white/20 shrink-0"
          >
            Update Now
          </Button>
        )}
      </div>
    </div>
  )

  const ModalNotification = () => (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <Card variant="glass" className="max-w-sm w-full mx-auto">
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-pano-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            {installingUpdate ? (
              <svg className="w-8 h-8 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            )}
          </div>
          <h3 className="text-lg font-semibold text-pano-text-primary mb-2">
            {installingUpdate ? 'Updating App' : 'Update Available'}
          </h3>
          <p className="text-sm text-pano-text-secondary mb-6">
            {installingUpdate
              ? 'Please wait while we install the latest version with new features and improvements.'
              : 'A new version is available with performance improvements and new features.'
            }
          </p>
          {!installingUpdate && (
            <Button
              variant="primary"
              onClick={handleUpdate}
              className="w-full"
            >
              Update Now
            </Button>
          )}
          {installingUpdate && (
            <div className="flex items-center justify-center gap-2 text-pano-text-secondary">
              <div className="w-4 h-4 border-2 border-pano-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm">Installing update...</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  )

  switch (variant) {
    case 'toast':
      return <ToastNotification />
    case 'banner':
      return <BannerNotification />
    case 'modal':
      return <ModalNotification />
    default:
      return <ToastNotification />
  }
}
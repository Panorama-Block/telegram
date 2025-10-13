'use client'

import React from 'react'
import { cn } from '@/shared/lib/utils'

interface MobileLayoutProps {
  children: React.ReactNode
  className?: string
  header?: React.ReactNode
  footer?: React.ReactNode
  navigation?: React.ReactNode
  padding?: boolean
  fullHeight?: boolean
  safeArea?: boolean
}

export function MobileLayout({
  children,
  className,
  header,
  footer,
  navigation,
  padding = true,
  fullHeight = true,
  safeArea = true
}: MobileLayoutProps) {
  const hasHeader = Boolean(header)
  const hasNavigation = Boolean(navigation)

  return (
    <div className={cn(
      'flex flex-col bg-pano-bg-primary',
      fullHeight && 'min-h-screen',
      className
    )}>
      {/* Header */}
      {header}

      {/* Main Content */}
      <main className={cn(
        'flex-1 overflow-auto',
        padding && 'p-4',
        // Add padding for navigation when both header and nav are present
        hasHeader && hasNavigation && 'content-with-full-nav',
        // Add padding for header only
        hasHeader && !hasNavigation && 'content-with-header',
        // Add padding for navigation only
        !hasHeader && hasNavigation && 'content-with-nav'
      )}>
        {children}
      </main>

      {/* Footer */}
      {footer && (
        <footer className={cn(
          'bg-pano-surface border-t border-pano-border',
          safeArea && 'safe-area-pb'
        )}>
          {footer}
        </footer>
      )}

      {/* Bottom Navigation - positioned outside of main content flow */}
      {navigation}
    </div>
  )
}
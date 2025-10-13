'use client'

import React from 'react'
import { cn } from '@/shared/lib/utils'

interface AppLayoutProps {
  children: React.ReactNode
  className?: string
  variant?: 'mobile' | 'desktop' | 'adaptive'
  navigation?: React.ReactNode
  sidebar?: React.ReactNode
  header?: React.ReactNode
  footer?: React.ReactNode
  aside?: React.ReactNode
}

export function AppLayout({
  children,
  className,
  variant = 'adaptive',
  navigation,
  sidebar,
  header,
  footer,
  aside
}: AppLayoutProps) {
  const layoutClasses = {
    mobile: 'flex flex-col min-h-screen bg-pano-bg-primary',
    desktop: 'lg:layout-three-col min-h-screen bg-pano-bg-primary',
    adaptive: 'flex flex-col lg:layout-three-col min-h-screen bg-pano-bg-primary'
  }

  const contentClasses = {
    mobile: 'flex-1 flex flex-col',
    desktop: 'flex-1 flex flex-col overflow-hidden',
    adaptive: 'flex-1 flex flex-col lg:overflow-hidden'
  }

  return (
    <div className={cn(layoutClasses[variant], className)}>
      {/* Mobile Header */}
      {header && (
        <header className="lg:hidden sticky top-0 z-50 bg-pano-surface/95 backdrop-blur-md border-b border-pano-border">
          {header}
        </header>
      )}

      {/* Desktop Sidebar */}
      {sidebar && (
        <aside className="hidden lg:flex lg:flex-col lg:w-80 bg-pano-surface border-r border-pano-border">
          {sidebar}
        </aside>
      )}

      {/* Main Content Area */}
      <main className={cn(contentClasses[variant])}>
        {/* Desktop Header */}
        {header && (
          <header className="hidden lg:block sticky top-0 z-40 bg-pano-surface/95 backdrop-blur-md border-b border-pano-border">
            {header}
          </header>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>

      {/* Desktop Right Panel */}
      {aside && (
        <aside className="hidden lg:flex lg:flex-col lg:w-80 bg-pano-surface border-l border-pano-border">
          {aside}
        </aside>
      )}

      {/* Mobile Bottom Navigation */}
      {navigation && (
        <nav className="lg:hidden sticky bottom-0 z-50 bg-pano-surface/95 backdrop-blur-md border-t border-pano-border">
          {navigation}
        </nav>
      )}

      {/* Mobile Footer */}
      {footer && (
        <footer className="lg:hidden bg-pano-surface border-t border-pano-border">
          {footer}
        </footer>
      )}
    </div>
  )
}
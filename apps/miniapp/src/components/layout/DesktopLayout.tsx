'use client'

import React from 'react'
import { cn } from '@/shared/lib/utils'

interface DesktopLayoutProps {
  children: React.ReactNode
  className?: string
  sidebar?: React.ReactNode
  header?: React.ReactNode
  aside?: React.ReactNode
  sidebarWidth?: 'sm' | 'md' | 'lg' | 'xl'
  asideWidth?: 'sm' | 'md' | 'lg' | 'xl'
}

const sidebarWidths = {
  sm: 'w-64',
  md: 'w-80',
  lg: 'w-96',
  xl: 'w-[28rem]'
}

export function DesktopLayout({
  children,
  className,
  sidebar,
  header,
  aside,
  sidebarWidth = 'md',
  asideWidth = 'md'
}: DesktopLayoutProps) {
  const gridCols = sidebar && aside
    ? 'grid-cols-[auto_1fr_auto]'
    : sidebar
    ? 'grid-cols-[auto_1fr]'
    : aside
    ? 'grid-cols-[1fr_auto]'
    : 'grid-cols-1'

  return (
    <div className={cn(
      'hidden lg:grid min-h-screen bg-pano-bg-primary gap-0',
      gridCols,
      className
    )}>
      {/* Left Sidebar */}
      {sidebar && (
        <aside className={cn(
          'flex flex-col bg-pano-surface border-r border-pano-border',
          sidebarWidths[sidebarWidth]
        )}>
          {sidebar}
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex flex-col overflow-hidden">
        {/* Header */}
        {header && (
          <header className="sticky top-0 z-40 bg-pano-surface/95 backdrop-blur-md border-b border-pano-border">
            {header}
          </header>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>

      {/* Right Aside */}
      {aside && (
        <aside className={cn(
          'flex flex-col bg-pano-surface border-l border-pano-border',
          sidebarWidths[asideWidth]
        )}>
          {aside}
        </aside>
      )}
    </div>
  )
}
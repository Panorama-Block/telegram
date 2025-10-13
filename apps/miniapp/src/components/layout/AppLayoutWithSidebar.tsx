'use client';

import React from 'react';
import { cn } from '@/shared/lib/utils';
import { Sidebar, MobileSidebar, useSidebar } from '@/components/navigation/sidebar';
import { Button } from '@/components/ui/button';

interface AppLayoutWithSidebarProps {
  children: React.ReactNode;
  className?: string;
  showSidebar?: boolean;
  enableSidebarToggle?: boolean;
}

export function AppLayoutWithSidebar({
  children,
  className,
  showSidebar = true,
  enableSidebarToggle = true,
}: AppLayoutWithSidebarProps) {
  const { collapsed, mobileOpen, toggleCollapse, toggleMobile, closeMobile } = useSidebar();

  return (
    <div className={cn('min-h-screen bg-pano-bg-primary', className)}>
      {/* Desktop Sidebar */}
      {showSidebar && (
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={enableSidebarToggle ? toggleCollapse : undefined}
        />
      )}

      {/* Mobile Sidebar */}
      {showSidebar && (
        <MobileSidebar
          isOpen={mobileOpen}
          onClose={closeMobile}
        />
      )}

      {/* Main Content */}
      <div
        className={cn(
          'transition-all duration-300 ease-out',
          showSidebar && 'lg:ml-64',
          showSidebar && collapsed && 'lg:ml-16'
        )}
      >
        {/* Mobile Header */}
        <div className="lg:hidden sticky top-0 z-30 bg-pano-bg-primary/95 backdrop-blur-md border-b border-pano-border">
          <div className="flex items-center justify-between px-4 py-3">
            {showSidebar && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMobile}
                className="h-10 w-10 p-0"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </Button>
            )}

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pano-primary to-pano-secondary flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <h1 className="text-sm font-bold text-pano-text-primary">PanoramaBlock</h1>
              </div>
            </div>

            <div className="w-10" /> {/* Spacer for alignment */}
          </div>
        </div>

        {/* Content */}
        <div className="min-h-screen lg:min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}

// Enhanced Desktop Layout with integrated sidebar support
export function DesktopLayoutWithSidebar({
  children,
  className,
  showSidebar = true,
  aside,
  asideWidth = 'md',
}: {
  children: React.ReactNode;
  className?: string;
  showSidebar?: boolean;
  aside?: React.ReactNode;
  asideWidth?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const { collapsed } = useSidebar();

  const asideWidths = {
    sm: 'w-64',
    md: 'w-80',
    lg: 'w-96',
    xl: 'w-[28rem]'
  };

  return (
    <div className={cn(
      'hidden lg:flex min-h-screen bg-pano-bg-primary',
      className
    )}>
      {/* Sidebar */}
      {showSidebar && (
        <Sidebar collapsed={collapsed} />
      )}

      {/* Main Content */}
      <div className={cn(
        'flex-1 flex transition-all duration-300 ease-out',
        showSidebar && 'ml-64',
        showSidebar && collapsed && 'ml-16'
      )}>
        {/* Primary Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>

        {/* Right Aside */}
        {aside && (
          <aside className={cn(
            'flex flex-col bg-pano-surface border-l border-pano-border',
            asideWidths[asideWidth]
          )}>
            {aside}
          </aside>
        )}
      </div>
    </div>
  );
}

// Three Column Layout for Desktop
export function ThreeColumnLayout({
  children,
  leftAside,
  rightAside,
  className,
  leftWidth = 'md',
  rightWidth = 'md',
}: {
  children: React.ReactNode;
  leftAside?: React.ReactNode;
  rightAside?: React.ReactNode;
  className?: string;
  leftWidth?: 'sm' | 'md' | 'lg' | 'xl';
  rightWidth?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const sideWidths = {
    sm: 'w-64',
    md: 'w-80',
    lg: 'w-96',
    xl: 'w-[28rem]'
  };

  return (
    <div className={cn(
      'hidden lg:grid grid-cols-[auto_1fr_auto] min-h-screen bg-pano-bg-primary gap-0',
      className
    )}>
      {/* Left Aside */}
      {leftAside && (
        <aside className={cn(
          'flex flex-col bg-pano-surface border-r border-pano-border',
          sideWidths[leftWidth]
        )}>
          {leftAside}
        </aside>
      )}

      {/* Main Content */}
      <main className="flex flex-col overflow-hidden">
        {children}
      </main>

      {/* Right Aside */}
      {rightAside && (
        <aside className={cn(
          'flex flex-col bg-pano-surface border-l border-pano-border',
          sideWidths[rightWidth]
        )}>
          {rightAside}
        </aside>
      )}
    </div>
  );
}
'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/layout/Container'
import { cn } from '@/shared/lib/utils'

interface TopNavigationProps {
  title?: string
  subtitle?: string
  logo?: string
  showBack?: boolean
  showProfile?: boolean
  actions?: React.ReactNode
  className?: string
  variant?: 'default' | 'glass' | 'transparent'
  centered?: boolean
}

export function TopNavigation({
  title,
  subtitle,
  logo,
  showBack = false,
  showProfile = true,
  actions,
  className,
  variant = 'default',
  centered = false
}: TopNavigationProps) {
  const router = useRouter()

  const variantClasses = {
    default: 'bg-pano-surface border-b border-pano-border',
    glass: 'glass backdrop-blur-md border-b border-pano-border/30',
    transparent: 'bg-transparent'
  }

  const handleBack = () => {
    router.back()
  }

  const handleProfile = () => {
    router.push('/profile')
  }

  return (
    <header className={cn(
      'sticky top-0 z-40 safe-area-pt',
      variantClasses[variant],
      className
    )}>
      <Container>
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Left Section */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {showBack && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleBack}
                className="shrink-0"
                aria-label="Go back"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Button>
            )}

            {logo && !centered && (
              <Image
                src={logo}
                alt="Logo"
                width={120}
                height={32}
                className="h-6 sm:h-8 w-auto"
                priority
              />
            )}

            {!logo && !centered && (title || subtitle) && (
              <div className="min-w-0">
                {title && (
                  <h1 className="text-base sm:text-lg font-semibold text-pano-text-primary truncate">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="text-xs sm:text-sm text-pano-text-secondary truncate">
                    {subtitle}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Center Section */}
          {centered && (
            <div className="flex items-center justify-center flex-1">
              {logo ? (
                <Image
                  src={logo}
                  alt="Logo"
                  width={120}
                  height={32}
                  className="h-6 sm:h-8 w-auto"
                  priority
                />
              ) : (
                <div className="text-center">
                  {title && (
                    <h1 className="text-base sm:text-lg font-semibold text-pano-text-primary">
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <p className="text-xs sm:text-sm text-pano-text-secondary">
                      {subtitle}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Right Section */}
          <div className="flex items-center gap-2 shrink-0">
            {actions}

            {showProfile && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleProfile}
                className="shrink-0"
                aria-label="Open profile"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </Button>
            )}
          </div>
        </div>
      </Container>

      {/* Safe area top padding for devices with notches */}
      <div className="h-safe-area-inset-top bg-inherit" />
    </header>
  )
}

// Common action buttons
export const NotificationButton = ({ count = 0 }: { count?: number }) => (
  <Button
    variant="ghost"
    size="icon-sm"
    className="relative"
    aria-label={`Notifications${count > 0 ? ` (${count})` : ''}`}
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
    {count > 0 && (
      <div className="absolute -top-1 -right-1 min-w-4 h-4 bg-pano-error text-pano-text-inverse text-xs font-bold rounded-full flex items-center justify-center px-1">
        {count > 99 ? '99+' : count}
      </div>
    )}
  </Button>
)

export const SearchButton = ({ onClick }: { onClick?: () => void }) => (
  <Button
    variant="ghost"
    size="icon-sm"
    onClick={onClick}
    aria-label="Search"
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  </Button>
)

export const MenuButton = ({ onClick }: { onClick?: () => void }) => (
  <Button
    variant="ghost"
    size="icon-sm"
    onClick={onClick}
    aria-label="Menu"
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  </Button>
)
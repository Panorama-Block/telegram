'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/shared/lib/utils'

interface NavigationItem {
  key: string
  label: string
  icon: React.ReactNode
  activeIcon?: React.ReactNode
  href: string
  badge?: number | string
  disabled?: boolean
}

interface BottomNavigationProps {
  items: NavigationItem[]
  className?: string
  variant?: 'default' | 'glass' | 'elevated'
}

export function BottomNavigation({
  items,
  className,
  variant = 'default'
}: BottomNavigationProps) {
  const router = useRouter()
  const pathname = usePathname()

  const variantClasses = {
    default: 'bg-pano-surface border-t border-pano-border',
    glass: 'glass backdrop-blur-md border-t border-pano-border/30',
    elevated: 'bg-pano-surface shadow-lg border-t border-pano-border'
  }

  const handleNavigation = (item: NavigationItem) => {
    if (!item.disabled) {
      router.push(item.href)
    }
  }

  return (
    <nav className={cn(
      'fixed bottom-0 left-0 right-0 z-50 safe-area-pb',
      variantClasses[variant],
      className
    )}>
      <div className="grid grid-cols-5 gap-1 max-w-md mx-auto px-2">
        {items.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <button
              key={item.key}
              onClick={() => handleNavigation(item)}
              disabled={item.disabled}
              className={cn(
                'relative flex flex-col items-center justify-center p-3 transition-all duration-200 touch-target min-h-[60px]',
                'focus:outline-none focus-ring active:scale-95 active:opacity-80',
                isActive
                  ? 'text-pano-primary'
                  : 'text-pano-text-secondary hover:text-pano-text-primary active:text-pano-primary',
                item.disabled && 'opacity-50 cursor-not-allowed'
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-pano-primary rounded-full" />
              )}

              {/* Icon */}
              <div className={cn(
                'flex items-center justify-center w-6 h-6 mb-1 transition-transform',
                isActive && 'scale-110'
              )}>
                {isActive && item.activeIcon ? item.activeIcon : item.icon}
              </div>

              {/* Label */}
              <span className={cn(
                'text-[11px] sm:text-xs font-medium transition-colors leading-tight',
                isActive ? 'text-pano-primary' : 'text-pano-text-muted'
              )}>
                {item.label}
              </span>

              {/* Badge */}
              {item.badge && (
                <div className="absolute -top-1 right-2 min-w-5 h-5 bg-pano-error text-pano-text-inverse text-xs font-bold rounded-full flex items-center justify-center px-1">
                  {typeof item.badge === 'number' && item.badge > 99 ? '99+' : item.badge}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Safe area bottom padding for devices with home indicators */}
      <div className="h-safe-area-inset-bottom bg-inherit" />
    </nav>
  )
}

// Predefined navigation configurations
export const defaultNavigationItems: NavigationItem[] = [
  {
    key: 'chat',
    label: 'Chat',
    href: '/chat',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    activeIcon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2c5.97 0 9 3.582 9 8 0 1.574-.512 3.042-1.395 4.28L21 20l-4.745-1.051A9.863 9.863 0 0112 20c-5.97 0-9-3.582-9-8s3.03-8 9-8z" />
      </svg>
    )
  },
  {
    key: 'swap',
    label: 'Swap',
    href: '/swap',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
    activeIcon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" d="M7 2a1 1 0 00-.707 1.707L9.586 7H3a1 1 0 100 2h6.586l-3.293 3.293a1 1 0 001.414 1.414l5-5a1 1 0 000-1.414l-5-5A1 1 0 007 2zm10 10a1 1 0 00-.707 1.707L19.586 17H13a1 1 0 100 2h6.586l-3.293 3.293a1 1 0 001.414 1.414l5-5a1 1 0 000-1.414l-5-5A1 1 0 0017 12z" clipRule="evenodd" />
      </svg>
    )
  },
  {
    key: 'lending',
    label: 'Lending',
    href: '/chat?open=lending',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    activeIcon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
      </svg>
    ),
    disabled: true
  },
  {
    key: 'staking',
    label: 'Staking',
    href: '/chat?open=staking',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    activeIcon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M13 2.05v3.03c3.39.49 6 3.39 6 6.92 0 .9-.18 1.75-.48 2.54l2.6 1.53c.56-1.24.88-2.62.88-4.07 0-5.18-3.95-9.45-9-9.95zM12 19c-3.87 0-7-3.13-7-7 0-3.53 2.61-6.43 6-6.92V2.05c-5.06.5-9 4.76-9 9.95 0 5.52 4.47 10 9.99 10 3.31 0 6.24-1.61 8.06-4.09l-2.6-1.53C16.17 17.98 14.21 19 12 19z" />
      </svg>
    ),
    disabled: true
  },
  {
    key: 'analytics',
    label: 'Analytics',
    href: '/analytics',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    activeIcon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1v-6a1 1 0 00-1-1h-6z" />
      </svg>
    ),
    disabled: true
  },
  {
    key: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    activeIcon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" d="M11.828 2.25c-.916 0-1.699.663-1.85 1.567l-.091.549a.798.798 0 01-.517.608 7.45 7.45 0 00-.478.198.798.798 0 01-.796-.064l-.453-.324a1.875 1.875 0 00-2.416.2l-.243.243a1.875 1.875 0 00-.2 2.416l.324.453a.798.798 0 01.064.796 7.448 7.448 0 00-.198.478.798.798 0 01-.608.517l-.549.091A1.875 1.875 0 002.25 11.828v.344c0 .916.663 1.699 1.567 1.85l.549.091c.281.047.504.25.608.517.06.162.127.321.198.478a.798.798 0 01-.064.796l-.324.453a1.875 1.875 0 00.2 2.416l.243.243c.648.648 1.67.733 2.416.2l.453-.324a.798.798 0 01.796-.064c.157.071.316.138.478.198.267.104.47.327.517.608l.091.549a1.875 1.875 0 001.85 1.567h.344c.916 0 1.699-.663 1.85-1.567l.091-.549a.798.798 0 01.517-.608 7.52 7.52 0 00.478-.198.798.798 0 01.796.064l.453.324a1.875 1.875 0 002.416-.2l.243-.243c.648-.648.733-1.67.2-2.416l-.324-.453a.798.798 0 01-.064-.796c.071-.157.138-.316.198-.478.104-.267.327-.47.608-.517l.549-.091A1.875 1.875 0 0021.75 12.172v-.344c0-.916-.663-1.699-1.567-1.85l-.549-.091a.798.798 0 01-.608-.517 7.507 7.507 0 00-.198-.478.798.798 0 01.064-.796l.324-.453a1.875 1.875 0 00-.2-2.416l-.243-.243a1.875 1.875 0 00-2.416-.2l-.453.324a.798.798 0 01-.796.064 7.462 7.462 0 00-.478-.198.798.798 0 01-.517-.608l-.091-.549A1.875 1.875 0 0012.172 2.25h-.344zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
      </svg>
    ),
    disabled: true
  }
]

'use client'

import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/utils'

const spinnerVariants = cva(
  'animate-spin',
  {
    variants: {
      variant: {
        default: 'border-2 border-pano-primary border-t-transparent rounded-full',
        dots: 'flex space-x-1',
        pulse: 'bg-pano-primary rounded-full animate-pulse',
        bars: 'flex space-x-1 items-end',
        ring: 'border-2 border-pano-border border-t-pano-primary rounded-full',
        gradient: 'border-2 border-transparent bg-gradient-to-r from-pano-primary to-pano-secondary rounded-full bg-clip-border',
      },
      size: {
        xs: 'w-3 h-3',
        sm: 'w-4 h-4',
        md: 'w-6 h-6',
        lg: 'w-8 h-8',
        xl: 'w-12 h-12',
      },
      speed: {
        slow: 'animate-[spin_2s_linear_infinite]',
        normal: 'animate-spin',
        fast: 'animate-[spin_0.5s_linear_infinite]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      speed: 'normal',
    },
  }
)

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {
  label?: string
  showLabel?: boolean
}

export function Spinner({
  className,
  variant,
  size,
  speed,
  label = 'Loading...',
  showLabel = false,
  ...props
}: SpinnerProps) {
  if (variant === 'dots') {
    return (
      <div className={cn('flex items-center gap-2', className)} {...props}>
        <div className={cn(spinnerVariants({ size, speed: 'normal' }), 'flex space-x-1')}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'bg-pano-primary rounded-full animate-pulse',
                size === 'xs' && 'w-1 h-1',
                size === 'sm' && 'w-1.5 h-1.5',
                size === 'md' && 'w-2 h-2',
                size === 'lg' && 'w-3 h-3',
                size === 'xl' && 'w-4 h-4'
              )}
              style={{
                animationDelay: `${i * 0.2}s`,
                animationDuration: '1.4s',
              }}
            />
          ))}
        </div>
        {showLabel && (
          <span className="text-sm text-pano-text-secondary">{label}</span>
        )}
      </div>
    )
  }

  if (variant === 'bars') {
    return (
      <div className={cn('flex items-center gap-2', className)} {...props}>
        <div className={cn(spinnerVariants({ size, speed: 'normal' }), 'flex space-x-1 items-end')}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'bg-pano-primary animate-pulse',
                size === 'xs' && 'w-0.5 h-2',
                size === 'sm' && 'w-0.5 h-3',
                size === 'md' && 'w-1 h-4',
                size === 'lg' && 'w-1 h-6',
                size === 'xl' && 'w-1.5 h-8'
              )}
              style={{
                animationDelay: `${i * 0.15}s`,
                animationDuration: '1.2s',
                height: `${(i % 2 === 0 ? 100 : 60)}%`,
              }}
            />
          ))}
        </div>
        {showLabel && (
          <span className="text-sm text-pano-text-secondary">{label}</span>
        )}
      </div>
    )
  }

  if (variant === 'pulse') {
    return (
      <div className={cn('flex items-center gap-2', className)} {...props}>
        <div
          className={cn(
            spinnerVariants({ variant, size, speed: 'normal' }),
            'animate-pulse'
          )}
        />
        {showLabel && (
          <span className="text-sm text-pano-text-secondary">{label}</span>
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-2', className)} {...props}>
      <div
        className={cn(spinnerVariants({ variant, size, speed }))}
        role="status"
        aria-label={label}
      >
        <span className="sr-only">{label}</span>
      </div>
      {showLabel && (
        <span className="text-sm text-pano-text-secondary">{label}</span>
      )}
    </div>
  )
}

// Loading overlay component
export interface LoadingOverlayProps {
  isLoading: boolean
  children: React.ReactNode
  spinner?: React.ReactNode
  className?: string
  backdrop?: 'blur' | 'dark' | 'light'
  message?: string
}

export function LoadingOverlay({
  isLoading,
  children,
  spinner,
  className,
  backdrop = 'blur',
  message = 'Loading...',
}: LoadingOverlayProps) {
  const backdropClasses = {
    blur: 'backdrop-blur-sm bg-pano-surface/80',
    dark: 'bg-black/50',
    light: 'bg-white/80',
  }

  return (
    <div className={cn('relative', className)}>
      {children}
      {isLoading && (
        <div
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center z-50 transition-all duration-200',
            backdropClasses[backdrop]
          )}
        >
          {spinner || <Spinner size="lg" showLabel label={message} />}
        </div>
      )}
    </div>
  )
}

// Full page loading component
export function PageLoader({
  isLoading,
  message = 'Loading...',
  spinner,
}: {
  isLoading: boolean
  message?: string
  spinner?: React.ReactNode
}) {
  if (!isLoading) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-pano-bg-primary">
      <div className="flex flex-col items-center space-y-4">
        {spinner || <Spinner size="xl" variant="gradient" />}
        <p className="text-lg font-medium text-pano-text-primary">{message}</p>
      </div>
    </div>
  )
}

// Inline loading component
export function InlineLoader({
  size = 'sm',
  message,
  className,
}: {
  size?: 'xs' | 'sm' | 'md'
  message?: string
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Spinner size={size} />
      {message && (
        <span className={cn(
          'text-pano-text-secondary',
          size === 'xs' && 'text-xs',
          size === 'sm' && 'text-sm',
          size === 'md' && 'text-base'
        )}>
          {message}
        </span>
      )}
    </div>
  )
}

// Button with loading state
export interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean
  loadingText?: string
  spinner?: React.ReactNode
  children: React.ReactNode
}

export function LoadingButton({
  isLoading = false,
  loadingText,
  spinner,
  children,
  disabled,
  className,
  ...props
}: LoadingButtonProps) {
  return (
    <button
      className={cn(
        'relative flex items-center justify-center gap-2 transition-all duration-200',
        isLoading && 'cursor-not-allowed',
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <>
          {spinner || <Spinner size="sm" />}
          {loadingText || children}
        </>
      )}
      {!isLoading && children}
    </button>
  )
}
'use client'

import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/utils'

const skeletonVariants = cva(
  'animate-pulse bg-gradient-to-r from-pano-surface-elevated via-pano-border to-pano-surface-elevated bg-[length:200%_100%] animate-shimmer',
  {
    variants: {
      variant: {
        default: 'rounded-md',
        circle: 'rounded-full',
        text: 'rounded-sm',
        button: 'rounded-lg',
        card: 'rounded-xl',
      },
      size: {
        sm: 'h-4',
        md: 'h-6',
        lg: 'h-8',
        xl: 'h-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  width?: string | number
  height?: string | number
  lines?: number
  avatar?: boolean
}

export function Skeleton({
  className,
  variant,
  size,
  width,
  height,
  lines = 1,
  avatar = false,
  style,
  ...props
}: SkeletonProps) {
  const baseStyle = {
    width: width || '100%',
    height: height || undefined,
    ...style,
  }

  if (lines === 1) {
    return (
      <div
        className={cn(skeletonVariants({ variant, size }), className)}
        style={baseStyle}
        {...props}
      />
    )
  }

  return (
    <div className={cn('space-y-2', className)} {...props}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={cn(
            skeletonVariants({ variant, size }),
            index === lines - 1 && 'w-3/4' // Last line is shorter
          )}
          style={{
            ...baseStyle,
            width: index === lines - 1 ? '75%' : baseStyle.width,
          }}
        />
      ))}
    </div>
  )
}

// Pre-built skeleton patterns
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <Skeleton
      variant="text"
      size="sm"
      lines={lines}
      className={className}
    />
  )
}

export function SkeletonAvatar({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Skeleton
      variant="circle"
      className={className}
      style={{ width: size, height: size }}
    />
  )
}

export function SkeletonButton({ className }: { className?: string }) {
  return (
    <Skeleton
      variant="button"
      size="lg"
      width={120}
      className={className}
    />
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('p-6 space-y-4', className)}>
      <div className="flex items-center space-x-4">
        <SkeletonAvatar size={48} />
        <div className="space-y-2 flex-1">
          <Skeleton variant="text" size="md" width="60%" />
          <Skeleton variant="text" size="sm" width="40%" />
        </div>
      </div>
      <SkeletonText lines={3} />
      <div className="flex justify-between items-center">
        <SkeletonButton />
        <Skeleton variant="text" size="sm" width={80} />
      </div>
    </div>
  )
}

export function SkeletonMessage({ isUser = false, className }: { isUser?: boolean; className?: string }) {
  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse', className)}>
      <SkeletonAvatar size={32} />
      <div className="flex-1 space-y-2 max-w-[75%]">
        <div className="flex items-center gap-2">
          <Skeleton variant="text" size="sm" width={60} />
          <Skeleton variant="text" size="sm" width={40} />
        </div>
        <div className={cn('space-y-1', isUser ? 'items-end' : 'items-start')}>
          <Skeleton variant="default" size="sm" width="80%" />
          <Skeleton variant="default" size="sm" width="60%" />
          <Skeleton variant="default" size="sm" width="45%" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonList({ items = 5, className }: { items?: number; className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex items-center space-x-4">
          <SkeletonAvatar size={40} />
          <div className="space-y-2 flex-1">
            <Skeleton variant="text" size="md" width="70%" />
            <Skeleton variant="text" size="sm" width="50%" />
          </div>
          <Skeleton variant="text" size="sm" width={60} />
        </div>
      ))}
    </div>
  )
}

export function SkeletonTable({
  rows = 5,
  cols = 4,
  className
}: {
  rows?: number
  cols?: number
  className?: string
}) {
  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex space-x-4">
        {Array.from({ length: cols }).map((_, index) => (
          <Skeleton
            key={`header-${index}`}
            variant="text"
            size="md"
            width={`${100 / cols}%`}
          />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex space-x-4">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton
              key={`cell-${rowIndex}-${colIndex}`}
              variant="text"
              size="sm"
              width={`${100 / cols}%`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonChart({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex justify-between items-center">
        <Skeleton variant="text" size="lg" width={200} />
        <Skeleton variant="button" size="sm" width={80} />
      </div>
      <div className="flex items-end space-x-2 h-40">
        {Array.from({ length: 12 }).map((_, index) => (
          <Skeleton
            key={index}
            variant="default"
            className="flex-1"
            style={{ height: `${Math.random() * 80 + 20}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} variant="text" size="sm" width={40} />
        ))}
      </div>
    </div>
  )
}

// Loading wrapper component
export function SkeletonWrapper({
  isLoading,
  fallback,
  children,
  className,
}: {
  isLoading: boolean
  fallback: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  if (isLoading) {
    return <div className={className}>{fallback}</div>
  }

  return <>{children}</>
}
'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/shared/lib/utils'

export interface PullToRefreshProps {
  children: React.ReactNode
  onRefresh: () => Promise<void> | void
  threshold?: number
  maxPullDistance?: number
  disabled?: boolean
  className?: string
  refreshingText?: string
  pullText?: string
  releaseText?: string
}

export function PullToRefresh({
  children,
  onRefresh,
  threshold = 80,
  maxPullDistance = 120,
  disabled = false,
  className,
  refreshingText = 'Refreshing...',
  pullText = 'Pull to refresh',
  releaseText = 'Release to refresh',
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [canRefresh, setCanRefresh] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const scrollTop = useRef(0)

  const handleRefresh = useCallback(async () => {
    if (disabled || isRefreshing) return

    setIsRefreshing(true)
    setCanRefresh(false)

    try {
      await onRefresh()
    } finally {
      // Add a small delay to show the refreshing state
      setTimeout(() => {
        setIsRefreshing(false)
        setPullDistance(0)
        setIsDragging(false)
      }, 300)
    }
  }, [disabled, isRefreshing, onRefresh])

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return

    const container = containerRef.current
    if (!container) return

    // Only allow pull to refresh when at the top of the container
    if (container.scrollTop > 0) return

    startY.current = e.touches[0].clientY
    scrollTop.current = container.scrollTop
    setIsDragging(true)
  }, [disabled, isRefreshing])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing || !isDragging) return

    const container = containerRef.current
    if (!container) return

    // Only proceed if we're at the top and pulling down
    if (container.scrollTop > 0) return

    const currentY = e.touches[0].clientY
    const deltaY = currentY - startY.current

    // Only handle downward pulls
    if (deltaY <= 0) return

    // Prevent default scrolling when pulling down
    e.preventDefault()

    // Calculate pull distance with resistance
    const resistance = 0.5
    let distance = deltaY * resistance

    // Apply maximum distance limit
    if (distance > maxPullDistance) {
      distance = maxPullDistance
    }

    setPullDistance(distance)
    setCanRefresh(distance >= threshold)
  }, [disabled, isRefreshing, isDragging, threshold, maxPullDistance])

  const handleTouchEnd = useCallback(() => {
    if (disabled || isRefreshing || !isDragging) return

    setIsDragging(false)

    if (canRefresh) {
      handleRefresh()
    } else {
      setPullDistance(0)
      setCanRefresh(false)
    }
  }, [disabled, isRefreshing, isDragging, canRefresh, handleRefresh])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  // Calculate progress percentage
  const progress = Math.min((pullDistance / threshold) * 100, 100)
  const isAtThreshold = pullDistance >= threshold

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-auto h-full',
        'overscroll-y-none', // Prevent native pull-to-refresh
        className
      )}
      style={{
        transform: `translateY(${pullDistance}px)`,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out',
      }}
    >
      {/* Pull to Refresh Indicator */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 flex flex-col items-center justify-center bg-pano-surface border-b border-pano-border',
          'transition-all duration-200 ease-out z-10',
          pullDistance > 0 || isRefreshing ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          height: Math.max(pullDistance, isRefreshing ? 80 : 0),
          transform: `translateY(-${Math.max(pullDistance, isRefreshing ? 80 : 0)}px)`,
        }}
      >
        <div className="flex flex-col items-center gap-2 p-4">
          {/* Refresh Icon/Spinner */}
          <div
            className={cn(
              'w-8 h-8 transition-all duration-200',
              isRefreshing && 'animate-spin'
            )}
            style={{
              transform: `rotate(${progress * 3.6}deg)`,
            }}
          >
            {isRefreshing ? (
              <div className="w-full h-full border-2 border-pano-primary border-t-transparent rounded-full" />
            ) : (
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className={cn(
                  'text-pano-text-secondary transition-colors duration-200',
                  isAtThreshold && 'text-pano-primary'
                )}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            )}
          </div>

          {/* Progress Indicator */}
          <div className="w-12 h-1 bg-pano-surface-elevated rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-200',
                isAtThreshold ? 'bg-pano-primary' : 'bg-pano-text-muted'
              )}
              style={{
                width: `${Math.min(progress, 100)}%`,
              }}
            />
          </div>

          {/* Status Text */}
          <span
            className={cn(
              'text-xs font-medium transition-colors duration-200',
              isRefreshing
                ? 'text-pano-primary'
                : isAtThreshold
                ? 'text-pano-primary'
                : 'text-pano-text-secondary'
            )}
          >
            {isRefreshing ? refreshingText : isAtThreshold ? releaseText : pullText}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-0">
        {children}
      </div>
    </div>
  )
}

// Hook for easier integration
export function usePullToRefresh(onRefresh: () => Promise<void> | void, options?: {
  threshold?: number
  disabled?: boolean
}) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    if (options?.disabled || isRefreshing) return

    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setIsRefreshing(false)
    }
  }, [onRefresh, options?.disabled, isRefreshing])

  return {
    isRefreshing,
    handleRefresh,
  }
}
'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Card, CardContent, type CardProps } from '@/components/ui/card'
import { useGestures } from '@/hooks/useGestures'
import { cn } from '@/shared/lib/utils'

export interface SwipeAction {
  id: string
  icon: React.ReactNode
  label: string
  color: string
  backgroundColor: string
  onAction: () => void
}

export interface SwipeableCardProps extends Omit<CardProps, 'children'> {
  children: React.ReactNode
  leftActions?: SwipeAction[]
  rightActions?: SwipeAction[]
  threshold?: number
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  disabled?: boolean
}

export function SwipeableCard({
  children,
  leftActions = [],
  rightActions = [],
  threshold = 80,
  onSwipeLeft,
  onSwipeRight,
  disabled = false,
  className,
  ...props
}: SwipeableCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showingActions, setShowingActions] = useState<'left' | 'right' | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const isDragging = useRef(false)

  const resetPosition = useCallback(() => {
    setIsAnimating(true)
    setSwipeOffset(0)
    setShowingActions(null)
    setTimeout(() => setIsAnimating(false), 300)
  }, [])

  const executeAction = useCallback((action: SwipeAction) => {
    action.onAction()
    resetPosition()
  }, [resetPosition])

  const handleSwipeStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (disabled) return

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    startX.current = clientX
    isDragging.current = true
    setIsAnimating(false)
  }, [disabled])

  const handleSwipeMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (disabled || !isDragging.current) return

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const deltaX = clientX - startX.current

    // Apply resistance for overswipe
    const maxOffset = 120
    let newOffset = deltaX

    if (Math.abs(deltaX) > maxOffset) {
      const resistance = 0.3
      const excess = Math.abs(deltaX) - maxOffset
      newOffset = deltaX > 0
        ? maxOffset + excess * resistance
        : -maxOffset - excess * resistance
    }

    setSwipeOffset(newOffset)

    // Show actions when threshold is reached
    if (Math.abs(newOffset) > threshold) {
      if (newOffset > 0 && leftActions.length > 0) {
        setShowingActions('left')
      } else if (newOffset < 0 && rightActions.length > 0) {
        setShowingActions('right')
      }
    } else {
      setShowingActions(null)
    }
  }, [disabled, threshold, leftActions.length, rightActions.length])

  const handleSwipeEnd = useCallback(() => {
    if (disabled || !isDragging.current) return

    isDragging.current = false
    const absOffset = Math.abs(swipeOffset)

    if (absOffset > threshold) {
      if (swipeOffset > 0) {
        // Swiped right
        if (leftActions.length > 0) {
          setSwipeOffset(120)
          setShowingActions('left')
        } else {
          onSwipeRight?.()
          resetPosition()
        }
      } else {
        // Swiped left
        if (rightActions.length > 0) {
          setSwipeOffset(-120)
          setShowingActions('right')
        } else {
          onSwipeLeft?.()
          resetPosition()
        }
      }
    } else {
      resetPosition()
    }
  }, [disabled, swipeOffset, threshold, leftActions.length, rightActions.length, onSwipeLeft, onSwipeRight, resetPosition])

  const { ref: gestureRef } = useGestures({
    onSwipeLeft: () => {
      if (rightActions.length === 0) {
        onSwipeLeft?.()
      }
    },
    onSwipeRight: () => {
      if (leftActions.length === 0) {
        onSwipeRight?.()
      }
    },
    threshold,
  })

  // Combine refs
  const combinedRef = useCallback((node: HTMLDivElement) => {
    cardRef.current = node
    if (gestureRef.current !== node) {
      gestureRef.current = node
    }
  }, [gestureRef])

  return (
    <div className="relative overflow-hidden">
      {/* Left Actions */}
      {leftActions.length > 0 && (
        <div
          className={cn(
            'absolute inset-y-0 left-0 flex items-center justify-start pl-4 transition-opacity duration-200',
            showingActions === 'left' ? 'opacity-100' : 'opacity-0'
          )}
          style={{
            width: Math.max(0, swipeOffset),
          }}
        >
          <div className="flex items-center gap-2">
            {leftActions.map((action) => (
              <button
                key={action.id}
                onClick={() => executeAction(action)}
                className={cn(
                  'flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 transform hover:scale-110 active:scale-95',
                  showingActions === 'left' ? 'scale-100' : 'scale-0'
                )}
                style={{
                  backgroundColor: action.backgroundColor,
                  color: action.color,
                }}
                aria-label={action.label}
              >
                {action.icon}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Right Actions */}
      {rightActions.length > 0 && (
        <div
          className={cn(
            'absolute inset-y-0 right-0 flex items-center justify-end pr-4 transition-opacity duration-200',
            showingActions === 'right' ? 'opacity-100' : 'opacity-0'
          )}
          style={{
            width: Math.max(0, -swipeOffset),
          }}
        >
          <div className="flex items-center gap-2">
            {rightActions.map((action) => (
              <button
                key={action.id}
                onClick={() => executeAction(action)}
                className={cn(
                  'flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 transform hover:scale-110 active:scale-95',
                  showingActions === 'right' ? 'scale-100' : 'scale-0'
                )}
                style={{
                  backgroundColor: action.backgroundColor,
                  color: action.color,
                }}
                aria-label={action.label}
              >
                {action.icon}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Card */}
      <Card
        ref={combinedRef}
        className={cn(
          'relative z-10 touch-pan-y select-none cursor-grab active:cursor-grabbing',
          isAnimating && 'transition-transform duration-300 ease-out',
          disabled && 'cursor-default',
          className
        )}
        style={{
          transform: `translateX(${swipeOffset}px)`,
        }}
        onTouchStart={handleSwipeStart}
        onTouchMove={handleSwipeMove}
        onTouchEnd={handleSwipeEnd}
        onMouseDown={handleSwipeStart}
        onMouseMove={handleSwipeMove}
        onMouseUp={handleSwipeEnd}
        onMouseLeave={handleSwipeEnd}
        {...props}
      >
        <CardContent className="p-0">
          {children}
        </CardContent>
      </Card>

      {/* Overlay to close actions */}
      {showingActions && !isAnimating && (
        <div
          className="fixed inset-0 z-0 bg-transparent"
          onClick={resetPosition}
          onTouchStart={resetPosition}
        />
      )}
    </div>
  )
}

// Pre-defined action types
export const swipeActions = {
  delete: (onDelete: () => void): SwipeAction => ({
    id: 'delete',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    label: 'Delete',
    color: '#ffffff',
    backgroundColor: '#ef4444',
    onAction: onDelete,
  }),

  archive: (onArchive: () => void): SwipeAction => ({
    id: 'archive',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8l4 4 4-4" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18v4H3zM9 7v10l3-3 3 3V7" />
      </svg>
    ),
    label: 'Archive',
    color: '#ffffff',
    backgroundColor: '#6b7280',
    onAction: onArchive,
  }),

  favorite: (onFavorite: () => void): SwipeAction => ({
    id: 'favorite',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    label: 'Favorite',
    color: '#ffffff',
    backgroundColor: '#f59e0b',
    onAction: onFavorite,
  }),

  share: (onShare: () => void): SwipeAction => ({
    id: 'share',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
      </svg>
    ),
    label: 'Share',
    color: '#ffffff',
    backgroundColor: '#06b6d4',
    onAction: onShare,
  }),

  edit: (onEdit: () => void): SwipeAction => ({
    id: 'edit',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    label: 'Edit',
    color: '#ffffff',
    backgroundColor: '#8b5cf6',
    onAction: onEdit,
  }),
}
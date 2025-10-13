'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useGestures } from '@/hooks/useGestures'
import { cn } from '@/shared/lib/utils'

export interface SwipeableModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  position?: 'center' | 'bottom' | 'top'
  showCloseButton?: boolean
  swipeToClose?: boolean
  backdrop?: 'blur' | 'dark' | 'transparent'
  className?: string
}

export function SwipeableModal({
  isOpen,
  onClose,
  children,
  title,
  size = 'md',
  position = 'center',
  showCloseButton = true,
  swipeToClose = true,
  backdrop = 'blur',
  className,
}: SwipeableModalProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Handle swipe to close
  const { ref: gestureRef } = useGestures({
    onSwipeDown: swipeToClose && position === 'bottom' ? onClose : undefined,
    onSwipeUp: swipeToClose && position === 'top' ? onClose : undefined,
    threshold: 100,
  })

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose()
    }
  }, [onClose])

  // Handle escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  // Touch/mouse drag handlers for swipe to close
  const handleDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!swipeToClose) return

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    setIsDragging(true)

    // Store initial touch position
    modalRef.current?.setAttribute('data-start-y', clientY.toString())
  }, [swipeToClose])

  const handleDragMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!swipeToClose || !isDragging) return

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const startY = parseFloat(modalRef.current?.getAttribute('data-start-y') || '0')
    const deltaY = clientY - startY

    // Only allow dragging in the close direction
    if (position === 'bottom' && deltaY > 0) {
      setDragOffset(deltaY)
    } else if (position === 'top' && deltaY < 0) {
      setDragOffset(Math.abs(deltaY))
    } else if (position === 'center') {
      // For center modals, allow dragging in any direction
      setDragOffset(Math.abs(deltaY))
    }
  }, [swipeToClose, isDragging, position])

  const handleDragEnd = useCallback(() => {
    if (!swipeToClose || !isDragging) return

    setIsDragging(false)

    // Close if dragged beyond threshold
    if (dragOffset > 100) {
      onClose()
    } else {
      setDragOffset(0)
    }
  }, [swipeToClose, isDragging, dragOffset, onClose])

  // Show/hide modal with animation
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      document.body.style.overflow = 'hidden'
    } else {
      setDragOffset(0)
      setIsDragging(false)
      const timer = setTimeout(() => setIsVisible(false), 300)
      document.body.style.overflow = 'unset'
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Add escape key listener
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  if (!isVisible) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full mx-4',
  }

  const positionClasses = {
    center: 'items-center justify-center',
    bottom: 'items-end justify-center pb-safe',
    top: 'items-start justify-center pt-safe',
  }

  const backdropClasses = {
    blur: 'backdrop-blur-sm bg-black/20',
    dark: 'bg-black/50',
    transparent: 'bg-transparent',
  }

  // Calculate transform based on position and drag
  const getTransform = () => {
    let transform = ''

    if (!isOpen) {
      switch (position) {
        case 'bottom':
          transform = 'translateY(100%)'
          break
        case 'top':
          transform = 'translateY(-100%)'
          break
        case 'center':
          transform = 'scale(0.95) translateY(-10px)'
          break
      }
    } else if (isDragging) {
      switch (position) {
        case 'bottom':
          transform = `translateY(${dragOffset}px)`
          break
        case 'top':
          transform = `translateY(-${dragOffset}px)`
          break
        case 'center':
          transform = `translateY(${dragOffset}px) scale(${1 - dragOffset * 0.001})`
          break
      }
    }

    return transform
  }

  const modalContent = (
    <div
      ref={overlayRef}
      className={cn(
        'fixed inset-0 z-50 flex transition-all duration-300 ease-out',
        positionClasses[position],
        backdropClasses[backdrop],
        isOpen ? 'opacity-100' : 'opacity-0'
      )}
      onClick={handleBackdropClick}
    >
      <Card
        ref={(node) => {
          modalRef.current = node
          if (gestureRef.current !== node) {
            gestureRef.current = node
          }
        }}
        variant="elevated"
        className={cn(
          'relative w-full max-h-[90vh] overflow-hidden transition-all duration-300 ease-out',
          sizeClasses[size],
          position === 'bottom' && 'rounded-t-2xl rounded-b-none',
          position === 'top' && 'rounded-b-2xl rounded-t-none',
          position === 'center' && 'rounded-2xl',
          className
        )}
        style={{
          transform: getTransform(),
        }}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle for bottom sheet */}
        {position === 'bottom' && swipeToClose && (
          <div className="flex justify-center py-3 border-b border-pano-border">
            <div className="w-12 h-1 bg-pano-text-muted rounded-full opacity-50" />
          </div>
        )}

        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 border-b border-pano-border">
            <h2 className="text-lg font-semibold text-pano-text-primary">
              {title}
            </h2>
            {showCloseButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="p-2 hover:bg-pano-surface-elevated"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </Card>
    </div>
  )

  return createPortal(modalContent, document.body)
}

// Hook for modal state management
export function useModal(defaultOpen = false) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(prev => !prev), [])

  return {
    isOpen,
    open,
    close,
    toggle,
  }
}

// Bottom Sheet component as a specialized modal
export function BottomSheet(props: Omit<SwipeableModalProps, 'position'>) {
  return <SwipeableModal {...props} position="bottom" />
}

// Drawer component as a specialized modal
export function Drawer(props: Omit<SwipeableModalProps, 'position'>) {
  return <SwipeableModal {...props} position="center" size="lg" />
}
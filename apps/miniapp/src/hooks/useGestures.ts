'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface GestureConfig {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  onTap?: () => void
  onDoubleTap?: () => void
  onLongPress?: () => void
  onPinch?: (scale: number) => void
  threshold?: number
  longPressDelay?: number
  doubleTapDelay?: number
}

export interface GestureState {
  isPressed: boolean
  isDragging: boolean
  isPinching: boolean
  direction: 'up' | 'down' | 'left' | 'right' | null
  distance: number
  scale: number
}

interface TouchPoint {
  x: number
  y: number
  id: number
}

export function useGestures(config: GestureConfig = {}) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onTap,
    onDoubleTap,
    onLongPress,
    onPinch,
    threshold = 50,
    longPressDelay = 500,
    doubleTapDelay = 300,
  } = config

  const ref = useRef<HTMLElement>(null)
  const [gestureState, setGestureState] = useState<GestureState>({
    isPressed: false,
    isDragging: false,
    isPinching: false,
    direction: null,
    distance: 0,
    scale: 1,
  })

  // Touch tracking
  const touchStart = useRef<TouchPoint | null>(null)
  const touchPoints = useRef<TouchPoint[]>([])
  const lastTap = useRef<number>(0)
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const initialDistance = useRef<number>(0)

  // Utility functions
  const getDistance = useCallback((point1: TouchPoint, point2: TouchPoint): number => {
    const dx = point2.x - point1.x
    const dy = point2.y - point1.y
    return Math.sqrt(dx * dx + dy * dy)
  }, [])

  const getDirection = useCallback((start: TouchPoint, end: TouchPoint): 'up' | 'down' | 'left' | 'right' | null => {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance < threshold) return null

    const angle = Math.atan2(dy, dx) * (180 / Math.PI)

    if (angle >= -45 && angle <= 45) return 'right'
    if (angle >= 45 && angle <= 135) return 'down'
    if (angle >= 135 || angle <= -135) return 'left'
    if (angle >= -135 && angle <= -45) return 'up'

    return null
  }, [threshold])

  // Touch event handlers
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0]
    const now = Date.now()

    touchStart.current = { x: touch.clientX, y: touch.clientY, id: touch.identifier }
    touchPoints.current = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY, id: t.identifier }))

    setGestureState(prev => ({
      ...prev,
      isPressed: true,
      isDragging: false,
      isPinching: e.touches.length > 1,
      direction: null,
      distance: 0,
      scale: 1,
    }))

    // Handle double tap
    if (onDoubleTap && now - lastTap.current < doubleTapDelay) {
      onDoubleTap()
      lastTap.current = 0
    } else {
      lastTap.current = now
    }

    // Start long press timer
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        onLongPress()
      }, longPressDelay)
    }

    // Track initial distance for pinch
    if (e.touches.length === 2) {
      const [touch1, touch2] = Array.from(e.touches)
      initialDistance.current = getDistance(
        { x: touch1.clientX, y: touch1.clientY, id: touch1.identifier },
        { x: touch2.clientX, y: touch2.clientY, id: touch2.identifier }
      )
    }
  }, [onDoubleTap, onLongPress, doubleTapDelay, longPressDelay, getDistance])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!touchStart.current) return

    const touch = e.touches[0]
    const currentPoint = { x: touch.clientX, y: touch.clientY, id: touch.identifier }
    const distance = getDistance(touchStart.current, currentPoint)
    const direction = getDirection(touchStart.current, currentPoint)

    // Clear long press timer if moving
    if (longPressTimer.current && distance > 10) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }

    setGestureState(prev => ({
      ...prev,
      isDragging: distance > 10,
      direction,
      distance,
    }))

    // Handle pinch gesture
    if (e.touches.length === 2 && onPinch) {
      const [touch1, touch2] = Array.from(e.touches)
      const currentDistance = getDistance(
        { x: touch1.clientX, y: touch1.clientY, id: touch1.identifier },
        { x: touch2.clientX, y: touch2.clientY, id: touch2.identifier }
      )

      if (initialDistance.current > 0) {
        const scale = currentDistance / initialDistance.current
        setGestureState(prev => ({ ...prev, scale }))
        onPinch(scale)
      }
    }
  }, [getDistance, getDirection, onPinch])

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!touchStart.current) return

    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }

    const { direction, distance, isDragging } = gestureState

    // Handle swipe gestures
    if (isDragging && direction && distance > threshold) {
      switch (direction) {
        case 'left':
          onSwipeLeft?.()
          break
        case 'right':
          onSwipeRight?.()
          break
        case 'up':
          onSwipeUp?.()
          break
        case 'down':
          onSwipeDown?.()
          break
      }
    } else if (!isDragging && onTap) {
      // Handle tap if not dragging
      onTap()
    }

    // Reset state
    touchStart.current = null
    touchPoints.current = []
    initialDistance.current = 0

    setGestureState({
      isPressed: false,
      isDragging: false,
      isPinching: false,
      direction: null,
      distance: 0,
      scale: 1,
    })
  }, [gestureState, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onTap])

  // Mouse event handlers for desktop
  const handleMouseDown = useCallback((e: MouseEvent) => {
    const now = Date.now()

    touchStart.current = { x: e.clientX, y: e.clientY, id: 0 }

    setGestureState(prev => ({
      ...prev,
      isPressed: true,
      isDragging: false,
      direction: null,
      distance: 0,
    }))

    // Handle double click
    if (onDoubleTap && now - lastTap.current < doubleTapDelay) {
      onDoubleTap()
      lastTap.current = 0
    } else {
      lastTap.current = now
    }

    // Start long press timer
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        onLongPress()
      }, longPressDelay)
    }
  }, [onDoubleTap, onLongPress, doubleTapDelay, longPressDelay])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!touchStart.current || !gestureState.isPressed) return

    const currentPoint = { x: e.clientX, y: e.clientY, id: 0 }
    const distance = getDistance(touchStart.current, currentPoint)
    const direction = getDirection(touchStart.current, currentPoint)

    // Clear long press timer if moving
    if (longPressTimer.current && distance > 10) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }

    setGestureState(prev => ({
      ...prev,
      isDragging: distance > 10,
      direction,
      distance,
    }))
  }, [gestureState.isPressed, getDistance, getDirection])

  const handleMouseUp = useCallback(() => {
    if (!touchStart.current) return

    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }

    const { direction, distance, isDragging } = gestureState

    // Handle swipe gestures
    if (isDragging && direction && distance > threshold) {
      switch (direction) {
        case 'left':
          onSwipeLeft?.()
          break
        case 'right':
          onSwipeRight?.()
          break
        case 'up':
          onSwipeUp?.()
          break
        case 'down':
          onSwipeDown?.()
          break
      }
    } else if (!isDragging && onTap) {
      // Handle click if not dragging
      onTap()
    }

    // Reset state
    touchStart.current = null

    setGestureState({
      isPressed: false,
      isDragging: false,
      isPinching: false,
      direction: null,
      distance: 0,
      scale: 1,
    })
  }, [gestureState, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onTap])

  // Setup event listeners
  useEffect(() => {
    const element = ref.current
    if (!element) return

    // Touch events
    element.addEventListener('touchstart', handleTouchStart, { passive: false })
    element.addEventListener('touchmove', handleTouchMove, { passive: false })
    element.addEventListener('touchend', handleTouchEnd, { passive: false })

    // Mouse events
    element.addEventListener('mousedown', handleMouseDown)

    // Global mouse events for drag tracking
    const handleGlobalMouseMove = (e: MouseEvent) => handleMouseMove(e)
    const handleGlobalMouseUp = () => handleMouseUp()

    document.addEventListener('mousemove', handleGlobalMouseMove)
    document.addEventListener('mouseup', handleGlobalMouseUp)

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
      element.removeEventListener('mousedown', handleMouseDown)

      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)

      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
      }
    }
  }, [
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  ])

  return { ref, gestureState }
}

// Hook for swipe-to-close modals/drawers
export function useSwipeToClose(onClose: () => void, threshold = 100) {
  return useGestures({
    onSwipeDown: onClose,
    onSwipeUp: onClose,
    threshold,
  })
}

// Hook for pull-to-refresh
export function usePullToRefresh(onRefresh: () => void, threshold = 80) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleSwipeDown = useCallback(async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setIsRefreshing(false)
    }
  }, [onRefresh, isRefreshing])

  const gestures = useGestures({
    onSwipeDown: handleSwipeDown,
    threshold,
  })

  return {
    ...gestures,
    isRefreshing,
  }
}

// Hook for navigation gestures
export function useNavigationGestures(
  onGoBack?: () => void,
  onGoForward?: () => void,
  threshold = 100
) {
  return useGestures({
    onSwipeRight: onGoBack,
    onSwipeLeft: onGoForward,
    threshold,
  })
}
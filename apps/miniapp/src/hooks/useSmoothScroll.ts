'use client'

import { useCallback, useEffect, useRef } from 'react'

export interface SmoothScrollConfig {
  duration?: number
  easing?: (t: number) => number
  behavior?: 'smooth' | 'instant'
  block?: 'start' | 'center' | 'end' | 'nearest'
  inline?: 'start' | 'center' | 'end' | 'nearest'
}

// Easing functions
export const easingFunctions = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => --t * t * t + 1,
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  easeInBack: (t: number) => 2.7 * t * t * t - 1.7 * t * t,
  easeOutBack: (t: number) => 1 + --t * t * (2.7 * t + 1.7),
  easeInOutBack: (t: number) => {
    const c1 = 1.70158
    const c2 = c1 * 1.525
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2
  },
}

export function useSmoothScroll(config: SmoothScrollConfig = {}) {
  const {
    duration = 600,
    easing = easingFunctions.easeOutCubic,
    behavior = 'smooth',
    block = 'start',
    inline = 'nearest',
  } = config

  const animationFrame = useRef<number>()

  // Smooth scroll to element
  const scrollToElement = useCallback(
    (element: HTMLElement | string, customConfig?: Partial<SmoothScrollConfig>) => {
      const targetElement = typeof element === 'string' ? document.querySelector(element) : element
      if (!targetElement) return

      const finalConfig = { ...config, ...customConfig }

      // Use native smooth scrolling if supported and requested
      if (finalConfig.behavior === 'smooth' && 'scrollIntoView' in targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: finalConfig.block,
          inline: finalConfig.inline,
        })
        return
      }

      // Custom smooth scrolling implementation
      const startPosition = window.pageYOffset
      const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset
      const distance = targetPosition - startPosition
      const startTime = performance.now()

      const animateScroll = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / (finalConfig.duration || duration), 1)
        const easeProgress = (finalConfig.easing || easing)(progress)

        window.scrollTo(0, startPosition + distance * easeProgress)

        if (progress < 1) {
          animationFrame.current = requestAnimationFrame(animateScroll)
        }
      }

      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current)
      }

      animationFrame.current = requestAnimationFrame(animateScroll)
    },
    [config, duration, easing, behavior, block, inline]
  )

  // Smooth scroll to position
  const scrollToPosition = useCallback(
    (x: number, y: number, customConfig?: Partial<SmoothScrollConfig>) => {
      const finalConfig = { ...config, ...customConfig }

      // Use native smooth scrolling if supported and requested
      if (finalConfig.behavior === 'smooth' && 'scrollTo' in window) {
        window.scrollTo({
          left: x,
          top: y,
          behavior: 'smooth',
        })
        return
      }

      // Custom smooth scrolling implementation
      const startX = window.pageXOffset
      const startY = window.pageYOffset
      const distanceX = x - startX
      const distanceY = y - startY
      const startTime = performance.now()

      const animateScroll = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / (finalConfig.duration || duration), 1)
        const easeProgress = (finalConfig.easing || easing)(progress)

        window.scrollTo(
          startX + distanceX * easeProgress,
          startY + distanceY * easeProgress
        )

        if (progress < 1) {
          animationFrame.current = requestAnimationFrame(animateScroll)
        }
      }

      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current)
      }

      animationFrame.current = requestAnimationFrame(animateScroll)
    },
    [config, duration, easing]
  )

  // Smooth scroll to top
  const scrollToTop = useCallback(
    (customConfig?: Partial<SmoothScrollConfig>) => {
      scrollToPosition(0, 0, customConfig)
    },
    [scrollToPosition]
  )

  // Smooth scroll to bottom
  const scrollToBottom = useCallback(
    (customConfig?: Partial<SmoothScrollConfig>) => {
      const maxScrollY = document.documentElement.scrollHeight - window.innerHeight
      scrollToPosition(0, maxScrollY, customConfig)
    },
    [scrollToPosition]
  )

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current)
      }
    }
  }, [])

  return {
    scrollToElement,
    scrollToPosition,
    scrollToTop,
    scrollToBottom,
  }
}

// Hook for smooth scrolling within a container
export function useSmoothScrollContainer(containerRef: React.RefObject<HTMLElement>, config: SmoothScrollConfig = {}) {
  const {
    duration = 600,
    easing = easingFunctions.easeOutCubic,
  } = config

  const animationFrame = useRef<number>()

  const scrollToElement = useCallback(
    (element: HTMLElement | string, customConfig?: Partial<SmoothScrollConfig>) => {
      const container = containerRef.current
      if (!container) return

      const targetElement = typeof element === 'string' ? container.querySelector(element) : element
      if (!targetElement) return

      const finalConfig = { ...config, ...customConfig }

      const containerRect = container.getBoundingClientRect()
      const targetRect = targetElement.getBoundingClientRect()

      const startScrollTop = container.scrollTop
      const targetScrollTop = startScrollTop + targetRect.top - containerRect.top
      const distance = targetScrollTop - startScrollTop
      const startTime = performance.now()

      const animateScroll = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / (finalConfig.duration || duration), 1)
        const easeProgress = (finalConfig.easing || easing)(progress)

        container.scrollTop = startScrollTop + distance * easeProgress

        if (progress < 1) {
          animationFrame.current = requestAnimationFrame(animateScroll)
        }
      }

      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current)
      }

      animationFrame.current = requestAnimationFrame(animateScroll)
    },
    [containerRef, config, duration, easing]
  )

  const scrollToPosition = useCallback(
    (scrollTop: number, customConfig?: Partial<SmoothScrollConfig>) => {
      const container = containerRef.current
      if (!container) return

      const finalConfig = { ...config, ...customConfig }

      const startScrollTop = container.scrollTop
      const distance = scrollTop - startScrollTop
      const startTime = performance.now()

      const animateScroll = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / (finalConfig.duration || duration), 1)
        const easeProgress = (finalConfig.easing || easing)(progress)

        container.scrollTop = startScrollTop + distance * easeProgress

        if (progress < 1) {
          animationFrame.current = requestAnimationFrame(animateScroll)
        }
      }

      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current)
      }

      animationFrame.current = requestAnimationFrame(animateScroll)
    },
    [containerRef, config, duration, easing]
  )

  const scrollToTop = useCallback(
    (customConfig?: Partial<SmoothScrollConfig>) => {
      scrollToPosition(0, customConfig)
    },
    [scrollToPosition]
  )

  const scrollToBottom = useCallback(
    (customConfig?: Partial<SmoothScrollConfig>) => {
      const container = containerRef.current
      if (!container) return

      const maxScrollTop = container.scrollHeight - container.clientHeight
      scrollToPosition(maxScrollTop, customConfig)
    },
    [containerRef, scrollToPosition]
  )

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current)
      }
    }
  }, [])

  return {
    scrollToElement,
    scrollToPosition,
    scrollToTop,
    scrollToBottom,
  }
}

// Hook for momentum scrolling simulation
export function useMomentumScroll(containerRef: React.RefObject<HTMLElement>) {
  const velocity = useRef({ x: 0, y: 0 })
  const lastPosition = useRef({ x: 0, y: 0 })
  const lastTime = useRef(0)
  const animationFrame = useRef<number>()

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const container = containerRef.current
    if (!container) return

    const currentTime = performance.now()
    const touch = e.touches[0]
    const currentPosition = { x: touch.clientX, y: touch.clientY }

    if (lastTime.current > 0) {
      const deltaTime = currentTime - lastTime.current
      const deltaX = currentPosition.x - lastPosition.current.x
      const deltaY = currentPosition.y - lastPosition.current.y

      velocity.current = {
        x: deltaX / deltaTime,
        y: deltaY / deltaTime,
      }
    }

    lastPosition.current = currentPosition
    lastTime.current = currentTime
  }, [containerRef])

  const handleTouchEnd = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    // Apply momentum scrolling
    const friction = 0.95
    const threshold = 0.1

    const animateMomentum = () => {
      if (Math.abs(velocity.current.x) < threshold && Math.abs(velocity.current.y) < threshold) {
        return
      }

      container.scrollLeft -= velocity.current.x * 10
      container.scrollTop -= velocity.current.y * 10

      velocity.current.x *= friction
      velocity.current.y *= friction

      animationFrame.current = requestAnimationFrame(animateMomentum)
    }

    animationFrame.current = requestAnimationFrame(animateMomentum)
  }, [containerRef])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('touchmove', handleTouchMove, { passive: true })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)

      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current)
      }
    }
  }, [containerRef, handleTouchMove, handleTouchEnd])

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current)
      }
    }
  }, [])
}
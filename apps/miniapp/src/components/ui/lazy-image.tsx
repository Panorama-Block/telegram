'use client'

import React, { forwardRef } from 'react'
import { useLazyImageWithBlur } from '@/hooks/useLazyImage'
import { cn } from '@/shared/lib/utils'

export interface LazyImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string
  placeholderSrc?: string
  blurDataURL?: string
  lazy?: boolean
  blur?: boolean
  blurAmount?: number
  threshold?: number
  rootMargin?: string
  fallbackSrc?: string
  aspectRatio?: 'square' | 'video' | 'photo' | number
  objectFit?: 'cover' | 'contain' | 'fill' | 'scale-down' | 'none'
  priority?: boolean
  onLoad?: () => void
  onError?: () => void
}

export const LazyImage = forwardRef<HTMLImageElement, LazyImageProps>(
  ({
    src,
    placeholderSrc,
    blurDataURL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
    lazy = true,
    blur = true,
    blurAmount = 6,
    threshold = 0.1,
    rootMargin = '50px',
    fallbackSrc,
    aspectRatio,
    objectFit = 'cover',
    priority = false,
    className,
    alt = '',
    onLoad,
    onError,
    ...props
  }, forwardedRef) => {
    const {
      ref: lazyRef,
      src: currentSrc,
      isLoaded,
      isLoading,
      hasError,
      getImageStyle,
      load,
    } = useLazyImageWithBlur({
      src,
      placeholderSrc,
      blurDataURL,
      threshold,
      rootMargin,
      blur,
      blurAmount,
      onLoad,
      onError: () => {
        if (fallbackSrc && currentSrc !== fallbackSrc) {
          // Try fallback image
          const img = new Image()
          img.onload = onLoad
          img.onerror = onError
          img.src = fallbackSrc
        } else {
          onError?.()
        }
      },
    })

    // Load immediately if priority is set or lazy loading is disabled
    React.useEffect(() => {
      if (!lazy || priority) {
        load()
      }
    }, [lazy, priority, load])

    // Combine refs
    const combinedRef = React.useCallback((node: HTMLImageElement) => {
      if (lazyRef.current !== node) {
        lazyRef.current = node
      }
      if (typeof forwardedRef === 'function') {
        forwardedRef(node)
      } else if (forwardedRef) {
        forwardedRef.current = node
      }
    }, [lazyRef, forwardedRef])

    // Calculate aspect ratio styles
    const getAspectRatioStyle = () => {
      if (!aspectRatio) return {}

      let ratio: number
      switch (aspectRatio) {
        case 'square':
          ratio = 1
          break
        case 'video':
          ratio = 16 / 9
          break
        case 'photo':
          ratio = 4 / 3
          break
        default:
          ratio = typeof aspectRatio === 'number' ? aspectRatio : 1
      }

      return {
        aspectRatio: ratio,
        width: '100%',
        height: 'auto',
      }
    }

    const imageStyle = {
      ...getImageStyle(),
      ...getAspectRatioStyle(),
      objectFit,
    }

    return (
      <div className={cn('relative overflow-hidden', className)}>
        <img
          ref={combinedRef}
          src={hasError && fallbackSrc ? fallbackSrc : currentSrc}
          alt={alt}
          style={imageStyle}
          className={cn(
            'transition-all duration-300 ease-out',
            isLoading && 'animate-pulse',
            hasError && 'opacity-50'
          )}
          loading={lazy && !priority ? 'lazy' : 'eager'}
          decoding="async"
          {...props}
        />

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-pano-surface-elevated/50">
            <div className="w-6 h-6 border-2 border-pano-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error indicator */}
        {hasError && !fallbackSrc && (
          <div className="absolute inset-0 flex items-center justify-center bg-pano-surface-elevated text-pano-text-muted">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21,15 16,10 5,21" />
            </svg>
          </div>
        )}
      </div>
    )
  }
)

LazyImage.displayName = 'LazyImage'
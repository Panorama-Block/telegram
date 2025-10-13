'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface LazyImageConfig {
  src: string
  placeholderSrc?: string
  blurDataURL?: string
  threshold?: number
  rootMargin?: string
  onLoad?: () => void
  onError?: () => void
}

export interface LazyImageState {
  src: string | undefined
  isLoaded: boolean
  isLoading: boolean
  hasError: boolean
}

export function useLazyImage(config: LazyImageConfig): LazyImageState & {
  ref: React.RefObject<HTMLImageElement>
  load: () => void
} {
  const {
    src,
    placeholderSrc,
    blurDataURL,
    threshold = 0.1,
    rootMargin = '50px',
    onLoad,
    onError,
  } = config

  const [state, setState] = useState<LazyImageState>({
    src: placeholderSrc || blurDataURL,
    isLoaded: false,
    isLoading: false,
    hasError: false,
  })

  const imgRef = useRef<HTMLImageElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Load the actual image
  const load = useCallback(() => {
    if (state.isLoading || state.isLoaded || !src) return

    setState(prev => ({ ...prev, isLoading: true, hasError: false }))

    const img = new Image()

    img.onload = () => {
      setState(prev => ({
        ...prev,
        src,
        isLoaded: true,
        isLoading: false,
        hasError: false,
      }))
      onLoad?.()
    }

    img.onerror = () => {
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true,
      }))
      onError?.()
    }

    img.src = src
  }, [src, state.isLoading, state.isLoaded, onLoad, onError])

  // Setup intersection observer
  useEffect(() => {
    const img = imgRef.current
    if (!img || typeof IntersectionObserver === 'undefined') {
      // Fallback: load immediately if IntersectionObserver is not supported
      load()
      return
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting) {
          load()
          observerRef.current?.disconnect()
        }
      },
      {
        threshold,
        rootMargin,
      }
    )

    observerRef.current.observe(img)

    return () => {
      observerRef.current?.disconnect()
    }
  }, [load, threshold, rootMargin])

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect()
    }
  }, [])

  return {
    ...state,
    ref: imgRef,
    load,
  }
}

// Hook for lazy loading with blur effect
export function useLazyImageWithBlur(config: LazyImageConfig & {
  blur?: boolean
  blurAmount?: number
}) {
  const { blur = true, blurAmount = 10 } = config
  const lazyImage = useLazyImage(config)

  const getImageStyle = useCallback(() => {
    const baseStyle: React.CSSProperties = {
      transition: 'filter 0.3s ease-out, opacity 0.3s ease-out',
    }

    if (blur && !lazyImage.isLoaded && !lazyImage.hasError) {
      baseStyle.filter = `blur(${blurAmount}px)`
    }

    if (lazyImage.isLoading) {
      baseStyle.opacity = 0.7
    }

    return baseStyle
  }, [blur, blurAmount, lazyImage.isLoaded, lazyImage.hasError, lazyImage.isLoading])

  return {
    ...lazyImage,
    getImageStyle,
  }
}

// Hook for lazy loading multiple images
export function useLazyImages(configs: LazyImageConfig[]) {
  const [loadedCount, setLoadedCount] = useState(0)
  const [errorCount, setErrorCount] = useState(0)

  const images = configs.map((config, index) => {
    return useLazyImage({
      ...config,
      onLoad: () => {
        setLoadedCount(prev => prev + 1)
        config.onLoad?.()
      },
      onError: () => {
        setErrorCount(prev => prev + 1)
        config.onError?.()
      },
    })
  })

  const allLoaded = loadedCount === configs.length
  const hasErrors = errorCount > 0
  const progress = configs.length > 0 ? loadedCount / configs.length : 0

  return {
    images,
    allLoaded,
    hasErrors,
    progress,
    loadedCount,
    errorCount,
  }
}

// Preload images for better performance
export function useImagePreloader(urls: string[]) {
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set())
  const [isPreloading, setIsPreloading] = useState(false)

  const preload = useCallback(async (imageSrcs: string[]) => {
    if (isPreloading) return

    setIsPreloading(true)

    const promises = imageSrcs.map(src => {
      return new Promise<string>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(src)
        img.onerror = reject
        img.src = src
      })
    })

    try {
      const loaded = await Promise.allSettled(promises)
      const successful = loaded
        .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
        .map(result => result.value)

      setPreloadedImages(prev => new Set([...prev, ...successful]))
    } catch (error) {
      console.warn('Some images failed to preload:', error)
    } finally {
      setIsPreloading(false)
    }
  }, [isPreloading])

  useEffect(() => {
    if (urls.length > 0) {
      preload(urls)
    }
  }, [urls, preload])

  const isImagePreloaded = useCallback((src: string) => {
    return preloadedImages.has(src)
  }, [preloadedImages])

  return {
    preload,
    isImagePreloaded,
    preloadedImages,
    isPreloading,
  }
}

// Image component with lazy loading
export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  placeholderSrc?: string
  blurDataURL?: string
  lazy?: boolean
  blur?: boolean
  blurAmount?: number
  threshold?: number
  rootMargin?: string
  onLoad?: () => void
  onError?: () => void
}

// This would be a component, but since we're in a hook file, just export the props interface
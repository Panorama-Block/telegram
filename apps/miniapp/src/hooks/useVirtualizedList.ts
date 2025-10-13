'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'

export interface VirtualizedItem {
  id: string | number
  height?: number
  data?: any
}

export interface VirtualizedListConfig {
  itemHeight: number | ((index: number, item: VirtualizedItem) => number)
  containerHeight: number
  overscan?: number
  getItemId: (item: VirtualizedItem, index: number) => string | number
}

export interface VirtualizedRange {
  startIndex: number
  endIndex: number
  visibleItems: VirtualizedItem[]
}

export function useVirtualizedList<T extends VirtualizedItem>(
  items: T[],
  config: VirtualizedListConfig
) {
  const { itemHeight, containerHeight, overscan = 5, getItemId } = config
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Calculate item heights and positions
  const itemMetrics = useMemo(() => {
    let offset = 0
    const metrics = items.map((item, index) => {
      const height = typeof itemHeight === 'function' ? itemHeight(index, item) : itemHeight
      const metric = {
        height,
        offset,
        index,
      }
      offset += height
      return metric
    })

    return {
      items: metrics,
      totalHeight: offset,
    }
  }, [items, itemHeight])

  // Calculate visible range
  const visibleRange = useMemo((): VirtualizedRange => {
    if (!itemMetrics.items.length) {
      return {
        startIndex: 0,
        endIndex: 0,
        visibleItems: [],
      }
    }

    const viewportTop = scrollTop
    const viewportBottom = scrollTop + containerHeight

    // Find start index
    let startIndex = 0
    for (let i = 0; i < itemMetrics.items.length; i++) {
      const metric = itemMetrics.items[i]
      if (metric.offset + metric.height > viewportTop) {
        startIndex = Math.max(0, i - overscan)
        break
      }
    }

    // Find end index
    let endIndex = itemMetrics.items.length - 1
    for (let i = startIndex; i < itemMetrics.items.length; i++) {
      const metric = itemMetrics.items[i]
      if (metric.offset > viewportBottom) {
        endIndex = Math.min(itemMetrics.items.length - 1, i + overscan)
        break
      }
    }

    const visibleItems = items.slice(startIndex, endIndex + 1)

    return {
      startIndex,
      endIndex,
      visibleItems,
    }
  }, [scrollTop, containerHeight, itemMetrics, items, overscan])

  // Handle scroll events
  const handleScroll = useCallback((e: Event) => {
    const target = e.target as HTMLDivElement
    setScrollTop(target.scrollTop)
  }, [])

  // Setup scroll listener
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Get style for container
  const getContainerStyle = useCallback(() => ({
    height: containerHeight,
    overflow: 'auto',
  }), [containerHeight])

  // Get style for wrapper (full content height)
  const getWrapperStyle = useCallback(() => ({
    height: itemMetrics.totalHeight,
    position: 'relative' as const,
  }), [itemMetrics.totalHeight])

  // Get style for individual item
  const getItemStyle = useCallback((index: number) => {
    const adjustedIndex = visibleRange.startIndex + index
    const metric = itemMetrics.items[adjustedIndex]

    if (!metric) return {}

    return {
      position: 'absolute' as const,
      top: metric.offset,
      left: 0,
      right: 0,
      height: metric.height,
    }
  }, [visibleRange.startIndex, itemMetrics.items])

  // Scroll to specific item
  const scrollToItem = useCallback((index: number, align: 'start' | 'center' | 'end' = 'start') => {
    const container = containerRef.current
    if (!container || index < 0 || index >= itemMetrics.items.length) return

    const metric = itemMetrics.items[index]
    let scrollTop = metric.offset

    if (align === 'center') {
      scrollTop = metric.offset - (containerHeight - metric.height) / 2
    } else if (align === 'end') {
      scrollTop = metric.offset - containerHeight + metric.height
    }

    container.scrollTo({
      top: Math.max(0, Math.min(scrollTop, itemMetrics.totalHeight - containerHeight)),
      behavior: 'smooth',
    })
  }, [itemMetrics, containerHeight])

  // Scroll to top/bottom
  const scrollToTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const scrollToBottom = useCallback(() => {
    containerRef.current?.scrollTo({
      top: itemMetrics.totalHeight,
      behavior: 'smooth'
    })
  }, [itemMetrics.totalHeight])

  return {
    containerRef,
    visibleRange,
    totalHeight: itemMetrics.totalHeight,
    getContainerStyle,
    getWrapperStyle,
    getItemStyle,
    scrollToItem,
    scrollToTop,
    scrollToBottom,
    isScrolledToTop: scrollTop === 0,
    isScrolledToBottom: scrollTop >= itemMetrics.totalHeight - containerHeight,
  }
}

// Hook for virtualized chat messages
export function useVirtualizedMessages<T extends VirtualizedItem>(
  messages: T[],
  containerHeight: number,
  estimatedMessageHeight = 80
) {
  return useVirtualizedList(messages, {
    itemHeight: estimatedMessageHeight,
    containerHeight,
    overscan: 3,
    getItemId: (item, index) => item.id || index,
  })
}

// Hook for infinite loading with virtualization
export function useVirtualizedInfiniteList<T extends VirtualizedItem>(
  items: T[],
  config: VirtualizedListConfig & {
    hasNextPage?: boolean
    loadMore?: () => void
    threshold?: number
  }
) {
  const { hasNextPage = false, loadMore, threshold = 5 } = config
  const virtualized = useVirtualizedList(items, config)
  const [isLoading, setIsLoading] = useState(false)

  // Check if we need to load more items
  useEffect(() => {
    if (
      hasNextPage &&
      !isLoading &&
      loadMore &&
      virtualized.visibleRange.endIndex >= items.length - threshold
    ) {
      setIsLoading(true)
      loadMore()
    }
  }, [hasNextPage, isLoading, loadMore, virtualized.visibleRange.endIndex, items.length, threshold])

  // Reset loading state when items change
  useEffect(() => {
    setIsLoading(false)
  }, [items.length])

  return {
    ...virtualized,
    isLoading,
  }
}
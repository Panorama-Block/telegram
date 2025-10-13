'use client'

import { useCallback, useEffect, useRef, useState, useMemo } from 'react'

// Debounce hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Throttle hook
export function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value)
  const lastRan = useRef<number>(Date.now())

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value)
        lastRan.current = Date.now()
      }
    }, limit - (Date.now() - lastRan.current))

    return () => {
      clearTimeout(handler)
    }
  }, [value, limit])

  return throttledValue
}

// Memory usage monitoring
export function useMemoryMonitor() {
  const [memoryInfo, setMemoryInfo] = useState<{
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
    usagePercentage: number
  } | null>(null)

  const updateMemoryInfo = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      const usagePercentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100

      setMemoryInfo({
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        usagePercentage,
      })
    }
  }, [])

  useEffect(() => {
    updateMemoryInfo()
    const interval = setInterval(updateMemoryInfo, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [updateMemoryInfo])

  return memoryInfo
}

// Performance timing hook
export function usePerformanceTiming() {
  const [timing, setTiming] = useState<{
    loadTime: number
    domContentLoaded: number
    firstContentfulPaint?: number
    largestContentfulPaint?: number
  } | null>(null)

  useEffect(() => {
    const updateTiming = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const paint = performance.getEntriesByType('paint')

      const fcp = paint.find(entry => entry.name === 'first-contentful-paint')
      const lcp = performance.getEntriesByType('largest-contentful-paint')[0] as PerformanceEntry

      setTiming({
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        firstContentfulPaint: fcp?.startTime,
        largestContentfulPaint: lcp?.startTime,
      })
    }

    if (document.readyState === 'complete') {
      updateTiming()
    } else {
      window.addEventListener('load', updateTiming)
      return () => window.removeEventListener('load', updateTiming)
    }
  }, [])

  return timing
}

// Battery status monitoring
export function useBatteryStatus() {
  const [battery, setBattery] = useState<{
    charging: boolean
    level: number
    chargingTime: number
    dischargingTime: number
  } | null>(null)

  useEffect(() => {
    const updateBattery = (battery: any) => {
      setBattery({
        charging: battery.charging,
        level: battery.level,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime,
      })
    }

    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        updateBattery(battery)

        battery.addEventListener('chargingchange', () => updateBattery(battery))
        battery.addEventListener('levelchange', () => updateBattery(battery))
        battery.addEventListener('chargingtimechange', () => updateBattery(battery))
        battery.addEventListener('dischargingtimechange', () => updateBattery(battery))
      })
    }
  }, [])

  return battery
}

// Network information monitoring
export function useNetworkStatus() {
  const [networkInfo, setNetworkInfo] = useState<{
    online: boolean
    effectiveType?: string
    downlink?: number
    rtt?: number
    saveData?: boolean
  }>({
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  })

  useEffect(() => {
    const updateNetworkInfo = () => {
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection

      setNetworkInfo({
        online: navigator.onLine,
        effectiveType: connection?.effectiveType,
        downlink: connection?.downlink,
        rtt: connection?.rtt,
        saveData: connection?.saveData,
      })
    }

    updateNetworkInfo()

    window.addEventListener('online', updateNetworkInfo)
    window.addEventListener('offline', updateNetworkInfo)

    const connection = (navigator as any).connection
    if (connection) {
      connection.addEventListener('change', updateNetworkInfo)
    }

    return () => {
      window.removeEventListener('online', updateNetworkInfo)
      window.removeEventListener('offline', updateNetworkInfo)
      if (connection) {
        connection.removeEventListener('change', updateNetworkInfo)
      }
    }
  }, [])

  return networkInfo
}

// Device orientation and viewport monitoring
export function useViewport() {
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
    orientation: typeof screen !== 'undefined' && screen.orientation ? screen.orientation.angle : 0,
    isLandscape: typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false,
  })

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
        orientation: screen.orientation ? screen.orientation.angle : 0,
        isLandscape: window.innerWidth > window.innerHeight,
      })
    }

    window.addEventListener('resize', updateViewport)
    window.addEventListener('orientationchange', updateViewport)

    return () => {
      window.removeEventListener('resize', updateViewport)
      window.removeEventListener('orientationchange', updateViewport)
    }
  }, [])

  return viewport
}

// Optimized memoization with deep comparison
export function useDeepMemo<T>(factory: () => T, deps: React.DependencyList): T {
  const ref = useRef<{ deps: React.DependencyList; value: T }>()

  if (!ref.current || !deepEqual(ref.current.deps, deps)) {
    ref.current = {
      deps,
      value: factory(),
    }
  }

  return ref.current.value
}

// Deep equality check for objects
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a !== typeof b) return false

  if (typeof a === 'object') {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)

    if (keysA.length !== keysB.length) return false

    for (const key of keysA) {
      if (!keysB.includes(key)) return false
      if (!deepEqual(a[key], b[key])) return false
    }

    return true
  }

  return false
}

// Frame rate monitoring
export function useFrameRate() {
  const [frameRate, setFrameRate] = useState<number>(60)
  const frameCountRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(performance.now())
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    const measureFrameRate = () => {
      frameCountRef.current++
      const currentTime = performance.now()

      if (currentTime - lastTimeRef.current >= 1000) {
        setFrameRate(frameCountRef.current)
        frameCountRef.current = 0
        lastTimeRef.current = currentTime
      }

      animationFrameRef.current = requestAnimationFrame(measureFrameRate)
    }

    animationFrameRef.current = requestAnimationFrame(measureFrameRate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  return frameRate
}

// Resource loading performance
export function useResourceTiming() {
  const [resources, setResources] = useState<PerformanceResourceTiming[]>([])

  useEffect(() => {
    const updateResources = () => {
      const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      setResources(resourceEntries)
    }

    updateResources()

    // Monitor new resources
    const observer = new PerformanceObserver((list) => {
      updateResources()
    })

    observer.observe({ entryTypes: ['resource'] })

    return () => {
      observer.disconnect()
    }
  }, [])

  const resourceStats = useMemo(() => {
    const stats = {
      totalResources: resources.length,
      totalTransferSize: 0,
      totalEncodedSize: 0,
      averageLoadTime: 0,
      slowestResource: null as PerformanceResourceTiming | null,
    }

    if (resources.length === 0) return stats

    let totalLoadTime = 0
    let slowestTime = 0

    resources.forEach(resource => {
      stats.totalTransferSize += resource.transferSize || 0
      stats.totalEncodedSize += resource.encodedBodySize || 0

      const loadTime = resource.responseEnd - resource.requestStart
      totalLoadTime += loadTime

      if (loadTime > slowestTime) {
        slowestTime = loadTime
        stats.slowestResource = resource
      }
    })

    stats.averageLoadTime = totalLoadTime / resources.length

    return stats
  }, [resources])

  return {
    resources,
    stats: resourceStats,
  }
}

// Combined performance monitoring hook
export function usePerformanceMonitor() {
  const memory = useMemoryMonitor()
  const timing = usePerformanceTiming()
  const battery = useBatteryStatus()
  const network = useNetworkStatus()
  const viewport = useViewport()
  const frameRate = useFrameRate()
  const resourceTiming = useResourceTiming()

  const performanceScore = useMemo(() => {
    let score = 100

    // Deduct points for poor performance metrics
    if (timing?.firstContentfulPaint && timing.firstContentfulPaint > 2000) {
      score -= 20
    }

    if (memory && memory.usagePercentage > 80) {
      score -= 15
    }

    if (frameRate < 30) {
      score -= 25
    }

    if (!network.online) {
      score -= 50
    } else if (network.effectiveType === 'slow-2g' || network.effectiveType === '2g') {
      score -= 30
    }

    return Math.max(0, score)
  }, [timing, memory, frameRate, network])

  return {
    memory,
    timing,
    battery,
    network,
    viewport,
    frameRate,
    resourceTiming,
    performanceScore,
  }
}
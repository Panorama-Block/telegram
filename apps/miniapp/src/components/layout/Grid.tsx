'use client'

import React from 'react'
import { cn } from '@/shared/lib/utils'

interface GridProps {
  children: React.ReactNode
  className?: string
  cols?: {
    default?: number
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
  gap?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  adaptive?: boolean
  masonry?: boolean
}

const gapClasses = {
  none: 'gap-0',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8'
}

export function Grid({
  children,
  className,
  cols = { default: 1, sm: 2, lg: 3 },
  gap = 'md',
  adaptive = false,
  masonry = false
}: GridProps) {
  const getColClasses = () => {
    if (adaptive) return 'grid-adaptive'
    if (masonry) return 'grid-masonry'

    const classes = []

    if (cols.default) classes.push(`grid-cols-${cols.default}`)
    if (cols.sm) classes.push(`sm:grid-cols-${cols.sm}`)
    if (cols.md) classes.push(`md:grid-cols-${cols.md}`)
    if (cols.lg) classes.push(`lg:grid-cols-${cols.lg}`)
    if (cols.xl) classes.push(`xl:grid-cols-${cols.xl}`)

    return classes.join(' ')
  }

  return (
    <div className={cn(
      masonry ? '' : 'grid',
      getColClasses(),
      !masonry && gapClasses[gap],
      className
    )}>
      {children}
    </div>
  )
}
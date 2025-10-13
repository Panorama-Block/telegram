'use client'

import React from 'react'
import { cn } from '@/shared/lib/utils'

interface ContainerProps {
  children: React.ReactNode
  className?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  padding?: boolean
  center?: boolean
}

const containerSizes = {
  xs: 'max-w-screen-xs',
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  full: 'max-w-full'
}

export function Container({
  children,
  className,
  size = 'lg',
  padding = true,
  center = true
}: ContainerProps) {
  return (
    <div className={cn(
      'w-full',
      containerSizes[size],
      center && 'mx-auto',
      padding && 'px-4 sm:px-6 lg:px-8',
      className
    )}>
      {children}
    </div>
  )
}
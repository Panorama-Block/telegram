'use client'

import React from 'react'
import { cn } from '@/shared/lib/utils'

interface SectionProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'elevated' | 'glass' | 'ghost'
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  spacing?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  fullWidth?: boolean
  centerContent?: boolean
}

const sectionVariants = {
  default: 'bg-pano-surface',
  elevated: 'bg-pano-surface-elevated shadow-md',
  glass: 'glass backdrop-blur-md',
  ghost: 'bg-transparent'
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
  xl: 'p-12'
}

const spacingClasses = {
  none: '',
  sm: 'my-4',
  md: 'my-6',
  lg: 'my-8',
  xl: 'my-12'
}

export function Section({
  children,
  className,
  variant = 'default',
  padding = 'md',
  spacing = 'md',
  fullWidth = false,
  centerContent = false
}: SectionProps) {
  return (
    <section className={cn(
      'transition-all duration-300',
      sectionVariants[variant],
      paddingClasses[padding],
      spacingClasses[spacing],
      !fullWidth && 'mx-auto max-w-7xl',
      centerContent && 'flex items-center justify-center',
      className
    )}>
      {children}
    </section>
  )
}
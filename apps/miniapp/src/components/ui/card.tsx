import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/utils'

const cardVariants = cva(
  // Base styles - Clean and minimal design
  'block w-full transition-all focus-ring',
  {
    variants: {
      variant: {
        // Default - Clean surface with subtle border
        default: 'bg-pano-surface border border-pano-border',

        // Elevated - Clean card with subtle shadow
        elevated: 'bg-pano-surface border border-pano-border shadow-md hover:shadow-lg',

        // Flat - Pure surface, no borders or shadows
        flat: 'bg-pano-surface',

        // Glass - Minimal glass morphism effect
        glass: 'glass border border-pano-border/30 backdrop-blur-md',

        // Ghost - Transparent with hover
        ghost: 'hover:bg-pano-surface border border-transparent hover:border-pano-border/50',

        // Outlined - Only border, no background
        outlined: 'border border-pano-border bg-transparent',

        // Interactive - For clickable cards
        interactive: 'bg-pano-surface border border-pano-border hover:bg-pano-surface-elevated hover:border-pano-primary/30 cursor-pointer active:scale-[0.98]',
      },
      size: {
        // Clean spacing variations
        xs: 'p-3 rounded-md',
        sm: 'p-4 rounded-lg',
        md: 'p-6 rounded-lg',  // default
        lg: 'p-8 rounded-xl',
        xl: 'p-10 rounded-2xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  asChild?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <div
        className={cn(cardVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Card.displayName = 'Card'

// Clean header component
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('space-y-2', className)}
    {...props}
  />
))
CardHeader.displayName = 'CardHeader'

// Clean title component
const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight text-pano-text-primary',
      className
    )}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

// Clean description component
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-pano-text-secondary', className)}
    {...props}
  />
))
CardDescription.displayName = 'CardDescription'

// Clean content area
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('pt-4', className)}
    {...props}
  />
))
CardContent.displayName = 'CardContent'

// Clean footer component
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center pt-4', className)}
    {...props}
  />
))
CardFooter.displayName = 'CardFooter'

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cardVariants,
}
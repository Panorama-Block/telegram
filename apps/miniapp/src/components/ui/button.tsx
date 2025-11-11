import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/shared/lib/utils'
import '@/shared/ui/loader.css'

const buttonVariants = cva(
  // Base styles using PanoramaBlock Design System v2.0
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all focus-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 interactive touch-target touch-action-manipulation touch-feedback',
  {
    variants: {
      variant: {
        // Primary - PanoramaBlock neon cyan
        primary: 'bg-pano-primary text-pano-text-inverse hover:bg-pano-primary-hover shadow-md hover:shadow-lg active:scale-[0.98] glow-primary',

        // Secondary - Surface background with subtle border
        secondary: 'bg-pano-surface text-pano-text-primary border border-pano-border hover:bg-pano-surface-elevated hover:border-pano-primary/50 shadow-sm hover:shadow-md',

        // Ghost - Transparent with hover feedback
        ghost: 'text-pano-text-primary hover:bg-pano-surface hover:text-pano-text-accent',

        // Danger/Error - Red for destructive actions
        danger: 'bg-pano-error text-pano-text-inverse hover:opacity-90 shadow-md hover:shadow-lg active:scale-[0.98]',

        // Outline - Border only with transparent background
        outline: 'border-2 border-pano-primary bg-transparent text-pano-primary hover:bg-pano-primary hover:text-pano-text-inverse shadow-sm hover:shadow-md',

        // Success - Green for confirmations
        success: 'bg-pano-success text-pano-text-inverse hover:opacity-90 shadow-md hover:shadow-lg active:scale-[0.98]',

        // Link - Link-like styling
        link: 'text-pano-text-accent underline-offset-4 hover:underline hover:text-pano-primary',

        // Glass - Glass morphism effect
        glass: 'glass text-pano-text-primary hover:glass-dark backdrop-blur-md border border-pano-border/30 hover:border-pano-primary/50',
      },
      size: {
        // Touch-friendly sizes that work on desktop as well
        xs: 'h-8 px-2 text-xs rounded-md touch-target',
        sm: 'h-10 px-3 text-sm rounded-md touch-target',
        md: 'h-11 px-4 text-sm rounded-lg touch-target-large',  // default
        lg: 'h-12 px-6 text-base rounded-lg touch-target-large',
        xl: 'h-14 px-8 text-lg rounded-xl touch-target-xl',
        icon: 'h-11 w-11 rounded-lg touch-target-large',
        'icon-sm': 'h-10 w-10 rounded-md touch-target',
        'icon-lg': 'h-12 w-12 rounded-lg touch-target-large',
      },
      loading: {
        true: 'cursor-not-allowed',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      loading: false,
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant,
    size,
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    children,
    disabled,
    ...props
  }, ref) => {
    const isDisabled = disabled || loading;

    return (
      <button
        className={cn(
          buttonVariants({ variant, size, loading, className }),
          fullWidth && 'w-full'
        )}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {/* Loading spinner */}
        {loading && (
          <div className="loader-inline-sm"></div>
        )}

        {/* Left icon */}
        {!loading && leftIcon && (
          <span className="flex-shrink-0">
            {leftIcon}
          </span>
        )}

        {/* Button content */}
        {children && (
          <span className={loading ? 'opacity-70' : ''}>
            {children}
          </span>
        )}

        {/* Right icon */}
        {!loading && rightIcon && (
          <span className="flex-shrink-0">
            {rightIcon}
          </span>
        )}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }

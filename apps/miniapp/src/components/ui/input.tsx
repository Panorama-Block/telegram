import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/utils'

const inputVariants = cva(
  // Base styles using PanoramaBlock Design System v2.0
  'flex w-full border transition-all focus:outline-none focus-ring disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-pano-text-muted file:border-0 file:bg-transparent file:text-sm file:font-medium touch-target touch-action-manipulation',
  {
    variants: {
      variant: {
        // Default - Surface com border sutil
        default: 'bg-pano-surface border-pano-border text-pano-text-primary focus:border-pano-primary focus:bg-pano-surface-elevated hover:border-pano-primary/50',

        // Filled - Background mais escuro
        filled: 'bg-pano-surface-elevated border-transparent text-pano-text-primary focus:border-pano-primary focus:bg-pano-surface hover:bg-pano-surface',

        // Underlined - Apenas border bottom
        underlined: 'bg-transparent border-0 border-b-2 border-pano-border rounded-none text-pano-text-primary focus:border-pano-primary hover:border-pano-primary/50',

        // Glass - Efeito glass morphism
        glass: 'glass text-pano-text-primary border-pano-border/30 focus:border-pano-primary backdrop-blur-md hover:glass-dark',

        // Ghost - Transparente com hover
        ghost: 'bg-transparent border-transparent text-pano-text-primary hover:bg-pano-surface focus:bg-pano-surface focus:border-pano-border',
      },
      size: {
        // Tamanhos otimizados para touch e desktop
        sm: 'h-10 px-3 text-sm rounded-md',
        md: 'h-11 px-4 text-sm rounded-lg',  // default
        lg: 'h-12 px-4 text-base rounded-lg',
        xl: 'h-14 px-6 text-lg rounded-xl',
      },
      state: {
        // Estados visuais para feedback
        default: '',
        error: 'border-pano-error focus:border-pano-error focus:ring-pano-error/20 text-pano-error',
        success: 'border-pano-success focus:border-pano-success focus:ring-pano-success/20',
        warning: 'border-pano-warning focus:border-pano-warning focus:ring-pano-warning/20',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      state: 'default',
    },
  }
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  leftElement?: React.ReactNode
  rightElement?: React.ReactNode
  helperText?: string
  errorMessage?: string
  label?: string
  isLoading?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({
    className,
    type = 'text',
    variant,
    size,
    state,
    leftIcon,
    rightIcon,
    leftElement,
    rightElement,
    helperText,
    errorMessage,
    label,
    isLoading = false,
    id,
    ...props
  }, ref) => {
    const generatedId = React.useId()
    const inputId = id || generatedId
    const isError = state === 'error' || !!errorMessage
    const finalState = isError ? 'error' : state

    return (
      <div className="space-y-2">
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-pano-text-primary"
          >
            {label}
          </label>
        )}

        {/* Input Container */}
        <div className="relative">
          {/* Left Icon/Element */}
          {leftIcon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-pano-text-muted pointer-events-none">
              {leftIcon}
            </div>
          )}
          {leftElement && (
            <div className="absolute left-0 top-1/2 transform -translate-y-1/2">
              {leftElement}
            </div>
          )}

          {/* Input Field */}
          <input
            id={inputId}
            type={type}
            className={cn(
              inputVariants({ variant, size, state: finalState }),
              {
                'pl-10': leftIcon && !leftElement,
                'pr-10': (rightIcon && !rightElement) || isLoading,
              },
              className
            )}
            ref={ref}
            disabled={isLoading || props.disabled}
            {...props}
          />

          {/* Loading Spinner */}
          {isLoading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <svg
                className="animate-spin h-4 w-4 text-pano-text-muted"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          )}

          {/* Right Icon/Element */}
          {!isLoading && rightIcon && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-pano-text-muted pointer-events-none">
              {rightIcon}
            </div>
          )}
          {!isLoading && rightElement && (
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
              {rightElement}
            </div>
          )}
        </div>

        {/* Helper Text / Error Message */}
        {(helperText || errorMessage) && (
          <p
            className={cn(
              'text-xs',
              isError
                ? 'text-pano-error'
                : 'text-pano-text-muted'
            )}
          >
            {errorMessage || helperText}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input, inputVariants }

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/utils'
import '@/shared/ui/loader.css'

const textareaVariants = cva(
  // Base styles using PanoramaBlock Design System v2.0
  'flex w-full border transition-all focus:outline-none focus-ring disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-pano-text-muted resize-y min-h-[80px] touch-action-manipulation',
  {
    variants: {
      variant: {
        // Default - Surface com border sutil
        default: 'bg-pano-surface border-pano-border text-pano-text-primary focus:border-pano-primary focus:bg-pano-surface-elevated hover:border-pano-primary/50',

        // Filled - Background mais escuro
        filled: 'bg-pano-surface-elevated border-transparent text-pano-text-primary focus:border-pano-primary focus:bg-pano-surface hover:bg-pano-surface',

        // Glass - Efeito glass morphism
        glass: 'glass text-pano-text-primary border-pano-border/30 focus:border-pano-primary backdrop-blur-md hover:glass-dark',

        // Ghost - Transparente com hover
        ghost: 'bg-transparent border-transparent text-pano-text-primary hover:bg-pano-surface focus:bg-pano-surface focus:border-pano-border',
      },
      size: {
        // Tamanhos diferentes
        sm: 'p-3 text-sm rounded-md min-h-[60px]',
        md: 'p-4 text-sm rounded-lg min-h-[80px]',  // default
        lg: 'p-4 text-base rounded-lg min-h-[120px]',
        xl: 'p-6 text-lg rounded-xl min-h-[160px]',
      },
      state: {
        // Estados visuais para feedback
        default: '',
        error: 'border-pano-error focus:border-pano-error focus:ring-pano-error/20',
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

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {
  helperText?: string
  errorMessage?: string
  label?: string
  isLoading?: boolean
  maxLength?: number
  showCount?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({
    className,
    variant,
    size,
    state,
    helperText,
    errorMessage,
    label,
    isLoading = false,
    maxLength,
    showCount = false,
    value,
    id,
    ...props
  }, ref) => {
    const generatedId = React.useId()
    const textareaId = id || generatedId
    const isError = state === 'error' || !!errorMessage
    const finalState = isError ? 'error' : state
    const currentLength = typeof value === 'string' ? value.length : 0

    return (
      <div className="space-y-2">
        {/* Label */}
        {label && (
          <div className="flex items-center justify-between">
            <label
              htmlFor={textareaId}
              className="text-sm font-medium text-pano-text-primary"
            >
              {label}
            </label>
            {showCount && maxLength && (
              <span className={cn(
                'text-xs',
                currentLength > maxLength * 0.9
                  ? 'text-pano-warning'
                  : 'text-pano-text-muted'
              )}>
                {currentLength}/{maxLength}
              </span>
            )}
          </div>
        )}

        {/* Textarea Container */}
        <div className="relative">
          {/* Textarea Field */}
          <textarea
            id={textareaId}
            className={cn(
              textareaVariants({ variant, size, state: finalState }),
              isLoading && 'pr-10',
              className
            )}
            ref={ref}
            disabled={isLoading || props.disabled}
            maxLength={maxLength}
            value={value}
            {...props}
          />

          {/* Loading Spinner */}
          {isLoading && (
            <div className="absolute right-3 top-3">
              <div className="loader-inline-sm" />
            </div>
          )}
        </div>

        {/* Helper Text / Error Message / Character Count */}
        <div className="flex items-center justify-between">
          <div>
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
          {showCount && maxLength && !label && (
            <span className={cn(
              'text-xs',
              currentLength > maxLength * 0.9
                ? 'text-pano-warning'
                : 'text-pano-text-muted'
            )}>
              {currentLength}/{maxLength}
            </span>
          )}
        </div>
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea, textareaVariants }
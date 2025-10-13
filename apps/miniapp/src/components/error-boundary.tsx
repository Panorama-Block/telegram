'use client'

import React, { Component, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  resetOnPropsChange?: boolean
  resetKeys?: Array<string | number>
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    this.setState({
      error,
      errorInfo,
    })

    // Call the onError callback if provided
    this.props.onError?.(error, errorInfo)

    // Send error to analytics/monitoring service
    if (typeof window !== 'undefined') {
      // You can integrate with services like Sentry, LogRocket, etc.
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      })
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetOnPropsChange, resetKeys } = this.props
    const { hasError } = this.state

    // Reset error boundary when resetKeys change
    if (hasError && resetOnPropsChange && resetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (resetKey, index) => prevProps.resetKeys?.[index] !== resetKey
      )

      if (hasResetKeyChanged) {
        this.resetErrorBoundary()
      }
    }
  }

  resetErrorBoundary = () => {
    // Clear any existing timeout
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }

    // Add a small delay to prevent immediate re-rendering issues
    this.resetTimeoutId = window.setTimeout(() => {
      this.setState({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
      })
    }, 100)
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }
  }

  render() {
    const { hasError, error } = this.state
    const { children, fallback } = this.props

    if (hasError) {
      // If a custom fallback is provided, use it
      if (fallback) {
        return fallback
      }

      // Default error UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <Card variant="outlined" className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-pano-error">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-pano-text-secondary">
                We're sorry, but something unexpected happened. Please try again.
              </p>

              {process.env.NODE_ENV === 'development' && error && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-pano-text-secondary hover:text-pano-text-primary">
                    Error Details (Development Only)
                  </summary>
                  <div className="mt-2 p-3 bg-pano-surface-elevated rounded-md">
                    <p className="text-xs font-mono text-pano-error break-all">
                      {error.message}
                    </p>
                    {error.stack && (
                      <pre className="mt-2 text-xs font-mono text-pano-text-muted overflow-x-auto whitespace-pre-wrap">
                        {error.stack}
                      </pre>
                    )}
                  </div>
                </details>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={this.resetErrorBoundary}
                  size="sm"
                  className="flex-1"
                >
                  Try Again
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  Reload Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return children
  }
}

// React Hook version for functional components
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null)

  const resetError = React.useCallback(() => {
    setError(null)
  }, [])

  const captureError = React.useCallback((error: Error) => {
    setError(error)
  }, [])

  React.useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])

  return {
    captureError,
    resetError,
  }
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}

// Async error boundary for handling async errors
export function AsyncErrorBoundary({ children, ...props }: ErrorBoundaryProps) {
  const [asyncError, setAsyncError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setAsyncError(new Error(event.reason))
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  React.useEffect(() => {
    if (asyncError) {
      throw asyncError
    }
  }, [asyncError])

  return (
    <ErrorBoundary {...props}>
      {children}
    </ErrorBoundary>
  )
}

// Error fallback components
export function ErrorFallback({
  error,
  resetError,
  message = 'Something went wrong',
}: {
  error?: Error
  resetError?: () => void
  message?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-pano-error/10 flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-pano-error">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-pano-text-primary">{message}</h3>
        <p className="text-sm text-pano-text-secondary mt-1">
          Please try again or contact support if the problem persists.
        </p>
      </div>
      {resetError && (
        <Button onClick={resetError} size="sm">
          Try Again
        </Button>
      )}
    </div>
  )
}

export function MinimalErrorFallback({ resetError }: { resetError?: () => void }) {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="text-center space-y-2">
        <p className="text-sm text-pano-text-secondary">Something went wrong</p>
        {resetError && (
          <Button onClick={resetError} size="xs" variant="outline">
            Retry
          </Button>
        )}
      </div>
    </div>
  )
}
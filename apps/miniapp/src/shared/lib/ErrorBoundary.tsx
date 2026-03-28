import React from 'react';

interface ErrorBoundaryState {
  error: unknown;
  hasError: boolean;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Label shown in the fallback UI (e.g. "Swap", "Portfolio") */
  section?: string;
  /** Optional custom fallback component */
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, hasError: false };
  }

  static getDerivedStateFromError(error: unknown) {
    return { error, hasError: true };
  }

  override componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.section ? `:${this.props.section}` : ''}]`,
      error instanceof Error ? error.message : String(error),
      info?.componentStack,
    );
  }

  private handleRetry = () => {
    this.setState({ error: null, hasError: false });
  };

  override render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const section = this.props.section ?? 'This section';
      return React.createElement(
        'div',
        {
          style: {
            padding: 24,
            textAlign: 'center' as const,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          },
        },
        React.createElement('p', {
          style: { color: '#a1a1aa', fontSize: 14, marginBottom: 12 },
        }, `${section} ran into an issue. Please try again.`),
        React.createElement(
          'button',
          {
            onClick: this.handleRetry,
            style: {
              padding: '8px 20px',
              borderRadius: 8,
              border: '1px solid #3f3f46',
              background: '#18181b',
              color: '#fafafa',
              fontSize: 14,
              cursor: 'pointer',
            },
          },
          'Try again',
        ),
      );
    }
    return this.props.children;
  }
}

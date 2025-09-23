import React from 'react';

interface ErrorBoundaryState {
  error: unknown;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  override componentDidCatch(error: unknown, info: React.ErrorInfo) {
    const pre = document.createElement('pre');
    pre.style.cssText = 'color:#f33;padding:12px;white-space:pre-wrap';
    pre.textContent = 'Render error: ' + (error instanceof Error ? error.stack : String(error)) + '\n' + (info?.componentStack || '');
    document.body.appendChild(pre);
  }

  override render(): React.ReactNode {
    if (this.state.error) {
      return React.createElement(
        'div',
        { style: { padding: 16, color: '#f33', fontFamily: 'system-ui' } },
        'Render error: ',
        String(this.state.error),
      );
    }
    return this.props.children;
  }
}

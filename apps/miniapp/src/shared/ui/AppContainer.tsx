import React from 'react';

interface AppContainerProps {
  children: React.ReactNode;
}

export function AppContainer({ children }: AppContainerProps) {
  return (
    <div
      style={{
        padding: 20,
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        color: 'var(--tg-theme-text-color, #000)',
      }}
    >
      {children}
    </div>
  );
}

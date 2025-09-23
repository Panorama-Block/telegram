import React from 'react';

interface SpinnerProps {
  size?: number;
}

export function Spinner({ size = 32 }: SpinnerProps) {
  const border = Math.max(2, Math.round(size / 12));
  const style: React.CSSProperties = {
    width: size,
    height: size,
    border: `${border}px solid #eee`,
    borderTopColor: 'var(--tg-theme-button-color, #007acc)',
    borderRadius: '50%',
    margin: '0 auto',
    animation: 'spin 1s linear infinite',
  };

  return (
    <div>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <div style={style} />
    </div>
  );
}

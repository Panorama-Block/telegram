import React from 'react';

interface CardProps {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  padding?: number;
  tone?: 'default' | 'muted';
}

export function Card({
  title,
  action,
  children,
  style,
  padding = 16,
  tone = 'default',
}: CardProps) {
  const background = tone === 'muted'
    ? 'var(--tg-theme-secondary-bg-color, #f6f7f9)'
    : 'var(--tg-theme-bg-color, #fff)';

  return (
    <div
      style={{
        marginTop: 16,
        background,
        borderRadius: 16,
        padding,
        border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 8px 20px rgba(15,23,42,0.08)',
        ...style,
      }}
    >
      {(title || action) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
          }}
        >
          {typeof title === 'string' ? <h3 style={{ margin: 0 }}>{title}</h3> : title}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export default Card;

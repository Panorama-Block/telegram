import React from 'react';

type Variant = 'primary' | 'outline' | 'accent' | 'ghost';
type Size = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--tg-theme-button-color, #007acc)',
    color: 'var(--tg-theme-button-text-color, #fff)',
    border: '1px solid transparent',
  },
  outline: {
    background: 'transparent',
    color: 'var(--tg-theme-button-color, #007acc)',
    border: '1px solid rgba(0,0,0,0.12)',
  },
  accent: {
    background: '#10b981',
    color: '#fff',
    border: '1px solid transparent',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--tg-theme-button-color, #007acc)',
    border: '1px solid transparent',
  },
};

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: {
    padding: '6px 12px',
    fontSize: 14,
    borderRadius: 8,
  },
  md: {
    padding: '10px 16px',
    fontSize: 15,
    borderRadius: 10,
  },
  lg: {
    padding: '14px 20px',
    fontSize: 16,
    borderRadius: 12,
  },
  icon: {
    padding: 10,
    fontSize: 14,
    borderRadius: 999,
  },
};

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  style,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const base: React.CSSProperties = {
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    width: block ? '100%' : undefined,
    transition: 'transform 0.15s ease, opacity 0.15s ease',
  };

  return (
    <button
      style={{
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...base,
        ...style,
      }}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Button;

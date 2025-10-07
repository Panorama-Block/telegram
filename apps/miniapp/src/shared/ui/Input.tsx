import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ style, ...rest }: InputProps) {
  return (
    <input
      style={{
        width: '100%',
        padding: '12px 14px',
        borderRadius: 12,
        border: '1px solid rgba(0,0,0,0.12)',
        background: 'var(--tg-theme-bg-color, #fff)',
        color: 'var(--tg-theme-text-color, #111)',
        fontSize: 16,
        fontWeight: 500,
        outline: 'none',
        boxShadow: 'none',
        transition: 'border-color 0.2s ease',
        ...style,
      }}
      {...rest}
    />
  );
}

export default Input;

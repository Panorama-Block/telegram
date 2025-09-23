import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ style, children, ...rest }: SelectProps) {
  return (
    <select
      style={{
        width: '100%',
        padding: '12px 14px',
        borderRadius: 12,
        border: '1px solid rgba(0,0,0,0.12)',
        background: 'var(--tg-theme-bg-color, #fff)',
        color: 'var(--tg-theme-text-color, #111)',
        fontSize: 15,
        fontWeight: 500,
        outline: 'none',
        appearance: 'none',
        backgroundImage:
          'linear-gradient(45deg, transparent 50%, var(--tg-theme-hint-color, #999) 50%), linear-gradient(135deg, var(--tg-theme-hint-color, #999) 50%, transparent 50%)',
        backgroundPosition: 'calc(100% - 18px) calc(50% - 3px), calc(100% - 13px) calc(50% - 3px)',
        backgroundSize: '6px 6px, 6px 6px',
        backgroundRepeat: 'no-repeat',
        ...style,
      }}
      {...rest}
    >
      {children}
    </select>
  );
}

export default Select;

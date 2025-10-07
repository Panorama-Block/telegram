import React from 'react';

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export function Label({ style, children, ...rest }: LabelProps) {
  return (
    <label
      style={{
        display: 'block',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--tg-theme-hint-color, #666)',
        marginBottom: 6,
        ...style,
      }}
      {...rest}
    >
      {children}
    </label>
  );
}

export default Label;

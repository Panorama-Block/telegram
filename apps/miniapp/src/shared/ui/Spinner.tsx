import React from 'react';
import './loader.css';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const loaderClass = size === 'sm' ? 'loader-inline-sm' : size === 'lg' ? 'loader-inline-lg' : 'loader-inline-md';

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <div className={loaderClass}></div>
    </div>
  );
}

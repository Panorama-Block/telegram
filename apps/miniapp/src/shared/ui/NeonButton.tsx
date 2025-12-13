'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/shared/lib/utils';

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

export const NeonButton = forwardRef<HTMLButtonElement, NeonButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'w-full bg-pano-primary text-pano-text-inverse font-bold py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(34,211,238,0.35)] hover:shadow-[0_0_28px_rgba(34,211,238,0.45)] hover:scale-[1.01] active:scale-[0.99]',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

NeonButton.displayName = 'NeonButton';

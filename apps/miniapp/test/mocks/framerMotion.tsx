import React from 'react';

export const mockMotionElement = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
  <div {...props}>{children}</div>
);

export const motion = new Proxy(
  {},
  {
    get: () => mockMotionElement,
  },
) as Record<string, typeof mockMotionElement>;

export const AnimatePresence = ({ children }: React.PropsWithChildren) => <>{children}</>;

/**
 * PanoramaBlock Design System v2.0
 * TypeScript utilities and types for the design system
 */

// Design system tokens
export const tokens = {
  colors: {
    // Base colors
    bgPrimary: 'hsl(var(--pano-bg-primary))',
    bgSecondary: 'hsl(var(--pano-bg-secondary))',
    bgTertiary: 'hsl(var(--pano-bg-tertiary))',
    surface: 'hsl(var(--pano-surface))',
    surfaceElevated: 'hsl(var(--pano-surface-elevated))',
    border: 'hsl(var(--pano-border))',
    borderSubtle: 'hsl(var(--pano-border-subtle))',

    // Accent colors
    primary: 'hsl(var(--pano-primary))',
    primaryMuted: 'hsl(var(--pano-primary-muted))',
    primaryHover: 'hsl(var(--pano-primary-hover))',
    secondary: 'hsl(var(--pano-secondary))',
    success: 'hsl(var(--pano-success))',
    warning: 'hsl(var(--pano-warning))',
    error: 'hsl(var(--pano-error))',

    // Text colors
    textPrimary: 'hsl(var(--pano-text-primary))',
    textSecondary: 'hsl(var(--pano-text-secondary))',
    textMuted: 'hsl(var(--pano-text-muted))',
    textAccent: 'hsl(var(--pano-text-accent))',
    textInverse: 'hsl(var(--pano-text-inverse))',
  },

  spacing: {
    px: '1px',
    0: '0px',
    0.5: '0.125rem',
    1: '0.25rem',
    1.5: '0.375rem',
    2: '0.5rem',
    2.5: '0.625rem',
    3: '0.75rem',
    3.5: '0.875rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    7: '1.75rem',
    8: '2rem',
    9: '2.25rem',
    10: '2.5rem',
    11: '2.75rem',
    12: '3rem',
    14: '3.5rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
    28: '7rem',
    32: '8rem',
  },

  borderRadius: {
    none: '0px',
    sm: '0.125rem',
    DEFAULT: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    '3xl': '1.5rem',
    full: '9999px',
  },

  shadows: {
    sm: 'var(--pano-shadow-sm)',
    md: 'var(--pano-shadow-md)',
    lg: 'var(--pano-shadow-lg)',
    glow: 'var(--pano-shadow-glow)',
  },

  transitions: {
    fast: 'var(--pano-transition-fast)',
    base: 'var(--pano-transition-base)',
    slow: 'var(--pano-transition-slow)',
  },

  breakpoints: {
    xs: '375px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
} as const;

// Component variant types
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export type InputVariant = 'default' | 'filled' | 'underlined';
export type InputSize = 'sm' | 'md' | 'lg';
export type InputState = 'default' | 'error' | 'success';

export type CardVariant = 'default' | 'elevated' | 'bordered' | 'glass';
export type CardPadding = 'sm' | 'md' | 'lg';
export type CardRounded = 'sm' | 'md' | 'lg' | 'xl';

// Utility functions
export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};

// Responsive utilities
export const responsive = {
  mobile: `(max-width: ${tokens.breakpoints.md})`,
  tablet: `(min-width: ${tokens.breakpoints.md}) and (max-width: ${tokens.breakpoints.lg})`,
  desktop: `(min-width: ${tokens.breakpoints.lg})`,
  touch: '(pointer: coarse)',
  mouse: '(pointer: fine)',
};

// Animation presets
export const animations = {
  fadeIn: 'animate-[fadeIn_250ms_ease-out]',
  slideUp: 'animate-[slideUp_250ms_ease-out]',
  slideDown: 'animate-[slideDown_250ms_ease-out]',
  scaleIn: 'animate-[scaleIn_250ms_ease-out]',
  pulseGlow: 'animate-[pulseGlow_2s_ease-in-out_infinite]',
  shimmer: 'animate-[shimmer_2s_linear_infinite]',
  float: 'animate-[float_3s_ease-in-out_infinite]',
  spin: 'animate-[spin_1s_linear_infinite]',
} as const;

// CSS-in-JS style objects
export const styles = {
  glass: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  glassDark: {
    background: 'rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  interactive: {
    transition: tokens.transitions.base,
    cursor: 'pointer',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: tokens.shadows.lg,
    },
    ':active': {
      transform: 'translateY(0)',
    },
  },
} as const;

// Component class generators
export const button = {
  base: 'inline-flex items-center justify-center rounded-lg font-medium transition-all focus-ring disabled:opacity-50 disabled:cursor-not-allowed',

  variant: {
    primary: 'bg-pano-primary text-pano-text-inverse hover:bg-pano-primary-hover shadow-md hover:shadow-lg',
    secondary: 'bg-pano-surface text-pano-text-primary border border-pano-border hover:bg-pano-surface-elevated',
    ghost: 'text-pano-text-primary hover:bg-pano-surface',
    danger: 'bg-pano-error text-pano-text-inverse hover:opacity-90',
  },

  size: {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
    xl: 'h-14 px-8 text-lg',
  },
};

export const input = {
  base: 'w-full rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-pano-primary/50',

  variant: {
    default: 'bg-pano-surface border-pano-border text-pano-text-primary',
    filled: 'bg-pano-surface-elevated border-transparent text-pano-text-primary',
    underlined: 'bg-transparent border-0 border-b-2 border-pano-border rounded-none text-pano-text-primary',
  },

  size: {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-4 text-base',
  },

  state: {
    default: '',
    error: 'border-pano-error focus:ring-pano-error/50',
    success: 'border-pano-success focus:ring-pano-success/50',
  },
};

export const card = {
  base: 'rounded-lg border border-pano-border bg-pano-surface',

  variant: {
    default: '',
    elevated: 'shadow-lg',
    bordered: 'border-2',
    glass: 'glass-dark backdrop-blur-md',
  },

  padding: {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  },

  rounded: {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
  },
};

// Utility class builders
export const buildButtonClasses = (
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  additionalClasses?: string
): string => {
  return cn(
    button.base,
    button.variant[variant],
    button.size[size],
    additionalClasses
  );
};

export const buildInputClasses = (
  variant: InputVariant = 'default',
  size: InputSize = 'md',
  state: InputState = 'default',
  additionalClasses?: string
): string => {
  return cn(
    input.base,
    input.variant[variant],
    input.size[size],
    input.state[state],
    additionalClasses
  );
};

export const buildCardClasses = (
  variant: CardVariant = 'default',
  padding: CardPadding = 'md',
  rounded: CardRounded = 'lg',
  additionalClasses?: string
): string => {
  return cn(
    card.base,
    card.variant[variant],
    card.padding[padding],
    card.rounded[rounded],
    additionalClasses
  );
};
import React from 'react';
import { Button } from './Button';

type ErrorCategory = 'user-action' | 'temporary' | 'blocked' | 'unknown';

type SecondaryAction =
  | {
    type: 'support' | 'docs';
    label: string;
    href?: string;
    onClick?: () => void;
  }
  | undefined;

const categoryTheme: Record<
  ErrorCategory,
  {
    background: string;
    border: string;
    accent: string;
    icon: string;
  }
> = {
  'user-action': {
    background: 'rgba(249, 115, 22, 0.08)',
    border: 'rgba(249, 115, 22, 0.24)',
    accent: '#f97316',
    icon: '⚠️',
  },
  temporary: {
    background: 'rgba(37, 99, 235, 0.08)',
    border: 'rgba(37, 99, 235, 0.24)',
    accent: '#2563eb',
    icon: '🔄',
  },
  blocked: {
    background: 'rgba(239, 68, 68, 0.08)',
    border: 'rgba(239, 68, 68, 0.24)',
    accent: '#ef4444',
    icon: '⛔',
  },
  unknown: {
    background: 'rgba(59, 130, 246, 0.08)',
    border: 'rgba(59, 130, 246, 0.18)',
    accent: '#64748b',
    icon: '💡',
  },
};

export interface ErrorStateCardProps {
  title: string;
  description: string;
  category: ErrorCategory;
  primaryLabel: string;
  onPrimaryAction: () => void;
  primaryDisabled?: boolean;
  secondaryAction?: SecondaryAction;
  traceId?: string;
  retryAfterSeconds?: number;
}

export function ErrorStateCard({
  title,
  description,
  category,
  primaryLabel,
  onPrimaryAction,
  primaryDisabled = false,
  secondaryAction,
  traceId,
  retryAfterSeconds,
}: ErrorStateCardProps) {
  const theme = categoryTheme[category] || categoryTheme.unknown;
  const hint =
    typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0
      ? `Please wait ~${retryAfterSeconds}s before trying again.`
      : undefined;

  return (
    <div
      style={{
        marginTop: 16,
        padding: 20,
        borderRadius: 16,
        background: theme.background,
        border: `1px solid ${theme.border}`,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 24, lineHeight: '24px' }} aria-hidden>
          {theme.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <h4
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--tg-theme-text-color, #111827)',
              }}
            >
              {title}
            </h4>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: theme.accent,
                textTransform: 'uppercase',
                letterSpacing: 1,
                alignSelf: 'center',
              }}
            >
              {category}
            </span>
          </div>
          <p
            style={{
              margin: '8px 0 16px',
              fontSize: 14,
              lineHeight: 1.4,
              color: 'var(--tg-theme-hint-color, #4b5563)',
            }}
          >
            {description}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Button
              onClick={onPrimaryAction}
              variant="primary"
              size="lg"
              disabled={primaryDisabled}
            >
              {primaryLabel}
            </Button>
            {secondaryAction && secondaryAction.label && (
              secondaryAction.onClick ? (
                <button
                  onClick={secondaryAction.onClick}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.accent,
                    textAlign: 'center',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  {secondaryAction.label}
                </button>
              ) : (
                <a
                  href={secondaryAction.href || '#'}
                  target={secondaryAction.href ? '_blank' : undefined}
                  rel={secondaryAction.href ? 'noreferrer' : undefined}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.accent,
                    textAlign: 'center',
                    textDecoration: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {secondaryAction.label}
                </a>
              )
            )}
            {hint && (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--tg-theme-hint-color, #6b7280)',
                  textAlign: 'center',
                }}
              >
                {hint}
              </span>
            )}
            {traceId && (
              <span
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: 'var(--tg-theme-hint-color, #94a3b8)',
                  textAlign: 'center',
                  wordBreak: 'break-all',
                }}
              >
                Trace ID: {traceId}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ErrorStateCard;

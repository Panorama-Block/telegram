export const TAC_API_BASE = process.env.NEXT_PUBLIC_TAC_API_BASE || '';
export const TAC_WS_BASE = process.env.NEXT_PUBLIC_TAC_WS_BASE || '';

function normalizeTacBase(raw: string): string {
  const trimmed = raw.replace(/\/+$/, '');
  if (trimmed.endsWith('/api/tac')) return trimmed;
  return `${trimmed}/api/tac`;
}

// Base TAC API URL (absolute preferred)
export function tacBaseUrl(): string {
  if (TAC_API_BASE) return normalizeTacBase(TAC_API_BASE);

  if (typeof window !== 'undefined' && window.location?.origin) {
    // avoid inheriting /miniapp path
    return `${window.location.origin.replace(/\/+$/, '')}/api/tac`;
  }

  return '/api/tac';
}

// Root (non-API) base, derived from TAC API URL
export function tacRootUrl(): string {
  const base = tacBaseUrl();

  if (base.startsWith('http')) {
    try {
      return new URL(base).origin;
    } catch {
      return base.replace(/\/api\/tac$/, '');
    }
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }

  return '';
}

export function tacSocketUrl(): string {
  if (TAC_WS_BASE) return TAC_WS_BASE.replace(/\/+$/, '');
  return '';
}

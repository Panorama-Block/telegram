/**
 * Maps backend error codes/messages to user-friendly messages.
 * Both API clients use this to avoid exposing technical details.
 */

const ERROR_MAP: Record<string, string> = {
  // Auth
  'UNAUTHORIZED': 'Session expired. Please reconnect your wallet.',
  'TOKEN_EXPIRED': 'Session expired. Please reconnect your wallet.',
  'INVALID_SIGNATURE': 'Signature verification failed. Please try again.',

  // Balance / amounts
  'INSUFFICIENT_BALANCE': 'Insufficient balance for this operation.',
  'INSUFFICIENT_COLLATERAL': 'Insufficient collateral. Deposit more before borrowing.',
  'INSUFFICIENT_LIQUIDITY': 'Not enough liquidity in the protocol right now.',
  'INVALID_AMOUNT': 'Please enter a valid amount.',
  'AMOUNT_TOO_SMALL': 'Amount is too small for this operation.',
  'AMOUNT_TOO_LARGE': 'Amount exceeds the maximum allowed.',

  // Transaction
  'GAS_ESTIMATION_FAILED': 'Could not estimate gas. The transaction may fail.',
  'TRANSACTION_REVERTED': 'Transaction would fail on-chain. Check your balance and try again.',
  'NONCE_TOO_LOW': 'Transaction conflict. Please wait and try again.',

  // Rate limiting
  'RATE_LIMITED': 'Too many requests. Please wait a moment.',
  'TOO_MANY_REQUESTS': 'Too many requests. Please wait a moment.',

  // Network
  'RPC_ERROR': 'Network error. The blockchain node is temporarily unavailable.',
  'NETWORK_ERROR': 'Connection error. Please check your internet connection.',
  'SERVICE_UNAVAILABLE': 'Service is temporarily unavailable. Please try again later.',
  'TIMEOUT': 'Request timed out. Please try again.',

  // Validation contract
  'TAX_TRANSFER_FAILED': 'Validation fee transfer failed. Please try again.',
  'NO_AVAX_SENT': 'No AVAX was sent with the transaction.',

  // Lending specific
  'HEALTH_FACTOR_TOO_LOW': 'This operation would put your position at risk of liquidation.',
  'MARKET_NOT_FOUND': 'Market not found. The token may not be supported.',
  'BORROW_CAP_REACHED': 'Borrow cap reached for this market.',
};

/**
 * Attempt to extract an error code from a backend response.
 * Supports formats: { code: "..." }, { error: { code: "..." } }, plain string matching.
 */
function extractCode(error: unknown): string | null {
  if (!error) return null;

  // Object with code field
  if (typeof error === 'object') {
    const obj = error as Record<string, any>;
    if (obj.code && typeof obj.code === 'string') return obj.code;
    if (obj.error?.code && typeof obj.error.code === 'string') return obj.error.code;
  }

  // Try matching known codes in the error message string
  const message = typeof error === 'string' ? error : (error as Error)?.message || '';
  for (const code of Object.keys(ERROR_MAP)) {
    if (message.toUpperCase().includes(code)) return code;
  }

  return null;
}

/**
 * Map a backend error to a user-friendly message.
 * Falls back to a generic message if no mapping is found.
 */
export function mapError(error: unknown, fallback?: string): string {
  const code = extractCode(error);
  if (code && ERROR_MAP[code]) {
    return ERROR_MAP[code];
  }

  // HTTP status-based fallbacks
  if (typeof error === 'object' && error !== null) {
    const status = (error as any).status;
    if (status === 401 || status === 403) return ERROR_MAP.UNAUTHORIZED;
    if (status === 429) return ERROR_MAP.RATE_LIMITED;
    if (status === 503) return ERROR_MAP.SERVICE_UNAVAILABLE;
  }

  return fallback || 'Something went wrong. Please try again.';
}

/**
 * Check if an error indicates the user should re-authenticate.
 */
export function isAuthError(error: unknown): boolean {
  const code = extractCode(error);
  if (code === 'UNAUTHORIZED' || code === 'TOKEN_EXPIRED') return true;

  if (typeof error === 'object' && error !== null) {
    const status = (error as any).status;
    if (status === 401) return true;
  }

  return false;
}

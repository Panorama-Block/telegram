import type {
  PrepareRequest,
  PrepareResponse,
  QuoteRequest,
  QuoteResponse,
  StatusResponse,
  UserFacingErrorDetails,
  UserFacingErrorResponse,
} from './types';

export class SwapApiError extends Error {
  readonly url: string;
  readonly payload?: unknown;
  readonly status?: number;
  readonly responseBody?: unknown;
  readonly traceId?: string;
  readonly userFacingError?: UserFacingErrorDetails;

  constructor(message: string, options: {
    url: string;
    payload?: unknown;
    status?: number;
    responseBody?: unknown;
    cause?: unknown;
    traceId?: string;
    userFacingError?: UserFacingErrorDetails;
  }) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'SwapApiError';
    this.url = options.url;
    this.payload = options.payload;
    this.status = options.status;
    this.responseBody = options.responseBody;
    this.traceId = options.traceId;
    this.userFacingError = options.userFacingError;
  }
}

const UNKNOWN_ERROR = 'Swap API error';

function baseUrl(): string {
  const direct = (
    (process.env.VITE_SWAP_API_BASE as string | undefined) ||
    (process.env.NEXT_PUBLIC_SWAP_API_BASE as string | undefined) ||
    (process.env.SWAP_API_BASE as string | undefined)
  );
  if (direct && direct.length > 0) {
    const trimmed = direct.replace(/\/+$/, '');
    // Support envs pointing either at the service root (http://localhost:3002)
    // or already at the mounted swap path (http://localhost:3002/swap).
    return trimmed.endsWith('/swap') ? trimmed : `${trimmed}/swap`;
  }
  const gw = process.env.VITE_GATEWAY_BASE as string | undefined;
  if (gw && gw.length > 0) return `${gw.replace(/\/+$/, '')}/swap`;
  // fallback to same-origin proxy (Next rewrites -> swap service)
  return '/api/swap';
}

function isUserFacingErrorPayload(body: unknown): body is UserFacingErrorResponse {
  if (!body || typeof body !== 'object') return false;
  const candidate = body as Record<string, unknown>;
  if (candidate.success !== false) return false;
  const error = candidate.error;
  if (!error || typeof error !== 'object') return false;
  const e = error as Record<string, unknown>;
  return (
    typeof e.title === 'string' &&
    typeof e.description === 'string' &&
    typeof e.code === 'string' &&
    typeof e.category === 'string' &&
    typeof e.traceId === 'string' &&
    typeof e.actions === 'object'
  );
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

function deriveErrorMessage(
  fallbackStatus: number | undefined,
  parsed: unknown,
  userFacing?: UserFacingErrorDetails
): string {
  if (userFacing) {
    return userFacing.title || userFacing.description || UNKNOWN_ERROR;
  }
  if (parsed && typeof parsed === 'object') {
    const m = (parsed as any).message || (parsed as any).error;
    if (typeof m === 'string' && m.trim().length > 0) {
      return m;
    }
  }
  return fallbackStatus ? `${UNKNOWN_ERROR}: ${fallbackStatus}` : `${UNKNOWN_ERROR}`;
}

async function handleJsonResponse<T>(
  res: Response,
  url: string,
  payload?: unknown
): Promise<T> {
  const traceId = res.headers.get('x-trace-id') || undefined;
  const parsed = await parseJsonSafe(res);
  const userFacing = isUserFacingErrorPayload(parsed) ? parsed.error : undefined;

  if (!res.ok || userFacing) {
    const message = deriveErrorMessage(res.status, parsed, userFacing);
    throw new SwapApiError(message, {
      url,
      payload,
      status: res.status,
      responseBody: parsed,
      traceId,
      userFacingError: userFacing,
    });
  }

  if (parsed === undefined) {
    throw new SwapApiError(`${UNKNOWN_ERROR}: empty response`, {
      url,
      payload,
      status: res.status,
      traceId,
    });
  }

  return parsed as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const url = `${baseUrl()}${path}`;
  
  const authToken = localStorage.getItem('authToken');
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  } else {
  }
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return await handleJsonResponse<T>(res, url, body);
  } catch (err) {
    if (err instanceof SwapApiError) throw err;
    throw new SwapApiError(`${UNKNOWN_ERROR}: network request failed`, {
      url,
      payload: body,
      cause: err,
    });
  }
}

async function getJson<T>(path: string): Promise<T> {
  const url = `${baseUrl()}${path}`;
  const headers: Record<string, string> = {};
  const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  try {
    const res = await fetch(url, { headers });
    return await handleJsonResponse<T>(res, url);
  } catch (err) {
    if (err instanceof SwapApiError) throw err;
    throw new SwapApiError(`${UNKNOWN_ERROR}: network request failed`, {
      url,
      cause: err,
    });
  }
}

export const swapApi = {
  quote(body: QuoteRequest) {
    // Runtime guardrails: prevent the common "wei passed as token" bug from silently producing nonsense quotes.
    try {
      const amount = String(body.amount ?? '').trim();
      if (body.unit === 'wei' && amount.includes('.')) {
        console.warn('[swapApi.quote] unit=wei but amount contains decimals. Did you mean unit=token?', body);
      }
      if (body.unit === 'token' && /^\d+$/.test(amount) && amount.length > 12) {
        console.warn('[swapApi.quote] unit=token but amount looks like wei (long integer). Did you mean unit=wei?', body);
      }
    } catch {}
    // baseUrl() already resolves to ".../swap" (or "/swap" on same origin)
    return postJson<QuoteResponse>('/quote', body);
  },
  prepare(body: PrepareRequest) {
    return postJson<PrepareResponse>('/tx', body);
  },
  status(hash: string, chainId: number) {
    const qs = new URLSearchParams({ chainId: String(chainId) }).toString();
    return getJson<StatusResponse>(`/status/${hash}?${qs}`);
  },
};

import type { PrepareRequest, PrepareResponse, QuoteRequest, QuoteResponse, StatusResponse } from './types';

export class SwapApiError extends Error {
  readonly url: string;
  readonly payload?: unknown;
  readonly status?: number;
  readonly responseBody?: unknown;

  constructor(message: string, options: {
    url: string;
    payload?: unknown;
    status?: number;
    responseBody?: unknown;
    cause?: unknown;
  }) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'SwapApiError';
    this.url = options.url;
    this.payload = options.payload;
    this.status = options.status;
    this.responseBody = options.responseBody;
  }
}

const UNKNOWN_ERROR = 'Swap API error';

function baseUrl(): string {
  const direct = (import.meta as any).env?.VITE_SWAP_API_BASE as string | undefined;
  if (direct && direct.length > 0) return direct.replace(/\/+$/, '');
  const gw = (import.meta as any).env?.VITE_GATEWAY_BASE as string | undefined;
  if (gw && gw.length > 0) return `${gw.replace(/\/+$/, '')}/swap`;
  // fallback to same-origin /swap
  return '/swap';
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const url = `${baseUrl()}${path}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let parsed: unknown;
      let msg = `${res.status}`;
      try {
        parsed = await res.json();
        msg = (parsed as any)?.message || (parsed as any)?.error || msg;
      } catch {}
      throw new SwapApiError(`${UNKNOWN_ERROR}: ${msg}`, {
        url,
        payload: body,
        status: res.status,
        responseBody: parsed,
      });
    }
    return res.json() as Promise<T>;
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
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new SwapApiError(`${UNKNOWN_ERROR}: ${res.status}`, { url, status: res.status });
    }
    return res.json() as Promise<T>;
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
    return postJson<QuoteResponse>('/swap/quote', body);
  },
  prepare(body: PrepareRequest) {
    return postJson<PrepareResponse>('/swap/tx', body);
  },
  status(hash: string, chainId: number) {
    const qs = new URLSearchParams({ chainId: String(chainId) }).toString();
    return getJson<StatusResponse>(`/swap/status/${hash}?${qs}`);
  },
};

'use client';

/**
 * Shared HTTP primitive for DeFi feature modules.
 *
 * Responsibilities:
 *   1. Resolve a base URL (env var → same-origin proxy fallback).
 *   2. Apply timeout + AbortController on every request.
 *   3. Delegate auth to `fetchWithAuth` (JWT + refresh).
 *   4. Validate successful JSON bodies against an optional Zod schema.
 *   5. Throw a single typed `DefiApiError` on non-2xx or network failure.
 *
 * Features can consume this two ways:
 *   - `createDefiHttp({ ... })` → returns a functional `{ get, post, … }`.
 *     Use for stateless API modules (e.g. swap).
 *   - Extend `DefiApiClient` → pass `this.http` around. Use for class-based
 *     features that need per-instance state (e.g. userAddress).
 */

import type { ZodType } from 'zod';
import { fetchWithAuth, generateTraceId } from './fetchWithAuth';
import { validateResponse } from './responseSchemas';

/* ───────────────────────── Types ──────────────────────────────── */

export interface DefiApiErrorOptions {
  url: string;
  payload?: unknown;
  status?: number;
  responseBody?: unknown;
  traceId?: string;
  cause?: unknown;
}

export class DefiApiError extends Error {
  readonly url: string;
  readonly payload?: unknown;
  readonly status?: number;
  readonly responseBody?: unknown;
  readonly traceId?: string;

  constructor(message: string, opts: DefiApiErrorOptions) {
    super(message, opts.cause ? { cause: opts.cause } : undefined);
    this.name = 'DefiApiError';
    this.url = opts.url;
    this.payload = opts.payload;
    this.status = opts.status;
    this.responseBody = opts.responseBody;
    this.traceId = opts.traceId;
  }
}

export interface DefiHttpConfig {
  /** Absolute base URL OR same-origin path (e.g. `/api/lending`). Trailing slashes are trimmed. */
  baseUrl: string;
  /** Short label for log prefix and error messages (e.g. `"lending"`). */
  label: string;
  /** Request timeout in ms. Defaults to 30_000. */
  timeoutMs?: number;
  /** If true, do not send `Authorization` header. Defaults to false. */
  anonymous?: boolean;
}

export interface FetchJsonInit {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /** Optional Zod schema; non-matching responses warn but still return parsed data. */
  schema?: ZodType<unknown>;
  /** External abort signal; composed with internal timeout. */
  signal?: AbortSignal;
  /** Override default timeout for this request. */
  timeoutMs?: number;
}

/* ──────────────────── Implementation ──────────────────────────── */

const DEFAULT_TIMEOUT_MS = 30_000;

function joinUrl(baseUrl: string, path: string): string {
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${normalizedPath}`;
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function deriveErrorMessage(
  label: string,
  status: number | undefined,
  parsed: unknown,
): string {
  if (parsed && typeof parsed === 'object') {
    const body = parsed as Record<string, unknown>;
    const direct = typeof body.message === 'string' ? body.message : undefined;
    const fromError =
      body.error && typeof body.error === 'object'
        ? (body.error as Record<string, unknown>).message
        : typeof body.error === 'string'
          ? body.error
          : undefined;
    const msg = direct ?? (typeof fromError === 'string' ? fromError : undefined);
    if (msg && msg.trim().length > 0) return msg;
  }
  return status ? `${label} API error: ${status}` : `${label} API error`;
}

class TimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`${label} request timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/** Races a fetch promise against a timeout. Returns the response or throws TimeoutError. */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, timeoutMs)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

export function createDefiHttp(config: DefiHttpConfig) {
  const timeoutDefault = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function fetchJson<T>(path: string, init: FetchJsonInit = {}): Promise<T> {
    const url = joinUrl(config.baseUrl, path);
    const method = init.method ?? 'GET';
    const timeoutMs = init.timeoutMs ?? timeoutDefault;

    const headers: Record<string, string> = {
      'X-Trace-Id': generateTraceId(),
      ...(init.headers ?? {}),
    };
    if (init.body !== undefined && !('content-type' in headers) && !('Content-Type' in headers)) {
      headers['content-type'] = 'application/json';
    }

    const requestInit: RequestInit = {
      method,
      headers,
      ...(init.signal ? { signal: init.signal } : {}),
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    };

    let res: Response;
    try {
      const fetchPromise = config.anonymous
        ? fetch(url, requestInit)
        : fetchWithAuth(url, requestInit);
      res = await withTimeout(fetchPromise, timeoutMs, config.label);
    } catch (err) {
      if (err instanceof DefiApiError) throw err;
      const timedOut =
        err instanceof Error &&
        (err.name === 'TimeoutError' || err.name === 'AbortError');
      const msg = timedOut
        ? `${config.label} request timed out after ${timeoutMs}ms`
        : `${config.label} network request failed`;
      throw new DefiApiError(msg, { url, payload: init.body, cause: err });
    }

    const traceId = res.headers.get('x-trace-id') || undefined;
    const parsed = await parseJsonSafe(res);

    if (!res.ok) {
      throw new DefiApiError(deriveErrorMessage(config.label, res.status, parsed), {
        url,
        payload: init.body,
        status: res.status,
        responseBody: parsed,
        traceId,
      });
    }

    if (init.schema) {
      const { data } = validateResponse(init.schema, parsed, `${config.label}:${path}`);
      return data as T;
    }
    return parsed as T;
  }

  return {
    get<T>(path: string, init?: Omit<FetchJsonInit, 'method' | 'body'>) {
      return fetchJson<T>(path, { ...init, method: 'GET' });
    },
    post<T>(path: string, body: unknown, init?: Omit<FetchJsonInit, 'method' | 'body'>) {
      return fetchJson<T>(path, { ...init, method: 'POST', body });
    },
    put<T>(path: string, body: unknown, init?: Omit<FetchJsonInit, 'method' | 'body'>) {
      return fetchJson<T>(path, { ...init, method: 'PUT', body });
    },
    patch<T>(path: string, body: unknown, init?: Omit<FetchJsonInit, 'method' | 'body'>) {
      return fetchJson<T>(path, { ...init, method: 'PATCH', body });
    },
    delete<T>(path: string, init?: Omit<FetchJsonInit, 'method' | 'body'>) {
      return fetchJson<T>(path, { ...init, method: 'DELETE' });
    },
    fetchJson,
  };
}

export type DefiHttp = ReturnType<typeof createDefiHttp>;

/**
 * Resolve a base URL with precedence: first non-empty env var wins,
 * then fall back to the same-origin proxy path.
 *
 * Use in feature modules to keep env var precedence local and explicit.
 */
export function resolveDefiBaseUrl(opts: {
  envCandidates: (string | undefined)[];
  proxyPath: string;
}): string {
  for (const candidate of opts.envCandidates) {
    if (candidate && candidate.trim().length > 0) {
      return candidate.trim().replace(/\/+$/, '');
    }
  }
  return opts.proxyPath;
}

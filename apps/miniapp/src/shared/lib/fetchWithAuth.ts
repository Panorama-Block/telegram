'use client';

/**
 * Fetch wrapper with automatic JWT token refresh on 401.
 *
 * Flow:
 * 1. Execute the original request with the current authToken
 * 2. If response is 401, attempt to refresh via auth-service
 * 3. If refresh succeeds, retry the original request with the new token
 * 4. If refresh fails, clear authToken and propagate the error
 */

const AUTH_API_BASE = (typeof process !== 'undefined' ? process.env.VITE_AUTH_API_BASE || '' : '').replace(/\/+$/, '');

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshSession(): Promise<string | null> {
  if (!AUTH_API_BASE) return null;

  try {
    const response = await fetch(`${AUTH_API_BASE}/auth/session/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // sends httpOnly refresh cookie
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.token) {
      localStorage.setItem('authToken', data.token);
      return data.token;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Attempt token refresh, deduplicating concurrent calls.
 */
function tryRefresh(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = refreshSession().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });

  return refreshPromise;
}

/**
 * Injects Authorization header into the provided headers.
 */
function injectAuthHeader(init: RequestInit, token: string): RequestInit {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers };
}

/**
 * Fetch with automatic token refresh on 401.
 *
 * Usage:
 * ```ts
 * const res = await fetchWithAuth('/api/lido/stake', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ ... }),
 * });
 * ```
 */
export async function fetchWithAuth(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  // First attempt
  const requestInit = token ? injectAuthHeader(init, token) : init;
  const response = await fetch(input, requestInit);

  if (response.status !== 401 || !token) {
    return response;
  }

  // Attempt refresh
  const newToken = await tryRefresh();
  if (!newToken) {
    // Refresh failed — clear stale token
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
    }
    return response; // return original 401
  }

  // Retry with new token
  return fetch(input, injectAuthHeader(init, newToken));
}

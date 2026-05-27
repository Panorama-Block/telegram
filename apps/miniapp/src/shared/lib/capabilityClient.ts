'use client';

/**
 * Capability-aware API client.
 *
 * Routes all backend calls through the gateway's /v1/capability/* namespace.
 * Auth calls go through /v1/capability/auth/* instead of direct auth-service URLs.
 * Discovery provides feature visibility — UI components can check if a capability
 * is available before rendering action buttons.
 */

import { generateTraceId } from './fetchWithAuth';

const GATEWAY_BASE = (
  typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_GATEWAY_URL || ''
    : ''
).replace(/\/+$/, '');

export interface CapabilityAvailability {
  capability: string;
  byChain: Record<string, Array<{ provider: string; healthy: boolean }>>;
}

export interface DiscoverySnapshot {
  capabilities: CapabilityAvailability[];
  generatedAt: string;
  cacheTtlSeconds: number;
}

let discoveryCache: { data: DiscoverySnapshot; ts: number } | null = null;
const CACHE_TTL_MS = 30_000;

export async function fetchDiscovery(force = false): Promise<DiscoverySnapshot> {
  if (!force && discoveryCache && Date.now() - discoveryCache.ts < CACHE_TTL_MS) {
    return discoveryCache.data;
  }

  const res = await fetch(`${GATEWAY_BASE}/v1/capability/_discovery`, {
    headers: { 'x-trace-id': generateTraceId() },
  });
  const json = await res.json();
  const data: DiscoverySnapshot = json.data ?? json;
  discoveryCache = { data, ts: Date.now() };
  return data;
}

export function isCapabilityAvailable(
  snapshot: DiscoverySnapshot,
  capability: string,
  chainId: number
): boolean {
  const cap = snapshot.capabilities.find((c) => c.capability === capability);
  if (!cap) return false;
  const providers = cap.byChain[String(chainId)] ?? [];
  return providers.some((p) => p.healthy);
}

export async function capabilityRequest<T = unknown>(
  capability: string,
  action: string,
  body: Record<string, unknown>,
  options: { authToken?: string; traceId?: string } = {}
): Promise<T> {
  const traceId = options.traceId ?? generateTraceId();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-trace-id': traceId,
  };
  if (options.authToken) headers['authorization'] = `Bearer ${options.authToken}`;

  const res = await fetch(`${GATEWAY_BASE}/v1/capability/${capability}/${action}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (json.status === 'error') {
    const err = json.error ?? {};
    throw new Error(err.message ?? `${capability}/${action} failed (${res.status})`);
  }
  return json.data as T;
}

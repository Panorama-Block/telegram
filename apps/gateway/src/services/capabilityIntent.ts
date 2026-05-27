/**
 * Intent builder — constructs CapabilityIntent-shaped payloads for the gateway
 * to dispatch to backend capability endpoints.
 *
 * Mirrors the Python CapabilityIntent from zico_agents but in TypeScript.
 * Used by Telegram bot callbacks that need to trigger DeFi actions.
 */

export type CapabilitySlug = 'swap' | 'lending' | 'staking' | 'liquidity' | 'bridge' | 'automation' | 'auth';

export interface CapabilityIntent {
  capability: CapabilitySlug;
  action: string;
  chainId: number;
  userAddress: string;
  payload: Record<string, unknown>;
  tenantId: string;
  traceId: string;
  idempotencyKey?: string;
}

export function buildIntent(
  capability: CapabilitySlug,
  action: string,
  opts: {
    chainId: number;
    userAddress: string;
    payload?: Record<string, unknown>;
    tenantId?: string;
    traceId?: string;
  }
): CapabilityIntent {
  return {
    capability,
    action,
    chainId: opts.chainId,
    userAddress: opts.userAddress,
    payload: opts.payload ?? {},
    tenantId: opts.tenantId ?? opts.userAddress.toLowerCase(),
    traceId: opts.traceId ?? crypto.randomUUID(),
  };
}

export function intentEndpoint(intent: CapabilityIntent): string {
  return `/v1/capability/${intent.capability}/${intent.action}`;
}

export function intentToRequestBody(intent: CapabilityIntent): Record<string, unknown> {
  return {
    tenantId: intent.tenantId,
    traceId: intent.traceId,
    chainId: intent.chainId,
    userAddress: intent.userAddress,
    payload: intent.payload,
    ...(intent.idempotencyKey && { idempotencyKey: intent.idempotencyKey }),
  };
}

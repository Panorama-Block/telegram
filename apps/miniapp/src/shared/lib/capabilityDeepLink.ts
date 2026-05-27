'use client';

/**
 * Generate Telegram mini-app deep links that encode a capability action.
 *
 * Format: t.me/<bot>?startapp=<base64(JSON)>
 * The miniapp parses startapp on load and routes to the appropriate feature.
 */

export interface CapabilityDeepLinkParams {
  capability: string;
  action: string;
  chainId: number;
  payload?: Record<string, unknown>;
}

export function encodeCapabilityDeepLink(
  botUsername: string,
  params: CapabilityDeepLinkParams
): string {
  const json = JSON.stringify({
    c: params.capability,
    a: params.action,
    ch: params.chainId,
    ...(params.payload && { p: params.payload }),
  });
  const encoded = btoa(json);
  return `https://t.me/${botUsername}?startapp=${encoded}`;
}

export function decodeCapabilityDeepLink(startapp: string): CapabilityDeepLinkParams | null {
  try {
    const json = atob(startapp);
    const parsed = JSON.parse(json);
    if (!parsed.c || !parsed.a || !parsed.ch) return null;
    return {
      capability: parsed.c,
      action: parsed.a,
      chainId: parsed.ch,
      payload: parsed.p,
    };
  } catch {
    return null;
  }
}

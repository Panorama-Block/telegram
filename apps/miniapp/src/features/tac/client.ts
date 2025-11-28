"use client";

import { tacBaseUrl, tacRootUrl } from '@/shared/config/tac';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

async function request<T>(path: string, options: { method?: HttpMethod; body?: any } = {}): Promise<T> {
  const base = tacBaseUrl();
  const url = `${base}${path}`;
  const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || 'TAC request failed');
  }
  return data as T;
}

export const tacApi = {
  quote(body: any) {
    return request('/quotes', { method: 'POST', body });
  },
  getOperation(id: string) {
    return request(`/operations/${id}`);
  },
  startOperation(body: any) {
    return request('/operations', { method: 'POST', body });
  },
  ensureEvmWallet(body: { telegramUserId?: string; tonAddress?: string; chainId: string; provision?: boolean; address?: string }) {
    const root = tacRootUrl();
    const base = tacBaseUrl();
    const targetRoot =
      root || (base.startsWith('http') ? base.replace(/\/+$/, '').replace(/\/api\/tac$/, '') : '');
    if (!targetRoot) {
      console.warn('[TAC API] No TAC root URL resolved. Check NEXT_PUBLIC_TAC_API_BASE or TAC gateway.');
    }
    console.log('[TAC API] ensureEvmWallet target root:', targetRoot, 'resolved root:', root, 'base:', base);
    const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    const url = `${targetRoot}/auth/wallet/evm`;
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
      },
      body: JSON.stringify(body)
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Failed to ensure EVM wallet');
      }
      return data;
    });
  }
};

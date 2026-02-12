'use client';

export interface ChatIdentityInput {
  accountAddress?: string | null;
  identityAddress?: string | null;
  tonAddress?: string | null;
  tonAddressRaw?: string | null;
  telegramUserId?: string | number | null;
}

export interface ResolvedChatIdentity {
  userId?: string;
  walletAddress?: string;
  source:
    | 'connected-wallet'
    | 'auth-token'
    | 'local-storage'
    | 'wallet-context'
    | 'telegram'
    | 'none';
}

function safeLower(value?: string | null): string | undefined {
  const normalized = (value || '').trim().toLowerCase();
  return normalized || undefined;
}

function readStoredWalletAddress(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const storedUserAddress = safeLower(localStorage.getItem('userAddress'));
  if (storedUserAddress) return storedUserAddress;

  const storedWalletAddress = safeLower(localStorage.getItem('walletAddress'));
  if (storedWalletAddress) return storedWalletAddress;

  const authPayload = localStorage.getItem('authPayload');
  if (!authPayload) return undefined;

  try {
    const payload = JSON.parse(authPayload);
    return safeLower(typeof payload?.address === 'string' ? payload.address : undefined);
  } catch {
    return undefined;
  }
}

function readUserIdFromToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const token = localStorage.getItem('authToken');
  if (!token) return undefined;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return undefined;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const rawAddress = typeof payload?.sub === 'string' ? payload.sub : payload?.address;
    return safeLower(typeof rawAddress === 'string' ? rawAddress : undefined);
  } catch {
    return undefined;
  }
}

export function resolveChatIdentity(input: ChatIdentityInput): ResolvedChatIdentity {
  const connectedWallet = safeLower(input.accountAddress);
  if (connectedWallet) {
    return { userId: connectedWallet, walletAddress: connectedWallet, source: 'connected-wallet' };
  }

  const tokenUserId = readUserIdFromToken();
  if (tokenUserId) {
    return { userId: tokenUserId, walletAddress: tokenUserId, source: 'auth-token' };
  }

  const localWallet = readStoredWalletAddress();
  if (localWallet) {
    return { userId: localWallet, walletAddress: localWallet, source: 'local-storage' };
  }

  const contextWallet = safeLower(input.identityAddress) || safeLower(input.tonAddress) || safeLower(input.tonAddressRaw);
  if (contextWallet) {
    return { userId: contextWallet, walletAddress: contextWallet, source: 'wallet-context' };
  }

  if (input.telegramUserId !== undefined && input.telegramUserId !== null && String(input.telegramUserId).trim()) {
    return { userId: String(input.telegramUserId), source: 'telegram' };
  }

  return { source: 'none' };
}

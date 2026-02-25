'use client';

export const AUTH_WALLET_ID_KEY = 'authWalletId';
export const AUTH_WALLET_ADDRESS_KEY = 'authWalletAddress';

type WalletLike = {
  id?: string;
  walletId?: string;
} | null | undefined;

type AccountLike = {
  address?: string;
  walletId?: string;
  wallet?: {
    id?: string;
    walletId?: string;
  };
} | null | undefined;

function normalizeWalletId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEvmAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function resolveWalletId(activeWallet?: WalletLike, account?: AccountLike): string | null {
  return normalizeWalletId(
    activeWallet?.id ||
    activeWallet?.walletId ||
    account?.walletId ||
    account?.wallet?.id ||
    account?.wallet?.walletId
  );
}

export function persistAuthWalletBinding(params: {
  activeWallet?: WalletLike;
  account?: AccountLike;
  walletId?: string | null;
  address?: string | null;
}): void {
  if (typeof window === 'undefined') return;

  const walletId = normalizeWalletId(params.walletId) || resolveWalletId(params.activeWallet, params.account);
  const address = normalizeEvmAddress(params.address) || normalizeEvmAddress(params.account?.address);

  if (walletId) localStorage.setItem(AUTH_WALLET_ID_KEY, walletId);
  else localStorage.removeItem(AUTH_WALLET_ID_KEY);

  if (address) localStorage.setItem(AUTH_WALLET_ADDRESS_KEY, address);
  else localStorage.removeItem(AUTH_WALLET_ADDRESS_KEY);
}

export function getAuthWalletBinding(): { walletId: string | null; address: string | null } {
  if (typeof window === 'undefined') return { walletId: null, address: null };

  const walletId = normalizeWalletId(localStorage.getItem(AUTH_WALLET_ID_KEY));
  const address = normalizeEvmAddress(localStorage.getItem(AUTH_WALLET_ADDRESS_KEY));
  return { walletId, address };
}

export function clearAuthWalletBinding(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_WALLET_ID_KEY);
  localStorage.removeItem(AUTH_WALLET_ADDRESS_KEY);
}

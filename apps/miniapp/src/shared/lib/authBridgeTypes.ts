/**
 * Shared types for the Telegram ↔ backend auth bridge.
 *
 * Used by:
 * - miniapp: telegram-auth.ts, fetchWithAuth.ts
 * - gateway: authService.ts, auth routes
 *
 * Normalized to match the capability auth port types from
 * auth-service/src/domain/ports/auth.provider.port.ts
 */

export type WalletType = 'evm' | 'ton' | 'telegram';

export interface AuthChallenge {
  walletType: WalletType;
  payload: Record<string, unknown>;
  expiresAt: string;
}

export interface AuthVerifyRequest {
  walletType: WalletType;
  payload: Record<string, unknown>;
  signature: string;
  address: string;
}

export interface AuthVerifyResult {
  token: string;
  address: string;
  walletType: WalletType;
}

export interface TelegramAuthRequest {
  initData: string;
}

export interface TelegramAuthResult {
  token: string;
  telegramUserId: string;
}

export interface AuthSession {
  token: string;
  walletType: WalletType;
  address?: string;
  telegramUserId?: string;
  expiresAt?: string;
}

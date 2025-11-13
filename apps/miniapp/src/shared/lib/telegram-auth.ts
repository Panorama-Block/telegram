/**
 * Telegram Authentication Helper
 * Provides utilities for authenticating with backend using Telegram initData
 */

/**
 * Get Telegram initData from SDK
 * This contains cryptographically signed user data from Telegram
 */
export function getTelegramInitData(): string | null {
  // In Telegram WebApp, initData is available via window.Telegram.WebApp
  if (typeof window === 'undefined') {
    return null; // SSR
  }

  const webApp = (window as any).Telegram?.WebApp;
  if (!webApp) {
    console.warn('[Telegram Auth] Telegram WebApp SDK not loaded');
    return null;
  }

  const initData = webApp.initData;
  if (!initData) {
    console.warn('[Telegram Auth] No initData available from Telegram');
    return null;
  }

  return initData;
}

/**
 * Get authenticated fetch headers for API requests
 * Automatically includes Telegram initData for authentication
 * Falls back to dev mode if not in Telegram
 * @param userId - Optional user ID to use for dev mode authentication
 */
export function getAuthHeaders(userId?: string): HeadersInit {
  const initData = getTelegramInitData();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (initData) {
    // Running in Telegram WebApp
    headers['x-telegram-init-data'] = initData;
  } else if (userId) {
    // Use provided userId for dev mode
    headers['x-dev-user-id'] = userId;
    console.log('[Telegram Auth] Using dev mode with user ID:', userId.slice(0, 10) + '...');
  } else {
    console.warn('[Telegram Auth] No authentication available - requests may fail');
  }

  return headers;
}

/**
 * Authenticated fetch wrapper
 * Automatically adds Telegram authentication headers
 * @param userId - Optional user ID to use for dev mode authentication
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
  userId?: string
): Promise<Response> {
  const authHeaders = getAuthHeaders(userId);

  const finalOptions: RequestInit = {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers,
    },
  };

  return fetch(url, finalOptions);
}

/**
 * Get current Telegram user data
 */
export interface TelegramUser {
  id: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  photoUrl?: string;
}

export function getTelegramUser(): TelegramUser | null {
  if (typeof window === 'undefined') {
    return null; // SSR
  }

  const webApp = (window as any).Telegram?.WebApp;
  if (!webApp || !webApp.initDataUnsafe?.user) {
    return null;
  }

  const user = webApp.initDataUnsafe.user;
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
    languageCode: user.language_code,
    photoUrl: user.photo_url,
  };
}

/**
 * Check if running in Telegram WebApp environment
 */
export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return !!(window as any).Telegram?.WebApp;
}


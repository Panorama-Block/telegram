import { request } from '@tma.js/sdk';

/**
 * Synchronous check (fast but potentially unreliable)
 * Used for initial state, but should be confirmed by detectTelegram()
 */
export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;

  const tg = (window as any).Telegram;
  const webApp = tg?.WebApp;
  const initData = typeof webApp?.initData === 'string' ? webApp.initData.trim() : '';
  const search = window.location?.search ?? '';
  const overrideParam = /(?:^|[?&])tma=(1|true)(?:&|$)/i.test(search);
  const overrideKey = 'tma_override';
  if (overrideParam) {
    try {
      sessionStorage.setItem(overrideKey, '1');
    } catch {}
    return true;
  }
  try {
    if (sessionStorage.getItem(overrideKey) === '1') return true;
  } catch {}

  // 1) Strongest signal: official Telegram WebApp context
  // STRICT CHECK: We require initData to be present and non-empty.
  // This ensures browsers (which might have empty WebApp) return false.
  // The async detectTelegram() function will handle valid Telegram environments without initData.
  if (initData.length > 0) {
    return true;
  }

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const hasTelegramUA = /Telegram/i.test(userAgent);
  const referrer = typeof document !== 'undefined' ? document.referrer : '';
  const fromTelegramWeb = /web\.telegram\.(org|me)/i.test(referrer);
  const isIframe = typeof window !== 'undefined' && window.top !== window;

  // 2) Telegram injects tgWebApp* params in URL
  const hasTgParams = /tgWebApp/i.test(search);
  if (hasTgParams && (hasTelegramUA || fromTelegramWeb || isIframe)) {
    return true;
  }

  // 3) Telegram Web (browser) – only if you're on Telegram's web host
  const host = window.location.hostname.toLowerCase();
  if (/^web\.telegram\.(org|me)$/i.test(host)) {
    return true;
  }

  // 4) Telegram WebApp inside Telegram Web iframe
  if (webApp && tg?.WebView?.isIframe === true && typeof webApp.version === 'string' && (hasTelegramUA || fromTelegramWeb)) {
    return true;
  }
  if (webApp && isIframe && typeof webApp.version === 'string') {
    return true;
  }

  return false;
}

/**
 * Asynchronous robust check using @tma.js/sdk
 * Attempts to communicate with the Telegram client.
 */
export async function detectTelegram(timeoutMs = 100): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const tg = (window as any).Telegram;
  const webApp = tg?.WebApp;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const hasTelegramUA = /Telegram/i.test(userAgent);
  const referrer = typeof document !== 'undefined' ? document.referrer : '';
  const fromTelegramWeb = /web\.telegram\.(org|me)/i.test(referrer);
  const hasLikelySignal = isTelegramWebApp() || (hasTelegramUA && !!webApp) || fromTelegramWeb;

  if (!hasLikelySignal) {
    return false;
  }

  try {
    // Try to send a harmless event to the Telegram client
    // 'web_app_request_theme' is a safe event to request
    await request('web_app_request_theme', 'theme_changed', {
      timeout: timeoutMs,
    });
    return true;
  } catch (error) {
    // If it times out or fails, we are likely not in TMA
    return false;
  }
}

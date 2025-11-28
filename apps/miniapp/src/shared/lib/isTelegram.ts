export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent || '').toLowerCase();
  // Only consider Telegram when the UA indicates Telegram and initData is present
  if (!ua.includes('telegram')) return false;
  const webApp = (window as any).Telegram?.WebApp;
  // Only treat as Telegram when initData/initDataUnsafe is present (real web app context)
  const hasInitData = Boolean(webApp?.initData) || Boolean(webApp?.initDataUnsafe);
  return Boolean(webApp && hasInitData);
}

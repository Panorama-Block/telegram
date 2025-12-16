export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;
  const webApp = (window as any).Telegram?.WebApp;
  // Only treat as Telegram when initData/initDataUnsafe is present (real web app context)
  const hasInitData = Boolean(webApp?.initData) || Boolean(webApp?.initDataUnsafe);
  return Boolean(webApp && hasInitData);
}

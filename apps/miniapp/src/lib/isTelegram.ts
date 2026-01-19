export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;

  const tg = (window as any).Telegram?.WebApp;

  // ✅ Strongest signal: official Telegram WebApp context
  if (tg && typeof tg.initData === 'string' && tg.initData.length > 0) {
    console.log("isTelegram because of the initialData");
    return true;
  }

  // ✅ Telegram injects tgWebApp* params in URL
  const search = window.location?.search ?? '';
  if (/tgWebApp/i.test(search)) {
    console.log("isTelegram because of the params in the URL");
    return true;
  }

  // ⚠️ Weak fallback: User Agent (last resort)
  const ua = navigator?.userAgent ?? '';
  if (/Telegram/i.test(ua)) {
    console.log("isTelegram because of the fallback");
    return true;
  }

  return false;
}


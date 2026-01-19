export function isTelegramWebApp(): boolean {
    if (typeof window === 'undefined') return false;
    const telegramWebApp = (window as any).Telegram?.WebApp;
    if (telegramWebApp) return true;

    const search = typeof window.location?.search === 'string' ? window.location.search : '';
    const hasTelegramParams = /(^|[?&])tgWebApp/i.test(search);
    if (hasTelegramParams) return true;

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    return /Telegram/i.test(ua);
}
